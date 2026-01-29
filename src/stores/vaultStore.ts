import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { get, set as idbSet, del as idbDel } from 'idb-keyval';
import { DEFAULT_FILES, DEFAULT_VAULT_ID, STORAGE_KEY, VAULTS_REGISTRY_KEY } from '@/lib/constants';
export type FileType = 'file' | 'folder';
export interface FileHistory {
  content: string;
  timestamp: number;
}
export interface FileItem {
  id: string;
  name: string;
  type: FileType;
  content?: string;
  parentId: string | 'root';
  updatedAt: number;
  history?: FileHistory[];
}
export interface VaultMeta {
  id: string;
  name: string;
  fileCount: number;
  createdAt: number;
  lastAccessed: number;
}
interface VaultDataV2 {
  version: number;
  files: Record<string, FileItem>;
  activeFileId: string | null;
  openFileIds: string[];
  selectedFolderId: string | 'root';
}
interface VaultRegistryV1 {
  version: number;
  currentVaultId: string;
  vaults: VaultMeta[];
}
interface VaultState {
  // Multi-vault
  vaults: VaultMeta[];
  currentVaultId: string;
  initialized: boolean;
  vaultLoading: boolean;
  // Per-vault workspace state
  files: Record<string, FileItem>;
  activeFileId: string | null;
  openFileIds: string[];
  selectedFolderId: string | 'root';
  actions: {
    init: () => Promise<void>;
    createVault: (name: string, initialFiles?: Record<string, FileItem>) => Promise<string | null>;
    switchVault: (vaultId: string) => Promise<void>;
    deleteVault: (vaultId: string) => Promise<void>;
    createFile: (name: string, parentId?: string) => string | null;
    createFolder: (name: string, parentId?: string) => string | null;
    updateFileContent: (id: string, content: string) => void;
    deleteItem: (id: string) => void;
    renameItem: (id: string, name: string) => void;
    setActiveFile: (id: string | null) => void;
    closeFile: (id: string) => void;
    setFolderFocus: (id: string | 'root') => void;
    importVault: (incomingFiles: Record<string, FileItem>) => void; // merge into current vault
    restoreHistory: (fileId: string, content: string) => void;
  };
}
const CURRENT_VAULT_DATA_VERSION = 2;
const CURRENT_REGISTRY_VERSION = 1;
const vaultKey = (vaultId: string) => `${STORAGE_KEY}${vaultId}`;
const sanitizeFiles = (files: unknown): Record<string, FileItem> => {
  if (!files || typeof files !== 'object') return {};
  const record = files as Record<string, any>;
  const out: Record<string, FileItem> = {};
  for (const id of Object.keys(record)) {
    const v = record[id];
    if (!v || typeof v !== 'object') continue;
    const itemId = typeof v.id === 'string' ? v.id : id;
    if (id !== itemId) continue;
    const type: FileType = v.type === 'folder' ? 'folder' : 'file';
    out[id] = {
      id,
      name: typeof v.name === 'string' && v.name.trim() ? v.name : (type === 'file' ? 'Untitled.md' : 'Untitled'),
      type,
      content: typeof v.content === 'string' ? v.content : '',
      parentId: typeof v.parentId === 'string' ? v.parentId : 'root',
      updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now(),
      history: Array.isArray(v.history)
        ? v.history
            .filter((h: any) => h && typeof h.content === 'string' && typeof h.timestamp === 'number')
            .map((h: any) => ({ content: h.content, timestamp: h.timestamp }))
        : [],
    };
  }
  return out;
};
const createDefaultFilesRecord = (): Record<string, FileItem> => {
  const initialFiles: Record<string, FileItem> = {};
  DEFAULT_FILES.forEach((f) => {
    initialFiles[f.id] = { ...f, history: [] };
  });
  return initialFiles;
};
const countFiles = (files: Record<string, FileItem>): number =>
  Object.values(files).reduce((acc, f) => (f.type === 'file' ? acc + 1 : acc), 0);
const toPlainFilesSnapshot = (draftFiles: Record<string, FileItem>): Record<string, FileItem> => {
  // Important: build the snapshot synchronously while the immer draft is still valid.
  // This avoids "Cannot perform 'ownKeys' on a proxy that has been revoked".
  const snap: Record<string, FileItem> = {};
  for (const id of Object.keys(draftFiles)) {
    const f = draftFiles[id];
    if (!f) continue;
    snap[id] = {
      id: f.id,
      name: f.name,
      type: f.type,
      content: f.content ?? '',
      parentId: f.parentId ?? 'root',
      updatedAt: f.updatedAt ?? Date.now(),
      history: Array.isArray(f.history) ? f.history.map((h) => ({ content: h.content, timestamp: h.timestamp })) : [],
    };
  }
  return snap;
};
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const persistRegistry = async (registry: VaultRegistryV1): Promise<void> => {
  await idbSet(VAULTS_REGISTRY_KEY, registry);
};
const persistVaultData = async (vaultId: string, data: VaultDataV2): Promise<void> => {
  await idbSet(vaultKey(vaultId), data);
};
const persistVaultDataDebounced = (vaultId: string, data: VaultDataV2): void => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      await persistVaultData(vaultId, data);
    } catch (err) {
      console.error('Failed to persist vault data:', err);
    }
  }, 500);
};
export const useVaultStore = create<VaultState>()(
  immer((set, get) => ({
    vaults: [],
    currentVaultId: DEFAULT_VAULT_ID,
    initialized: false,
    vaultLoading: false,
    files: {},
    activeFileId: null,
    openFileIds: [],
    selectedFolderId: 'root',
    actions: {
      init: async () => {
        if (get().initialized) return;
        try {
          const rawRegistry = await get<unknown>(VAULTS_REGISTRY_KEY);
          let registry: VaultRegistryV1 | null = null;
          if (
            rawRegistry &&
            typeof rawRegistry === 'object' &&
            Array.isArray((rawRegistry as any).vaults) &&
            typeof (rawRegistry as any).currentVaultId === 'string'
          ) {
            registry = {
              version: CURRENT_REGISTRY_VERSION,
              currentVaultId: (rawRegistry as any).currentVaultId,
              vaults: (rawRegistry as any).vaults as VaultMeta[],
            };
          }
          if (!registry || registry.vaults.length === 0) {
            const now = Date.now();
            const defaultFiles = createDefaultFilesRecord();
            const defaultMeta: VaultMeta = {
              id: DEFAULT_VAULT_ID,
              name: 'Default Vault',
              fileCount: countFiles(defaultFiles),
              createdAt: now,
              lastAccessed: now,
            };
            const nextRegistry: VaultRegistryV1 = {
              version: CURRENT_REGISTRY_VERSION,
              currentVaultId: DEFAULT_VAULT_ID,
              vaults: [defaultMeta],
            };
            const defaultData: VaultDataV2 = {
              version: CURRENT_VAULT_DATA_VERSION,
              files: defaultFiles,
              activeFileId: 'welcome-md',
              openFileIds: ['welcome-md'],
              selectedFolderId: 'root',
            };
            await persistRegistry(nextRegistry);
            await persistVaultData(DEFAULT_VAULT_ID, defaultData);
            set((state) => {
              state.vaults = nextRegistry.vaults;
              state.currentVaultId = nextRegistry.currentVaultId;
              state.files = defaultFiles;
              state.activeFileId = defaultData.activeFileId;
              state.openFileIds = defaultData.openFileIds;
              state.selectedFolderId = defaultData.selectedFolderId;
              state.initialized = true;
              state.vaultLoading = false;
            });
            return;
          }
          // Load current vault data
          const currentId = registry.currentVaultId || registry.vaults[0]?.id || DEFAULT_VAULT_ID;
          const rawVault = await get<unknown>(vaultKey(currentId));
          let vaultData: VaultDataV2 | null = null;
          if (rawVault && typeof rawVault === 'object') {
            const rv = rawVault as any;
            if (rv.files && typeof rv.files === 'object') {
              vaultData = {
                version: CURRENT_VAULT_DATA_VERSION,
                files: sanitizeFiles(rv.files),
                activeFileId: typeof rv.activeFileId === 'string' ? rv.activeFileId : null,
                openFileIds: Array.isArray(rv.openFileIds) ? rv.openFileIds.filter((x: any) => typeof x === 'string') : [],
                selectedFolderId: typeof rv.selectedFolderId === 'string' ? rv.selectedFolderId : 'root',
              };
            }
          }
          if (!vaultData) {
            // Vault exists in registry but no data found (or invalid). Re-seed with defaults.
            const seeded = createDefaultFilesRecord();
            vaultData = {
              version: CURRENT_VAULT_DATA_VERSION,
              files: seeded,
              activeFileId: 'welcome-md',
              openFileIds: ['welcome-md'],
              selectedFolderId: 'root',
            };
            await persistVaultData(currentId, vaultData);
          }
          const activeId = vaultData.activeFileId && vaultData.files[vaultData.activeFileId] ? vaultData.activeFileId : null;
          const openIds = vaultData.openFileIds.filter((id) => !!vaultData!.files[id]);
          const firstFileId = Object.keys(vaultData.files).find((id) => vaultData!.files[id]?.type === 'file') || null;
          const resolvedActive = activeId || firstFileId;
          const resolvedOpen = openIds.length > 0 ? openIds : resolvedActive ? [resolvedActive] : [];
          // Update last accessed for current vault
          const now = Date.now();
          const nextVaults = registry.vaults.map((v) =>
            v.id === currentId ? { ...v, lastAccessed: now, fileCount: v.fileCount ?? countFiles(vaultData!.files) } : v
          );
          const nextRegistry: VaultRegistryV1 = { ...registry, currentVaultId: currentId, vaults: nextVaults };
          await persistRegistry(nextRegistry);
          set((state) => {
            state.vaults = nextRegistry.vaults;
            state.currentVaultId = currentId;
            state.files = vaultData!.files;
            state.activeFileId = resolvedActive;
            state.openFileIds = resolvedOpen;
            state.selectedFolderId = vaultData!.selectedFolderId ?? 'root';
            state.initialized = true;
            state.vaultLoading = false;
          });
        } catch (err) {
          console.error('Vault initialization failed:', err);
          set((state) => {
            state.initialized = true; // allow UI to render error boundary paths if any
            state.vaultLoading = false;
          });
        }
      },
      createVault: async (name: string, initialFiles?: Record<string, FileItem>) => {
        try {
          const now = Date.now();
          const newId = crypto.randomUUID();
          // Files
          const files = sanitizeFiles(initialFiles ?? createDefaultFilesRecord());
          if (Object.keys(files).length === 0) {
            const seeded = createDefaultFilesRecord();
            for (const k of Object.keys(seeded)) files[k] = seeded[k];
          }
          const firstFileId = Object.keys(files).find((id) => files[id]?.type === 'file') || null;
          const data: VaultDataV2 = {
            version: CURRENT_VAULT_DATA_VERSION,
            files,
            activeFileId: firstFileId,
            openFileIds: firstFileId ? [firstFileId] : [],
            selectedFolderId: 'root',
          };
          // Registry
          const registryRaw = await get<unknown>(VAULTS_REGISTRY_KEY);
          const prevVaults: VaultMeta[] =
            registryRaw && typeof registryRaw === 'object' && Array.isArray((registryRaw as any).vaults)
              ? ((registryRaw as any).vaults as VaultMeta[])
              : [];
          const meta: VaultMeta = {
            id: newId,
            name: name.trim() ? name.trim() : 'New Vault',
            fileCount: countFiles(files),
            createdAt: now,
            lastAccessed: now,
          };
          const nextRegistry: VaultRegistryV1 = {
            version: CURRENT_REGISTRY_VERSION,
            currentVaultId: newId,
            vaults: [...prevVaults, meta],
          };
          await persistVaultData(newId, data);
          await persistRegistry(nextRegistry);
          set((state) => {
            state.vaults = nextRegistry.vaults;
            state.currentVaultId = newId;
            state.files = files;
            state.activeFileId = data.activeFileId;
            state.openFileIds = data.openFileIds;
            state.selectedFolderId = data.selectedFolderId;
            state.vaultLoading = false;
            state.initialized = true;
          });
          return newId;
        } catch (err) {
          console.error('Failed to create vault:', err);
          return null;
        }
      },
      switchVault: async (vaultId: string) => {
        const { currentVaultId, initialized } = get();
        if (!initialized) return;
        if (!vaultId || vaultId === currentVaultId) return;
        set((state) => {
          state.vaultLoading = true;
        });
        // Flush any pending debounced save for current vault
        try {
          if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
          }
          const snapshotFiles = toPlainFilesSnapshot(get().files);
          const currentData: VaultDataV2 = {
            version: CURRENT_VAULT_DATA_VERSION,
            files: snapshotFiles,
            activeFileId: get().activeFileId,
            openFileIds: [...get().openFileIds],
            selectedFolderId: get().selectedFolderId,
          };
          await persistVaultData(currentVaultId, currentData);
        } catch (err) {
          console.error('Failed to flush current vault before switching:', err);
        }
        try {
          // Load target vault data
          const rawVault = await get<unknown>(vaultKey(vaultId));
          let vaultData: VaultDataV2 | null = null;
          if (rawVault && typeof rawVault === 'object') {
            const rv = rawVault as any;
            if (rv.files && typeof rv.files === 'object') {
              vaultData = {
                version: CURRENT_VAULT_DATA_VERSION,
                files: sanitizeFiles(rv.files),
                activeFileId: typeof rv.activeFileId === 'string' ? rv.activeFileId : null,
                openFileIds: Array.isArray(rv.openFileIds) ? rv.openFileIds.filter((x: any) => typeof x === 'string') : [],
                selectedFolderId: typeof rv.selectedFolderId === 'string' ? rv.selectedFolderId : 'root',
              };
            }
          }
          if (!vaultData) {
            const seeded = createDefaultFilesRecord();
            vaultData = {
              version: CURRENT_VAULT_DATA_VERSION,
              files: seeded,
              activeFileId: 'welcome-md',
              openFileIds: ['welcome-md'],
              selectedFolderId: 'root',
            };
            await persistVaultData(vaultId, vaultData);
          }
          const activeId = vaultData.activeFileId && vaultData.files[vaultData.activeFileId] ? vaultData.activeFileId : null;
          const openIds = vaultData.openFileIds.filter((id) => !!vaultData!.files[id]);
          const firstFileId = Object.keys(vaultData.files).find((id) => vaultData!.files[id]?.type === 'file') || null;
          const resolvedActive = activeId || firstFileId;
          const resolvedOpen = openIds.length > 0 ? openIds : resolvedActive ? [resolvedActive] : [];
          // Update registry current + lastAccessed + fileCount
          const registryRaw = await get<unknown>(VAULTS_REGISTRY_KEY);
          const rawVaults: VaultMeta[] =
            registryRaw && typeof registryRaw === 'object' && Array.isArray((registryRaw as any).vaults)
              ? ((registryRaw as any).vaults as VaultMeta[])
              : [];
          const now = Date.now();
          const nextVaults = rawVaults.map((v) =>
            v.id === vaultId ? { ...v, lastAccessed: now, fileCount: countFiles(vaultData!.files) } : v
          );
          const nextRegistry: VaultRegistryV1 = {
            version: CURRENT_REGISTRY_VERSION,
            currentVaultId: vaultId,
            vaults: nextVaults,
          };
          await persistRegistry(nextRegistry);
          set((state) => {
            state.vaults = nextRegistry.vaults;
            state.currentVaultId = vaultId;
            state.files = vaultData!.files;
            state.activeFileId = resolvedActive;
            state.openFileIds = resolvedOpen;
            state.selectedFolderId = vaultData!.selectedFolderId ?? 'root';
            state.vaultLoading = false;
            state.initialized = true;
          });
        } catch (err) {
          console.error('Failed to switch vault:', err);
          set((state) => {
            state.vaultLoading = false;
          });
        }
      },
      deleteVault: async (vaultId: string) => {
        try {
          if (!vaultId) return;
          const registryRaw = await get<unknown>(VAULTS_REGISTRY_KEY);
          const current = get().currentVaultId;
          const rawVaults: VaultMeta[] =
            registryRaw && typeof registryRaw === 'object' && Array.isArray((registryRaw as any).vaults)
              ? ((registryRaw as any).vaults as VaultMeta[])
              : [];
          const nextVaults = rawVaults.filter((v) => v.id !== vaultId);
          await idbDel(vaultKey(vaultId));
          if (nextVaults.length === 0) {
            // Ensure at least one vault exists
            const now = Date.now();
            const defaultFiles = createDefaultFilesRecord();
            const defaultMeta: VaultMeta = {
              id: DEFAULT_VAULT_ID,
              name: 'Default Vault',
              fileCount: countFiles(defaultFiles),
              createdAt: now,
              lastAccessed: now,
            };
            const nextRegistry: VaultRegistryV1 = {
              version: CURRENT_REGISTRY_VERSION,
              currentVaultId: DEFAULT_VAULT_ID,
              vaults: [defaultMeta],
            };
            const defaultData: VaultDataV2 = {
              version: CURRENT_VAULT_DATA_VERSION,
              files: defaultFiles,
              activeFileId: 'welcome-md',
              openFileIds: ['welcome-md'],
              selectedFolderId: 'root',
            };
            await persistRegistry(nextRegistry);
            await persistVaultData(DEFAULT_VAULT_ID, defaultData);
            set((state) => {
              state.vaults = nextRegistry.vaults;
              state.currentVaultId = DEFAULT_VAULT_ID;
              state.files = defaultFiles;
              state.activeFileId = defaultData.activeFileId;
              state.openFileIds = defaultData.openFileIds;
              state.selectedFolderId = defaultData.selectedFolderId;
              state.vaultLoading = false;
              state.initialized = true;
            });
            return;
          }
          const nextCurrent = current === vaultId ? nextVaults[0].id : current;
          const nextRegistry: VaultRegistryV1 = {
            version: CURRENT_REGISTRY_VERSION,
            currentVaultId: nextCurrent,
            vaults: nextVaults,
          };
          await persistRegistry(nextRegistry);
          set((state) => {
            state.vaults = nextVaults;
          });
          if (current === vaultId) {
            await get().actions.switchVault(nextCurrent);
          }
        } catch (err) {
          console.error('Failed to delete vault:', err);
        }
      },
      createFile: (name: string, parentId?: string) => {
        const currentVaultId = get().currentVaultId;
        let createdId: string | null = null;
        let snapshotFiles: Record<string, FileItem> | null = null;
        let snapshotData: VaultDataV2 | null = null;
        let nextFileCount = 0;
        set((state) => {
          const id = crypto.randomUUID();
          createdId = id;
          const pId = parentId || state.selectedFolderId;
          const newItem: FileItem = {
            id,
            name: name.endsWith('.md') ? name : `${name}.md`,
            type: 'file',
            content: '',
            parentId: pId,
            updatedAt: Date.now(),
            history: [],
          };
          state.files[id] = newItem;
          state.activeFileId = id;
          if (!state.openFileIds.includes(id)) state.openFileIds.push(id);
          nextFileCount = countFiles(state.files);
          snapshotFiles = toPlainFilesSnapshot(state.files);
          snapshotData = {
            version: CURRENT_VAULT_DATA_VERSION,
            files: snapshotFiles!,
            activeFileId: state.activeFileId,
            openFileIds: [...state.openFileIds],
            selectedFolderId: state.selectedFolderId,
          };
        });
        if (snapshotData) persistVaultDataDebounced(currentVaultId, snapshotData);
        // Update registry metadata (async, non-blocking)
        (async () => {
          try {
            const regRaw = await get<unknown>(VAULTS_REGISTRY_KEY);
            if (!regRaw || typeof regRaw !== 'object') return;
            const rr = regRaw as any;
            if (!Array.isArray(rr.vaults)) return;
            const now = Date.now();
            const nextVaults = (rr.vaults as VaultMeta[]).map((v) =>
              v.id === currentVaultId ? { ...v, fileCount: nextFileCount, lastAccessed: now } : v
            );
            const nextRegistry: VaultRegistryV1 = {
              version: CURRENT_REGISTRY_VERSION,
              currentVaultId: currentVaultId,
              vaults: nextVaults,
            };
            await persistRegistry(nextRegistry);
            set((state) => {
              state.vaults = nextVaults;
            });
          } catch (err) {
            console.error('Failed to update registry after createFile:', err);
          }
        })();
        return createdId;
      },
      createFolder: (name: string, parentId?: string) => {
        const currentVaultId = get().currentVaultId;
        let createdId: string | null = null;
        let snapshotData: VaultDataV2 | null = null;
        set((state) => {
          const id = crypto.randomUUID();
          createdId = id;
          const pId = parentId || state.selectedFolderId;
          state.files[id] = {
            id,
            name,
            type: 'folder',
            parentId: pId,
            updatedAt: Date.now(),
            history: [],
          };
          state.selectedFolderId = id;
          const snapshotFiles = toPlainFilesSnapshot(state.files);
          snapshotData = {
            version: CURRENT_VAULT_DATA_VERSION,
            files: snapshotFiles,
            activeFileId: state.activeFileId,
            openFileIds: [...state.openFileIds],
            selectedFolderId: state.selectedFolderId,
          };
        });
        if (snapshotData) persistVaultDataDebounced(currentVaultId, snapshotData);
        return createdId;
      },
      updateFileContent: (id: string, content: string) => {
        const currentVaultId = get().currentVaultId;
        let snapshotData: VaultDataV2 | null = null;
        set((state) => {
          const file = state.files[id];
          if (!file || file.type !== 'file') return;
          if (file.content !== content) {
            const history = file.history || [];
            const lastEntry = history[history.length - 1];
            if (!lastEntry || Date.now() - lastEntry.timestamp > 60000) {
              history.push({ content: file.content || '', timestamp: Date.now() });
              if (history.length > 5) history.shift();
            }
            file.content = content;
            file.history = history;
            file.updatedAt = Date.now();
            const snapshotFiles = toPlainFilesSnapshot(state.files);
            snapshotData = {
              version: CURRENT_VAULT_DATA_VERSION,
              files: snapshotFiles,
              activeFileId: state.activeFileId,
              openFileIds: [...state.openFileIds],
              selectedFolderId: state.selectedFolderId,
            };
          }
        });
        if (snapshotData) persistVaultDataDebounced(currentVaultId, snapshotData);
      },
      deleteItem: (id: string) => {
        const currentVaultId = get().currentVaultId;
        let snapshotData: VaultDataV2 | null = null;
        let nextFileCount = 0;
        set((state) => {
          const cleanupChildren = (parentId: string) => {
            for (const key of Object.keys(state.files)) {
              if (state.files[key]?.parentId === parentId) {
                delete state.files[key];
                state.openFileIds = state.openFileIds.filter((oid) => oid !== key);
                cleanupChildren(key);
              }
            }
          };
          delete state.files[id];
          state.openFileIds = state.openFileIds.filter((oid) => oid !== id);
          cleanupChildren(id);
          if (state.activeFileId === id) {
            const nextActive = state.openFileIds[state.openFileIds.length - 1] || null;
            state.activeFileId = nextActive;
          }
          if (state.selectedFolderId === id) state.selectedFolderId = 'root';
          nextFileCount = countFiles(state.files);
          const snapshotFiles = toPlainFilesSnapshot(state.files);
          snapshotData = {
            version: CURRENT_VAULT_DATA_VERSION,
            files: snapshotFiles,
            activeFileId: state.activeFileId,
            openFileIds: [...state.openFileIds],
            selectedFolderId: state.selectedFolderId,
          };
        });
        if (snapshotData) persistVaultDataDebounced(currentVaultId, snapshotData);
        (async () => {
          try {
            const regRaw = await get<unknown>(VAULTS_REGISTRY_KEY);
            if (!regRaw || typeof regRaw !== 'object') return;
            const rr = regRaw as any;
            if (!Array.isArray(rr.vaults)) return;
            const now = Date.now();
            const nextVaults = (rr.vaults as VaultMeta[]).map((v) =>
              v.id === currentVaultId ? { ...v, fileCount: nextFileCount, lastAccessed: now } : v
            );
            const nextRegistry: VaultRegistryV1 = {
              version: CURRENT_REGISTRY_VERSION,
              currentVaultId: currentVaultId,
              vaults: nextVaults,
            };
            await persistRegistry(nextRegistry);
            set((state) => {
              state.vaults = nextVaults;
            });
          } catch (err) {
            console.error('Failed to update registry after deleteItem:', err);
          }
        })();
      },
      renameItem: (id: string, name: string) => {
        const currentVaultId = get().currentVaultId;
        let snapshotData: VaultDataV2 | null = null;
        set((state) => {
          const item = state.files[id];
          if (!item) return;
          item.name = name;
          item.updatedAt = Date.now();
          const snapshotFiles = toPlainFilesSnapshot(state.files);
          snapshotData = {
            version: CURRENT_VAULT_DATA_VERSION,
            files: snapshotFiles,
            activeFileId: state.activeFileId,
            openFileIds: [...state.openFileIds],
            selectedFolderId: state.selectedFolderId,
          };
        });
        if (snapshotData) persistVaultDataDebounced(currentVaultId, snapshotData);
      },
      setActiveFile: (id: string | null) => {
        const currentVaultId = get().currentVaultId;
        let snapshotData: VaultDataV2 | null = null;
        set((state) => {
          state.activeFileId = id;
          if (id && !state.openFileIds.includes(id)) state.openFileIds.push(id);
          const snapshotFiles = toPlainFilesSnapshot(state.files);
          snapshotData = {
            version: CURRENT_VAULT_DATA_VERSION,
            files: snapshotFiles,
            activeFileId: state.activeFileId,
            openFileIds: [...state.openFileIds],
            selectedFolderId: state.selectedFolderId,
          };
        });
        if (snapshotData) persistVaultDataDebounced(currentVaultId, snapshotData);
      },
      closeFile: (id: string) => {
        const currentVaultId = get().currentVaultId;
        let snapshotData: VaultDataV2 | null = null;
        set((state) => {
          state.openFileIds = state.openFileIds.filter((oid) => oid !== id);
          if (state.activeFileId === id) {
            state.activeFileId = state.openFileIds[state.openFileIds.length - 1] || null;
          }
          const snapshotFiles = toPlainFilesSnapshot(state.files);
          snapshotData = {
            version: CURRENT_VAULT_DATA_VERSION,
            files: snapshotFiles,
            activeFileId: state.activeFileId,
            openFileIds: [...state.openFileIds],
            selectedFolderId: state.selectedFolderId,
          };
        });
        if (snapshotData) persistVaultDataDebounced(currentVaultId, snapshotData);
      },
      setFolderFocus: (id: string | 'root') => {
        const currentVaultId = get().currentVaultId;
        let snapshotData: VaultDataV2 | null = null;
        set((state) => {
          state.selectedFolderId = id;
          const snapshotFiles = toPlainFilesSnapshot(state.files);
          snapshotData = {
            version: CURRENT_VAULT_DATA_VERSION,
            files: snapshotFiles,
            activeFileId: state.activeFileId,
            openFileIds: [...state.openFileIds],
            selectedFolderId: state.selectedFolderId,
          };
        });
        if (snapshotData) persistVaultDataDebounced(currentVaultId, snapshotData);
      },
      importVault: (incomingFiles: Record<string, FileItem>) => {
        const currentVaultId = get().currentVaultId;
        let snapshotData: VaultDataV2 | null = null;
        let nextFileCount = 0;
        set((state) => {
          const sanitized = sanitizeFiles(incomingFiles);
          state.files = { ...state.files, ...sanitized };
          // Ensure there's at least one active file
          if (!state.activeFileId) {
            const firstFileId = Object.keys(state.files).find((id) => state.files[id]?.type === 'file') || null;
            state.activeFileId = firstFileId;
            state.openFileIds = firstFileId ? [firstFileId] : [];
          }
          nextFileCount = countFiles(state.files);
          const snapshotFiles = toPlainFilesSnapshot(state.files);
          snapshotData = {
            version: CURRENT_VAULT_DATA_VERSION,
            files: snapshotFiles,
            activeFileId: state.activeFileId,
            openFileIds: [...state.openFileIds],
            selectedFolderId: state.selectedFolderId,
          };
        });
        if (snapshotData) persistVaultDataDebounced(currentVaultId, snapshotData);
        (async () => {
          try {
            const regRaw = await get<unknown>(VAULTS_REGISTRY_KEY);
            if (!regRaw || typeof regRaw !== 'object') return;
            const rr = regRaw as any;
            if (!Array.isArray(rr.vaults)) return;
            const now = Date.now();
            const nextVaults = (rr.vaults as VaultMeta[]).map((v) =>
              v.id === currentVaultId ? { ...v, fileCount: nextFileCount, lastAccessed: now } : v
            );
            const nextRegistry: VaultRegistryV1 = {
              version: CURRENT_REGISTRY_VERSION,
              currentVaultId: currentVaultId,
              vaults: nextVaults,
            };
            await persistRegistry(nextRegistry);
            set((state) => {
              state.vaults = nextVaults;
            });
          } catch (err) {
            console.error('Failed to update registry after importVault:', err);
          }
        })();
      },
      restoreHistory: (fileId: string, content: string) => {
        const currentVaultId = get().currentVaultId;
        let snapshotData: VaultDataV2 | null = null;
        set((state) => {
          const file = state.files[fileId];
          if (!file || file.type !== 'file') return;
          file.content = content;
          file.updatedAt = Date.now();
          const snapshotFiles = toPlainFilesSnapshot(state.files);
          snapshotData = {
            version: CURRENT_VAULT_DATA_VERSION,
            files: snapshotFiles,
            activeFileId: state.activeFileId,
            openFileIds: [...state.openFileIds],
            selectedFolderId: state.selectedFolderId,
          };
        });
        if (snapshotData) persistVaultDataDebounced(currentVaultId, snapshotData);
      },
    },
  }))
);
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { get, set as idbSet } from 'idb-keyval';
import { DEFAULT_FILES, STORAGE_KEY } from '@/lib/constants';
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
interface VaultState {
  files: Record<string, FileItem>;
  activeFileId: string | null;
  openFileIds: string[];
  selectedFolderId: string | 'root';
  initialized: boolean;
  actions: {
    init: () => Promise<void>;
    createFile: (name: string, parentId?: string) => void;
    createFolder: (name: string, parentId?: string) => void;
    updateFileContent: (id: string, content: string) => void;
    deleteItem: (id: string) => void;
    renameItem: (id: string, name: string) => void;
    setActiveFile: (id: string | null) => void;
    closeFile: (id: string) => void;
    setFolderFocus: (id: string | 'root') => void;
    importVault: (incomingFiles: Record<string, FileItem>) => void;
    restoreHistory: (fileId: string, content: string) => void;
  };
}
const CURRENT_VERSION = 2;
const sanitizeFiles = (files: Record<string, FileItem>): Record<string, FileItem> =>
  Object.fromEntries(
    Object.entries(files)
      .filter(([id, v]) => id === v.id)
      .map(([id, item]) => [
        id,
        {
          ...item,
          content: item.content ?? '',
          parentId: item.parentId ?? 'root',
          history: item.history ?? []
        }
      ])
  );
let debounceTimer: ReturnType<typeof setTimeout>;
const persistToIDB = (files: Record<string, FileItem>) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const sanitizedFiles = sanitizeFiles(files);
    await idbSet(STORAGE_KEY, { version: CURRENT_VERSION, files: sanitizedFiles });
  }, 500);
};
export const useVaultStore = create<VaultState>()(
  immer((set) => ({
    files: {},
    activeFileId: null,
    openFileIds: [],
    selectedFolderId: 'root',
    initialized: false,
    actions: {
      init: async () => {
        const raw = await get<any>(STORAGE_KEY);
        if (raw) {
          const sanitized = sanitizeFiles(raw.files || raw);
          set((state) => {
            state.files = sanitized;
            state.initialized = true;
            const firstId = Object.keys(sanitized).find(id => sanitized[id].type === 'file');
            if (firstId) {
              state.activeFileId = firstId;
              state.openFileIds = [firstId];
            }
          });
        } else {
          const initialFiles: Record<string, FileItem> = {};
          DEFAULT_FILES.forEach(f => {
            initialFiles[f.id] = { ...f, history: [] };
          });
          await idbSet(STORAGE_KEY, { version: CURRENT_VERSION, files: initialFiles });
          set((state) => {
            state.files = initialFiles;
            state.activeFileId = "welcome-md";
            state.openFileIds = ["welcome-md"];
            state.initialized = true;
          });
        }
      },
      createFile: (name, parentId) => {
        set((state) => {
          const id = crypto.randomUUID();
          const pId = parentId || state.selectedFolderId;
          const newItem: FileItem = {
            id,
            name: name.endsWith('.md') ? name : `${name}.md`,
            type: 'file',
            content: '',
            parentId: pId,
            updatedAt: Date.now(),
            history: []
          };
          state.files[id] = newItem;
          state.activeFileId = id;
          if (!state.openFileIds.includes(id)) state.openFileIds.push(id);
          persistToIDB(state.files);
        });
      },
      createFolder: (name, parentId) => {
        set((state) => {
          const id = crypto.randomUUID();
          const pId = parentId || state.selectedFolderId;
          state.files[id] = {
            id,
            name,
            type: 'folder',
            parentId: pId,
            updatedAt: Date.now(),
            history: []
          };
          state.selectedFolderId = id;
          persistToIDB(state.files);
        });
      },
      updateFileContent: (id, content) => {
        set((state) => {
          const file = state.files[id];
          if (file) {
            if (file.content !== content) {
              const history = file.history || [];
              const lastEntry = history[history.length - 1];
              if (!lastEntry || (Date.now() - lastEntry.timestamp > 60000)) {
                history.push({ content: file.content || '', timestamp: Date.now() });
                if (history.length > 5) history.shift();
              }
              file.content = content;
              file.history = history;
              file.updatedAt = Date.now();
              persistToIDB(state.files);
            }
          }
        });
      },
      deleteItem: (id) => {
        set((state) => {
          delete state.files[id];
          state.openFileIds = state.openFileIds.filter(oid => oid !== id);
          if (state.activeFileId === id) state.activeFileId = state.openFileIds[0] || null;
          if (state.selectedFolderId === id) state.selectedFolderId = 'root';
          const cleanupChildren = (parentId: string) => {
            Object.keys(state.files).forEach(key => {
              if (state.files[key].parentId === parentId) {
                delete state.files[key];
                state.openFileIds = state.openFileIds.filter(oid => oid !== key);
                cleanupChildren(key);
              }
            });
          };
          cleanupChildren(id);
          persistToIDB(state.files);
        });
      },
      renameItem: (id, name) => {
        set((state) => {
          if (state.files[id]) {
            state.files[id].name = name;
            state.files[id].updatedAt = Date.now();
            persistToIDB(state.files);
          }
        });
      },
      setActiveFile: (id) => {
        set((state) => {
          state.activeFileId = id;
          if (id && !state.openFileIds.includes(id)) state.openFileIds.push(id);
        });
      },
      closeFile: (id) => {
        set((state) => {
          state.openFileIds = state.openFileIds.filter(oid => oid !== id);
          if (state.activeFileId === id) state.activeFileId = state.openFileIds[state.openFileIds.length - 1] || null;
        });
      },
      setFolderFocus: (id) => {
        set((state) => { state.selectedFolderId = id; });
      },
      importVault: (incomingFiles) => {
        set((state) => {
          state.files = { ...state.files, ...sanitizeFiles(incomingFiles) };
          persistToIDB(state.files);
        });
      },
      restoreHistory: (fileId, content) => {
        set((state) => {
          if (state.files[fileId]) {
            state.files[fileId].content = content;
            state.files[fileId].updatedAt = Date.now();
            persistToIDB(state.files);
          }
        });
      }
    }
  }))
);
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { get, set as idbSet } from 'idb-keyval';
import { DEFAULT_FILES, STORAGE_KEY } from '@/lib/constants';
export type FileType = 'file' | 'folder';
export interface FileItem {
  id: string;
  name: string;
  type: FileType;
  content?: string;
  parentId: string | 'root';
  updatedAt: number;
}
interface VaultState {
  files: Record<string, FileItem>;
  activeFileId: string | null;
  openFileIds: string[];
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
  };
}
let debounceTimer: ReturnType<typeof setTimeout>;
const persistToIDB = (files: Record<string, FileItem>) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    await idbSet(STORAGE_KEY, files);
  }, 500);
};
export const useVaultStore = create<VaultState>()(
  immer((set) => ({
    files: {},
    activeFileId: null,
    openFileIds: [],
    initialized: false,
    actions: {
      init: async () => {
        const stored = await get<Record<string, FileItem>>(STORAGE_KEY);
        if (stored && Object.keys(stored).length > 0) {
          set((state) => {
            state.files = stored;
            state.initialized = true;
            // Restore open files from the first available file if none set
            const firstId = Object.keys(stored).find(id => stored[id].type === 'file');
            if (firstId) {
              state.activeFileId = firstId;
              state.openFileIds = [firstId];
            }
          });
        } else {
          const initialFiles: Record<string, FileItem> = {};
          DEFAULT_FILES.forEach(f => initialFiles[f.id] = f);
          await idbSet(STORAGE_KEY, initialFiles);
          set((state) => {
            state.files = initialFiles;
            state.activeFileId = "welcome-md";
            state.openFileIds = ["welcome-md"];
            state.initialized = true;
          });
        }
      },
      createFile: (name, parentId = 'root') => {
        set((state) => {
          const id = crypto.randomUUID();
          const newItem: FileItem = {
            id,
            name: name.endsWith('.md') ? name : `${name}.md`,
            type: 'file',
            content: '',
            parentId,
            updatedAt: Date.now(),
          };
          state.files[id] = newItem;
          state.activeFileId = id;
          if (!state.openFileIds.includes(id)) {
            state.openFileIds.push(id);
          }
          persistToIDB(state.files);
        });
      },
      createFolder: (name, parentId = 'root') => {
        set((state) => {
          const id = crypto.randomUUID();
          state.files[id] = {
            id,
            name,
            type: 'folder',
            parentId,
            updatedAt: Date.now(),
          };
          persistToIDB(state.files);
        });
      },
      updateFileContent: (id, content) => {
        set((state) => {
          if (state.files[id]) {
            state.files[id].content = content;
            state.files[id].updatedAt = Date.now();
            persistToIDB(state.files);
          }
        });
      },
      deleteItem: (id) => {
        set((state) => {
          delete state.files[id];
          state.openFileIds = state.openFileIds.filter(oid => oid !== id);
          if (state.activeFileId === id) {
            state.activeFileId = state.openFileIds[0] || null;
          }
          // Cleanup children
          Object.keys(state.files).forEach(key => {
            if (state.files[key].parentId === id) {
              delete state.files[key];
              state.openFileIds = state.openFileIds.filter(oid => oid !== key);
            }
          });
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
          if (id && !state.openFileIds.includes(id)) {
            state.openFileIds.push(id);
          }
        });
      },
      closeFile: (id) => {
        set((state) => {
          state.openFileIds = state.openFileIds.filter(oid => oid !== id);
          if (state.activeFileId === id) {
            state.activeFileId = state.openFileIds[state.openFileIds.length - 1] || null;
          }
        });
      },
    },
  }))
);
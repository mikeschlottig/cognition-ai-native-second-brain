import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { get, set } from 'idb-keyval';
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
  initialized: boolean;
  actions: {
    init: () => Promise<void>;
    createFile: (name: string, parentId?: string) => void;
    createFolder: (name: string, parentId?: string) => void;
    updateFileContent: (id: string, content: string) => void;
    deleteItem: (id: string) => void;
    renameItem: (id: string, name: string) => void;
    setActiveFile: (id: string | null) => void;
  };
}
const persistToIDB = async (files: Record<string, FileItem>) => {
  await set(STORAGE_KEY, files);
};
export const useVaultStore = create<VaultState>()(
  immer((set) => ({
    files: {},
    activeFileId: null,
    initialized: false,
    actions: {
      init: async () => {
        const stored = await get<Record<string, FileItem>>(STORAGE_KEY);
        if (stored) {
          set((state) => {
            state.files = stored;
            state.initialized = true;
          });
        } else {
          const initialFiles: Record<string, FileItem> = {};
          DEFAULT_FILES.forEach(f => initialFiles[f.id] = f);
          await persistToIDB(initialFiles);
          set((state) => {
            state.files = initialFiles;
            state.activeFileId = "welcome-md";
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
          if (state.activeFileId === id) state.activeFileId = null;
          // Clean up children if it's a folder
          Object.keys(state.files).forEach(key => {
            if (state.files[key].parentId === id) delete state.files[key];
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
        });
      },
    },
  }))
);
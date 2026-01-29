import JSZip from 'jszip';
import { get } from 'idb-keyval';
import type { FileItem } from '@/stores/vaultStore';
import { STORAGE_KEY } from '@/lib/constants';
type VaultZipParams =
  | { files: Record<string, FileItem>; vaultName?: string }
  | { vaultId: string; vaultName?: string };
const vaultKey = (vaultId: string) => `${STORAGE_KEY}${vaultId}`;
const sanitizeImportedFiles = (files: unknown): Record<string, FileItem> => {
  if (!files || typeof files !== 'object') return {};
  const record = files as Record<string, any>;
  const out: Record<string, FileItem> = {};
  for (const id of Object.keys(record)) {
    const v = record[id];
    if (!v || typeof v !== 'object') continue;
    const itemId = typeof v.id === 'string' ? v.id : id;
    if (id !== itemId) continue;
    const type = v.type === 'folder' ? 'folder' : 'file';
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
const getPath = (files: Record<string, FileItem>, id: string): string => {
  const item = files[id];
  if (!item) return '';
  if (item.parentId === 'root') return item.name;
  if (typeof item.parentId !== 'string') return item.name;
  const parent = files[item.parentId];
  if (!parent) return item.name;
  const parentPath = getPath(files, parent.id);
  return parentPath ? `${parentPath}/${item.name}` : item.name;
};
const buildFilesFromZip = async (zip: JSZip): Promise<Record<string, FileItem>> => {
  // ZIP import format:
  // - folders inferred from path
  // - markdown files become 'file' entries
  const files: Record<string, FileItem> = {};
  const folderIdByPath = new Map<string, string>();
  folderIdByPath.set('', 'root');
  const ensureFolder = (path: string): string => {
    const normalized = path.replace(/\/+$/, '');
    if (!normalized) return 'root';
    const existing = folderIdByPath.get(normalized);
    if (existing) return existing;
    const parts = normalized.split('/').filter(Boolean);
    let currentPath = '';
    let currentParentId = 'root';
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const maybe = folderIdByPath.get(currentPath);
      if (maybe) {
        currentParentId = maybe;
        continue;
      }
      const id = crypto.randomUUID();
      files[id] = {
        id,
        name: part,
        type: 'folder',
        parentId: currentParentId,
        updatedAt: Date.now(),
        history: [],
      };
      folderIdByPath.set(currentPath, id);
      currentParentId = id;
    }
    return folderIdByPath.get(normalized) || 'root';
  };
  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) {
      ensureFolder(entry.name);
      continue;
    }
    const isMarkdown = /\.md$/i.test(entry.name);
    if (!isMarkdown) continue;
    const content = await entry.async('string');
    const segments = entry.name.split('/').filter(Boolean);
    const filename = segments[segments.length - 1] || 'Untitled.md';
    const dir = segments.slice(0, -1).join('/');
    const parentId = ensureFolder(dir);
    const id = crypto.randomUUID();
    files[id] = {
      id,
      name: filename,
      type: 'file',
      content,
      parentId,
      updatedAt: Date.now(),
      history: [],
    };
  }
  return files;
};
export async function generateVaultZip(params: VaultZipParams): Promise<Blob> {
  let files: Record<string, FileItem> | null = null;
  let vaultName: string | undefined;
  if ('files' in params) {
    files = params.files;
    vaultName = params.vaultName;
  } else {
    vaultName = params.vaultName;
    const raw = await get<any>(vaultKey(params.vaultId));
    const rawFiles = raw?.files ?? raw;
    files = sanitizeImportedFiles(rawFiles);
  }
  const zip = new JSZip();
  const name = (vaultName || 'vault').trim() || 'vault';
  zip.file('cognition-vault.json', JSON.stringify({ version: 2, vaultName: name, files }, null, 2));
  Object.values(files).forEach((file) => {
    if (file.type !== 'file') return;
    const path = getPath(files!, file.id);
    const normalized = path.endsWith('.md') ? path : `${path}.md`;
    zip.file(normalized, file.content || '');
  });
  return zip.generateAsync({ type: 'blob' });
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
export async function parseVaultImport(file: File): Promise<{ vaultName?: string; files: Record<string, FileItem> }> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    // Prefer explicit cognition-vault.json if present
    const manifestEntry = zip.file('cognition-vault.json') || zip.file('vault.json');
    if (manifestEntry) {
      const text = await manifestEntry.async('string');
      const data = JSON.parse(text);
      const incomingFiles = sanitizeImportedFiles(data?.files ?? data);
      const vaultName = typeof data?.vaultName === 'string' ? data.vaultName : undefined;
      if (Object.keys(incomingFiles).length === 0) {
        // fallback: build from .md entries
        const built = await buildFilesFromZip(zip);
        return { vaultName, files: built };
      }
      return { vaultName, files: incomingFiles };
    }
    // Otherwise: import markdown filesystem directly
    const files = await buildFilesFromZip(zip);
    return { vaultName: undefined, files };
  }
  if (lower.endsWith('.json')) {
    const text = await file.text();
    const data = JSON.parse(text);
    const incomingFiles = sanitizeImportedFiles(data?.files ?? data);
    const vaultName = typeof data?.vaultName === 'string' ? data.vaultName : undefined;
    if (Object.keys(incomingFiles).length === 0) {
      throw new Error('No files found in JSON import');
    }
    return { vaultName, files: incomingFiles };
  }
  throw new Error('Unsupported import type. Please provide a .zip or .json export.');
}
export function countVaultFiles(files: Record<string, FileItem>): number {
  return Object.values(files).reduce((acc, f) => (f.type === 'file' ? acc + 1 : acc), 0);
}
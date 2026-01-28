import JSZip from 'jszip';
import type { FileItem } from '@/stores/vaultStore';
export async function generateVaultZip(files: Record<string, FileItem>): Promise<Blob> {
  const zip = new JSZip();
  const getPath = (id: string): string => {
    const item = files[id];
    if (!item || item.parentId === 'root') return item?.name || '';
    return `${getPath(item.parentId)}/${item.name}`;
  };
  Object.values(files).forEach(file => {
    if (file.type === 'file') {
      const path = getPath(file.id);
      zip.file(path.endsWith('.md') ? path : `${path}.md`, file.content || "");
    } else {
      const path = getPath(file.id);
      zip.folder(path);
    }
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
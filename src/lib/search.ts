import { Document } from 'flexsearch';
import type { FileItem } from '@/stores/vaultStore';
const index = new Document({
  document: {
    id: "id",
    index: ["name", "content"],
    store: ["id", "name"]
  },
  tokenize: "forward",
  cache: true
});
export function indexVault(files: Record<string, FileItem>) {
  Object.values(files).forEach(file => {
    if (file.type === 'file') {
      index.add({
        id: file.id,
        name: file.name,
        content: file.content || ""
      });
    }
  });
}
export function fuzzySearch(query: string) {
  return index.search(query, {
    limit: 10,
    enrich: true,
    suggest: true
  });
}
/**
 * getRelevantContext - Simulates TF-IDF style ranking for AI context
 */
export function getRelevantContext(query: string, files: Record<string, FileItem>, currentFileId: string | null): string {
  const words = query.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const results: { id: string; score: number }[] = [];
  Object.values(files).forEach(file => {
    if (file.type !== 'file' || file.id === currentFileId) return;
    let score = 0;
    const content = (file.name + " " + (file.content || "")).toLowerCase();
    words.forEach(word => {
      const regex = new RegExp(word, 'g');
      const matches = content.match(regex);
      if (matches) score += matches.length;
    });
    if (score > 0) results.push({ id: file.id, score });
  });
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(r => `NOTE: ${files[r.id].name}\nCONTENT:\n${files[r.id].content?.slice(0, 1000)}`)
    .join("\n\n---\n\n");
}
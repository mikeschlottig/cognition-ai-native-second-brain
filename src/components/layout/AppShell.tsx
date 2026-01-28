import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { FileExplorer } from '@/components/sidebar/FileExplorer';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { AssistantPanel } from '@/components/ai/AssistantPanel';
import { UI_CONFIG } from '@/lib/constants';
import { useVaultStore } from '@/stores/vaultStore';
import { cn } from '@/lib/utils';
function formatClockTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    console.error('Failed to format time:', e);
    return '—';
  }
}
function countWords(text: string): number {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}
function buildFilePath(files: Record<string, { id: string; name: string; parentId: string | 'root' }>, fileId: string): string {
  const visited = new Set<string>();
  const parts: string[] = [];
  let currentId: string | null = fileId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const item = files[currentId];
    if (!item) break;
    parts.unshift(item.name);
    const parentId = item.parentId;
    if (!parentId || parentId === 'root') break;
    currentId = parentId;
  }
  return parts.length ? parts.join(' / ') : 'Root';
}
export function AppShell() {
  const files = useVaultStore((s) => s.files);
  const activeFileId = useVaultStore((s) => s.activeFileId);
  const currentVaultId = useVaultStore((s) => s.currentVaultId);
  const activeFile = activeFileId ? files[activeFileId] : null;
  const wordCount = useMemo(() => countWords(activeFile?.content || ''), [activeFile?.content]);
  const fileTypeLabel = useMemo(() => {
    if (!activeFile) return '—';
    const name = activeFile.name || '';
    if (/\.md$/i.test(name)) return 'Markdown';
    const idx = name.lastIndexOf('.');
    if (idx > 0 && idx < name.length - 1) return name.slice(idx + 1).toUpperCase();
    return 'Note';
  }, [activeFile]);
  const filePath = useMemo(() => {
    if (!activeFileId) return 'Root';
    return buildFilePath(files as any, activeFileId);
  }, [files, activeFileId]);
  // "Last Saved" indicator approximation:
  // vaultStore persists to IndexedDB with a ~500ms debounce. We mirror that to give user feedback.
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    // On vault switch, reset save state (prevents misleading "Saved" flicker for new vault)
    setIsSaving(false);
    setLastSavedAt(null);
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, [currentVaultId]);
  useEffect(() => {
    // Any change to files indicates "dirty", then "saved" after debounce window.
    setIsSaving(true);
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveTimerRef.current = window.setTimeout(() => {
      setIsSaving(false);
      setLastSavedAt(Date.now());
      saveTimerRef.current = null;
    }, 650);
    return () => {
      // Avoid setState after unmount
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [files]);
  const lastSavedLabel = useMemo(() => {
    if (isSaving) return 'Saving…';
    if (!lastSavedAt) return 'Saved';
    return `Saved ${formatClockTime(lastSavedAt)}`;
  }, [isSaving, lastSavedAt]);
  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      <PanelGroup direction="horizontal">
        <Panel
          defaultSize={20}
          minSize={UI_CONFIG.MIN_PANEL_SIZE}
          className="bg-sidebar border-r border-border/40"
        >
          <FileExplorer />
        </Panel>
        <PanelResizeHandle className="w-px bg-border/40 hover:bg-primary/40 transition-colors" />
        <Panel defaultSize={55} minSize={30}>
          <MarkdownEditor />
        </Panel>
        <PanelResizeHandle className="w-px bg-border/40 hover:bg-primary/40 transition-colors" />
        <Panel
          defaultSize={25}
          minSize={UI_CONFIG.MIN_PANEL_SIZE}
          className="hidden md:block"
        >
          <AssistantPanel />
        </Panel>
      </PanelGroup>
      {/* Status Bar */}
      <footer className="h-7 bg-muted/50 border-t border-border/60 flex items-center justify-between px-3 text-[10px] text-muted-foreground font-mono">
        <div className="flex items-center gap-4 min-w-0">
          <span className="text-foreground/70">LOCAL VAULT</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline truncate max-w-[40vw]" title={filePath}>
            {filePath || 'Root'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="tabular-nums">{wordCount} words</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">{fileTypeLabel}</span>
          <span className="hidden sm:inline">•</span>
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isSaving ? "bg-primary shadow-[0_0_10px_rgba(124,58,237,0.55)] animate-pulse" : "bg-green-500/80"
              )}
              aria-hidden="true"
            />
            <span>{lastSavedLabel}</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
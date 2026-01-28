import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { useVaultStore } from '@/stores/vaultStore';
import { useTheme } from '@/hooks/use-theme';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { Download, Eye, FileJson, History, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditorTabs } from './EditorTabs';
import { PreviewPane } from './PreviewPane';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
function countLines(text: string): number {
  if (!text) return 1;
  return text.split('\n').length;
}
export function MarkdownEditor() {
  const activeFileId = useVaultStore((s) => s.activeFileId);
  const files = useVaultStore((s) => s.files);
  const updateFileContent = useVaultStore((s) => s.actions.updateFileContent);
  const restoreHistory = useVaultStore((s) => s.actions.restoreHistory);
  const createFile = useVaultStore((s) => s.actions.createFile);
  const { isDark } = useTheme();
  const activeFile = activeFileId ? files[activeFileId] : null;
  const [localContent, setLocalContent] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  useEffect(() => {
    if (activeFileId) {
      setLocalContent(activeFile?.content ?? '');
    }
  }, [activeFileId, activeFile?.content]);
  const onChange = useCallback(
    (value: string) => {
      setLocalContent(value);
      if (activeFileId) updateFileContent(activeFileId, value);
    },
    [activeFileId, updateFileContent]
  );
  const handleExport = () => {
    if (!activeFile) return;
    const blob = new Blob([localContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };
  const charCount = useMemo(() => (localContent || '').length, [localContent]);
  const lineCount = useMemo(() => countLines(localContent || ''), [localContent]);
  const historyCount = activeFile?.history?.length ?? 0;
  const hasHistory = historyCount > 0;
  if (!activeFileId || !activeFile) {
    return (
      <div className="h-full flex flex-col bg-background">
        <EditorTabs />
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground px-6">
          <div className="w-full max-w-md border border-border/50 rounded-3xl bg-gradient-to-b from-muted/20 to-background p-8">
            <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <FileJson className="w-7 h-7 text-primary/70" />
            </div>
            <h3 className="text-base font-semibold text-foreground text-center">No active note</h3>
            <p className="mt-2 text-xs text-muted-foreground text-center leading-relaxed">
              Create a note, capture an idea, and start building connections.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                onClick={() => createFile('New Note')}
                className="w-full gap-2"
                aria-label="Create a new note"
              >
                <Plus className="h-4 w-4" />
                Create Note
              </Button>
              <div className="text-[10px] text-muted-foreground text-center">
                Tip: Use folders to organize projects and topics.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <EditorTabs />
      <div className="px-6 py-3 border-b border-border/40 flex items-center justify-between bg-muted/10">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="text-[10px] font-mono text-primary px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 uppercase tracking-widest">
            MD
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{activeFile.name}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground font-mono flex items-center gap-2">
              <span className="tabular-nums">{charCount} chars</span>
              <span className="opacity-60">•</span>
              <span className="tabular-nums">{lineCount} lines</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasHistory ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-[10px] gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  HISTORY
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
                  Version Snapshots
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[...(activeFile.history || [])].reverse().map((h, i) => (
                  <DropdownMenuItem
                    key={`${h.timestamp}-${i}`}
                    onClick={() => restoreHistory(activeFileId, h.content)}
                    className="flex justify-between items-center text-xs"
                  >
                    <span className="truncate">{new Date(h.timestamp).toLocaleString()}</span>
                    <RotateCcw className="w-3 h-3 text-muted-foreground" />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" className="h-8 text-[10px] gap-1.5" disabled title="No snapshots yet">
              <History className="w-3.5 h-3.5" />
              HISTORY
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPreviewOpen(!isPreviewOpen)}
            className={cn("h-8 text-[10px] gap-1.5", isPreviewOpen && "bg-primary/10 text-primary")}
          >
            <Eye className="w-3.5 h-3.5" />
            PREVIEW
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExport} className="h-8 text-[10px] gap-1.5">
            <Download className="w-3.5 h-3.5" />
            EXPORT
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={isPreviewOpen ? 50 : 100}>
            <div className="h-full bg-[#ffffff] dark:bg-[#0d1117]">
              <CodeMirror
                value={localContent}
                height="100%"
                theme={isDark ? githubDark : githubLight}
                extensions={[markdown({ base: markdownLanguage })]}
                onChange={onChange}
                basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: true }}
                className="text-base font-mono h-full"
                spellCheck
              />
            </div>
          </Panel>
          {isPreviewOpen && (
            <>
              <PanelResizeHandle className="w-px bg-border/40 hover:bg-primary/40 transition-colors" />
              <Panel defaultSize={50}>
                <PreviewPane content={localContent} />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}
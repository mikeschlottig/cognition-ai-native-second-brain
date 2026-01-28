import React, { useCallback, useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { useVaultStore } from '@/stores/vaultStore';
import { useTheme } from '@/hooks/use-theme';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { Sparkles, Download, FileJson, Eye, History, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditorTabs } from './EditorTabs';
import { PreviewPane } from './PreviewPane';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
export function MarkdownEditor() {
  const activeFileId = useVaultStore((s) => s.activeFileId);
  const files = useVaultStore((s) => s.files);
  const updateFileContent = useVaultStore((s) => s.actions.updateFileContent);
  const restoreHistory = useVaultStore((s) => s.actions.restoreHistory);
  const { isDark } = useTheme();
  const activeFile = activeFileId ? files[activeFileId] : null;
  const [localContent, setLocalContent] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  useEffect(() => {
    if (activeFileId) {
      setLocalContent(activeFile?.content ?? '');
    }
  }, [activeFileId, activeFile?.content]);
  const onChange = useCallback((value: string) => {
    setLocalContent(value);
    if (activeFileId) updateFileContent(activeFileId, value);
  }, [activeFileId, updateFileContent]);
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
  if (!activeFileId || !activeFile) {
    return (
      <div className="h-full flex flex-col bg-background">
        <EditorTabs />
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <div className="text-center p-8 border border-dashed border-border rounded-2xl max-w-sm bg-muted/5">
            <FileJson className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-foreground mb-1">No Active Note</h3>
            <p className="text-xs">Create a new note or select one from the explorer to begin synthesis.</p>
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
          <span className="text-[10px] font-mono text-primary px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 uppercase tracking-widest">MD</span>
          <span className="text-sm font-medium truncate">{activeFile.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 text-[10px] gap-1.5"><History className="w-3.5 h-3.5" />HISTORY</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Version Snapshots</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {activeFile.history?.length ? activeFile.history.map((h, i) => (
                <DropdownMenuItem key={i} onClick={() => restoreHistory(activeFileId, h.content)} className="flex justify-between items-center text-xs">
                  <span>{new Date(h.timestamp).toLocaleString()}</span>
                  <RotateCcw className="w-3 h-3 text-muted-foreground" />
                </DropdownMenuItem>
              )).reverse() : <p className="p-2 text-[10px] text-muted-foreground text-center">No snapshots yet</p>}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" onClick={() => setIsPreviewOpen(!isPreviewOpen)} className={cn("h-8 text-[10px] gap-1.5", isPreviewOpen && "bg-primary/10 text-primary")}>
            <Eye className="w-3.5 h-3.5" />PREVIEW
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExport} className="h-8 text-[10px] gap-1.5"><Download className="w-3.5 h-3.5" />EXPORT</Button>
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
              <Panel defaultSize={50}><PreviewPane content={localContent} /></Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}
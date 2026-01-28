import React, { useCallback, useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { useVaultStore } from '@/stores/vaultStore';
import { useTheme } from '@/hooks/use-theme';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { Sparkles, Download, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditorTabs } from './EditorTabs';
export function MarkdownEditor() {
  const activeFileId = useVaultStore((s) => s.activeFileId);
  const files = useVaultStore((s) => s.files);
  const updateFileContent = useVaultStore((s) => s.actions.updateFileContent);
  const { isDark } = useTheme();
  const activeFile = activeFileId ? files[activeFileId] : null;
  const [localContent, setLocalContent] = useState('');
  useEffect(() => {
    if (activeFileId && activeFile?.content !== undefined) {
      setLocalContent(activeFile.content);
    }
  }, [activeFileId, activeFile?.content]);
  const onChange = useCallback((value: string) => {
    setLocalContent(value);
    if (activeFileId) {
      updateFileContent(activeFileId, value);
    }
  }, [activeFileId, updateFileContent]);
  const handleExport = () => {
    if (!activeFile) return;
    const blob = new Blob([localContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          <span className="hidden sm:inline text-[10px] text-muted-foreground opacity-60 mr-2">
            {activeFile.updatedAt ? `Saved ${new Date(activeFile.updatedAt).toLocaleTimeString()}` : ''}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleExport}
            className="h-8 text-[10px] gap-1.5 hover:bg-secondary transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-[10px] gap-1.5 hover:bg-primary/10 hover:text-primary transition-colors">
            <Sparkles className="w-3.5 h-3.5" />
            ANALYZE
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-[#ffffff] dark:bg-[#0d1117]">
        <CodeMirror
          value={localContent}
          height="100%"
          theme={isDark ? githubDark : githubLight}
          extensions={[markdown({ base: markdownLanguage })]}
          onChange={onChange}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: true,
          }}
          className="text-base font-mono h-full selection:bg-primary/20"
        />
      </div>
    </div>
  );
}
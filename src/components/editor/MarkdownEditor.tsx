import React, { useCallback, useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { useVaultStore } from '@/stores/vaultStore';
import { useTheme } from '@/hooks/use-theme';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function MarkdownEditor() {
  const activeFileId = useVaultStore((s) => s.activeFileId);
  const files = useVaultStore((s) => s.files);
  const updateFileContent = useVaultStore((s) => s.actions.updateFileContent);
  const { isDark } = useTheme();
  const activeFile = activeFileId ? files[activeFileId] : null;
  const fileName = activeFile?.name;
  const lastUpdated = activeFile?.updatedAt;
  const initialContent = activeFile?.content;
  const [localContent, setLocalContent] = useState('');
  useEffect(() => {
    if (activeFileId && initialContent !== undefined) {
      setLocalContent(initialContent);
    }
  }, [activeFileId, initialContent]);
  const onChange = useCallback((value: string) => {
    setLocalContent(value);
    if (activeFileId) {
      updateFileContent(activeFileId, value);
    }
  }, [activeFileId, updateFileContent]);
  if (!activeFileId || !activeFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-background">
        <div className="text-center p-8 border border-dashed border-border rounded-xl max-w-sm">
          <p className="text-sm">Select or create a file to start your journey.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="px-6 py-3 border-b border-border/40 flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="text-[10px] font-mono text-primary px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 uppercase tracking-widest">MD</span>
          <span className="text-sm font-medium truncate">{fileName}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-[10px] text-muted-foreground opacity-60">
            {lastUpdated ? `Saved ${new Date(lastUpdated).toLocaleTimeString()}` : ''}
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 hover:bg-primary/10 hover:text-primary transition-colors">
            <Sparkles className="w-3 h-3" />
            ANALYZE
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
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
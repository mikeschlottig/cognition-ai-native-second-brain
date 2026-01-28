import React, { useCallback, useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { useVaultStore } from '@/stores/vaultStore';
import { useTheme } from '@/hooks/use-theme';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
export function MarkdownEditor() {
  const activeFileId = useVaultStore((s) => s.activeFileId);
  const files = useVaultStore((s) => s.files);
  const actions = useVaultStore((s) => s.actions);
  const { isDark } = useTheme();
  const activeFile = activeFileId ? files[activeFileId] : null;
  const [localContent, setLocalContent] = useState('');
  useEffect(() => {
    if (activeFile) {
      setLocalContent(activeFile.content || '');
    }
  }, [activeFileId]);
  const onChange = useCallback((value: string) => {
    setLocalContent(value);
    if (activeFileId) {
      actions.updateFileContent(activeFileId, value);
    }
  }, [activeFileId, actions]);
  if (!activeFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-background">
        <div className="text-center p-8 border border-dashed border-border rounded-xl">
          <p className="text-sm">Select a file to start writing</p>
        </div>
      </div>
    );
  }
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="px-6 py-3 border-b border-border/40 flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xs font-mono text-muted-foreground opacity-50 uppercase tracking-widest">Editing</span>
          <span className="text-sm font-medium truncate">{activeFile.name}</span>
        </div>
        <span className="text-[10px] text-muted-foreground opacity-60">
          Last saved: {new Date(activeFile.updatedAt).toLocaleTimeString()}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={localContent}
          height="100%"
          theme={isDark ? githubDark : githubLight}
          extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
          onChange={onChange}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: true,
          }}
          className="text-base font-mono h-full"
        />
      </div>
    </div>
  );
}
import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { FileExplorer } from '@/components/sidebar/FileExplorer';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { AssistantPanel } from '@/components/ai/AssistantPanel';
import { UI_CONFIG } from '@/lib/constants';
export function AppShell() {
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
      <footer className="h-6 bg-muted/30 border-t border-border/40 flex items-center justify-between px-3 text-[10px] text-muted-foreground font-mono">
        <div className="flex items-center gap-4">
          <span>LOCAL VAULT</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-4">
          <span>COGNITION v1.0.0</span>
          <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
        </div>
      </footer>
    </div>
  );
}
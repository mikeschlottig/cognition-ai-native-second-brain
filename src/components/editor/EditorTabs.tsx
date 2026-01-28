import React from 'react';
import { X, FileText } from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
export function EditorTabs() {
  const openFileIds = useVaultStore((s) => s.openFileIds);
  const activeFileId = useVaultStore((s) => s.activeFileId);
  const files = useVaultStore((s) => s.files);
  const setActiveFile = useVaultStore((s) => s.actions.setActiveFile);
  const closeFile = useVaultStore((s) => s.actions.closeFile);
  if (openFileIds.length === 0) return null;
  return (
    <div className="w-full bg-muted/20 border-b border-border/40">
      <ScrollArea className="w-full">
        <div className="flex items-center h-10 px-2 gap-px">
          {openFileIds.map((id) => {
            const file = files[id];
            if (!file) return null;
            const isActive = activeFileId === id;
            return (
              <div
                key={id}
                onClick={() => setActiveFile(id)}
                className={cn(
                  "group relative flex items-center gap-2 h-full min-w-[120px] max-w-[200px] px-3 cursor-pointer transition-all border-r border-border/20",
                  isActive 
                    ? "bg-background text-primary" 
                    : "text-muted-foreground hover:bg-muted/40"
                )}
              >
                <FileText className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground/50")} />
                <span className="text-[11px] font-medium truncate flex-1">{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeFile(id);
                  }}
                  className={cn(
                    "p-0.5 rounded-sm hover:bg-muted transition-colors opacity-0 group-hover:opacity-100",
                    isActive && "opacity-100"
                  )}
                >
                  <X className="w-3 h-3" />
                </button>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>
    </div>
  );
}
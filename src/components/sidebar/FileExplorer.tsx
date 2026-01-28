import React, { useState } from 'react';
import { FolderPlus, FilePlus, ChevronRight, ChevronDown, FileText, Folder, Trash2, Edit2, MoreVertical } from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
export function FileExplorer() {
  const files = useVaultStore((s) => s.files);
  const activeFileId = useVaultStore((s) => s.activeFileId);
  const actions = useVaultStore((s) => s.actions);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });
  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const renderTree = (parentId: string = 'root') => {
    const children = Object.values(files).filter((f) => f.parentId === parentId);
    return children.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1)).map((item) => (
      <div key={item.id} className="select-none">
        <div
          className={cn(
            "group flex items-center gap-2 px-2 py-1 text-sm rounded-md cursor-pointer transition-colors",
            activeFileId === item.id ? "bg-accent text-accent-foreground" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
          )}
          onClick={() => item.type === 'file' ? actions.setActiveFile(item.id) : toggleExpand(item.id)}
        >
          {item.type === 'folder' ? (
            expanded[item.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <FileText className="w-4 h-4 opacity-70" />
          )}
          {item.type === 'folder' && <Folder className="w-4 h-4 text-purple-400 fill-purple-400/20" />}
          <span className="flex-1 truncate">{item.name}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-6 h-6 opacity-0 group-hover:opacity-100 h-4 w-4">
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => actions.deleteItem(item.id)} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {item.type === 'folder' && expanded[item.id] && (
          <div className="ml-4 border-l border-border/50 pl-1 mt-0.5">
            {renderTree(item.id)}
          </div>
        )}
      </div>
    ));
  };
  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-4 flex items-center justify-between border-b border-border/40">
        <h2 className="font-semibold text-sm tracking-tight text-foreground/80">VAULT</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => actions.createFile("New Note")}>
            <FilePlus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => actions.createFolder("New Folder")}>
            <FolderPlus className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {renderTree('root')}
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { FolderPlus, FilePlus, ChevronRight, ChevronDown, FileText, Folder, Trash2, MoreVertical, Edit2 } from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
export function FileExplorer() {
  const files = useVaultStore((s) => s.files);
  const activeFileId = useVaultStore((s) => s.activeFileId);
  const createFile = useVaultStore((s) => s.actions.createFile);
  const createFolder = useVaultStore((s) => s.actions.createFolder);
  const deleteItem = useVaultStore((s) => s.actions.deleteItem);
  const setActiveFile = useVaultStore((s) => s.actions.setActiveFile);
  const renameItem = useVaultStore((s) => s.actions.renameItem);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const startRenaming = (item: { id: string, name: string }) => {
    setRenamingId(item.id);
    setTempName(item.name);
  };
  const submitRename = (id: string) => {
    if (tempName.trim()) {
      renameItem(id, tempName);
    }
    setRenamingId(null);
  };
  const renderTree = (parentId: string = 'root') => {
    const children = Object.values(files).filter((f) => f.parentId === parentId);
    return children.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1)).map((item) => (
      <div key={item.id} className="select-none">
        <div
          className={cn(
            "group flex items-center gap-2 px-2 py-1.5 text-xs rounded-md cursor-pointer transition-all duration-200",
            activeFileId === item.id 
              ? "bg-primary/10 text-primary border-l-2 border-primary rounded-l-none" 
              : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
          )}
          onClick={() => item.type === 'file' ? setActiveFile(item.id) : toggleExpand(item.id)}
          onDoubleClick={() => startRenaming(item)}
        >
          {item.type === 'folder' ? (
            expanded[item.id] ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <FileText className="w-3.5 h-3.5 opacity-70 shrink-0" />
          )}
          {item.type === 'folder' && <Folder className="w-3.5 h-3.5 text-primary/60 fill-primary/10 shrink-0" />}
          {renamingId === item.id ? (
            <input
              autoFocus
              className="flex-1 bg-background border border-primary/40 rounded px-1 py-0.5 outline-none text-xs"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={() => submitRename(item.id)}
              onKeyDown={(e) => e.key === 'Enter' && submitRename(item.id)}
            />
          ) : (
            <span className="flex-1 truncate font-medium">{item.name}</span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => startRenaming(item)}>
                <Edit2 className="w-3.5 h-3.5 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => deleteItem(item.id)} className="text-destructive">
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {item.type === 'folder' && expanded[item.id] && (
          <div className="ml-3.5 border-l border-border/30 pl-2 mt-0.5">
            {renderTree(item.id)}
          </div>
        )}
      </div>
    ));
  };
  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-4 flex items-center justify-between border-b border-border/40">
        <h2 className="font-bold text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Vault Explorer</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-primary/10 hover:text-primary" onClick={() => createFile("New Note")}>
            <FilePlus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-primary/10 hover:text-primary" onClick={() => createFolder("New Folder")}>
            <FolderPlus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {renderTree('root')}
      </div>
    </div>
  );
}
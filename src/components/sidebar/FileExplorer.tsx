import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FolderPlus, FilePlus, ChevronRight, ChevronDown, FileText, Folder, Trash2, MoreVertical, Edit2, Search, X, Upload } from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { indexVault } from '@/lib/search';
export function FileExplorer() {
  const files = useVaultStore((s) => s.files);
  const activeFileId = useVaultStore((s) => s.activeFileId);
  const selectedFolderId = useVaultStore((s) => s.selectedFolderId);
  const createFile = useVaultStore((s) => s.actions.createFile);
  const createFolder = useVaultStore((s) => s.actions.createFolder);
  const deleteItem = useVaultStore((s) => s.actions.deleteItem);
  const setActiveFile = useVaultStore((s) => s.actions.setActiveFile);
  const renameItem = useVaultStore((s) => s.actions.renameItem);
  const setFolderFocus = useVaultStore((s) => s.actions.setFolderFocus);
  const importVault = useVaultStore((s) => s.actions.importVault);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { indexVault(files); }, [files]);
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return Object.values(files).filter(f =>
      f.type === 'file' && (f.name.toLowerCase().includes(query) || f.content?.toLowerCase().includes(query))
    );
  }, [files, searchQuery]);
  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    setFolderFocus(id);
  };
  const submitRename = (id: string) => {
    if (tempName.trim()) renameItem(id, tempName);
    setRenamingId(null);
  };
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      importVault(data);
    } catch (err) {
      createFile(file.name.replace('.md', ''), 'root');
      const newId = Object.keys(files).find(k => files[k].name === file.name);
      if (newId) useVaultStore.getState().actions.updateFileContent(newId, text);
    }
  };
  const renderTree = (parentId: string = 'root') => {
    const children = Object.values(files).filter((f) => f.parentId === parentId);
    return children.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1)).map((item) => (
      <div key={item.id} className="select-none">
        <div
          className={cn(
            "group flex items-center gap-2 px-2 py-1.5 text-xs rounded-md cursor-pointer transition-all duration-200",
            activeFileId === item.id || (item.type === 'folder' && selectedFolderId === item.id)
              ? "bg-primary/10 text-primary border-l-2 border-primary rounded-l-none"
              : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
          )}
          onClick={() => item.type === 'file' ? setActiveFile(item.id) : toggleExpand(item.id)}
        >
          {item.type === 'folder' ? (
            expanded[item.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
          ) : <FileText className="w-3.5 h-3.5 opacity-70" />}
          {item.type === 'folder' && <Folder className={cn("w-3.5 h-3.5 fill-primary/5", selectedFolderId === item.id ? "text-primary" : "text-primary/40")} />}
          {renamingId === item.id ? (
            <input
              autoFocus
              className="flex-1 bg-background border border-primary/40 rounded px-1 outline-none"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={() => submitRename(item.id)}
              onKeyDown={(e) => e.key === 'Enter' && submitRename(item.id)}
            />
          ) : <span className="flex-1 truncate font-medium">{item.name}</span>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="w-6 h-6 opacity-0 group-hover:opacity-100"><MoreVertical className="w-3 h-3" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { setRenamingId(item.id); setTempName(item.name); }}><Edit2 className="w-3.5 h-3.5 mr-2" /> Rename</DropdownMenuItem>
              <DropdownMenuItem onClick={() => deleteItem(item.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {item.type === 'folder' && expanded[item.id] && <div className="ml-3.5 border-l border-border/30 pl-2 mt-0.5">{renderTree(item.id)}</div>}
      </div>
    ));
  };
  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-4 flex items-center justify-between border-b border-border/40">
        <h2 className="font-bold text-[11px] uppercase tracking-[0.2em] text-muted-foreground">My Vault</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => fileInputRef.current?.click()}><Upload className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => createFile("New Note")}><FilePlus className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => createFolder("New Folder")}><FolderPlus className="w-3.5 h-3.5" /></Button>
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleImport} accept=".json,.md" />
        </div>
      </div>
      <div className="px-2 py-2 border-b border-border/20">
        <div className="relative group">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Fuzzy search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 pl-8 text-[11px] bg-secondary/30 border-none" />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2 top-2"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">{filteredFiles ? (
        <div className="space-y-1">
          {filteredFiles.map(file => (
            <div key={file.id} onClick={() => setActiveFile(file.id)} className={cn("flex items-center gap-2 px-2 py-2 text-xs rounded-md cursor-pointer", activeFileId === file.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-muted-foreground")}>
              <FileText className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{file.name}</span>
            </div>
          ))}
        </div>
      ) : renderTree('root')}</div>
    </div>
  );
}
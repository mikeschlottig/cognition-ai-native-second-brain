import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { get as idbGet } from 'idb-keyval';
import { toast } from 'sonner';
import { Archive, Copy, FolderPlus, Import, Loader2, Trash2, CheckCircle2 } from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import type { FileItem } from '@/stores/vaultStore';
import { STORAGE_KEY } from '@/lib/constants';
import { downloadBlob, generateVaultZip, parseVaultImport, sanitizeImportedFiles, countVaultFiles } from '@/lib/vaultUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
type VaultManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
type PendingImport = {
  inferredName: string;
  files: Record<string, FileItem>;
  fileCount: number;
  folderCount: number;
  samplePaths: string[];
};
const vaultKey = (vaultId: string) => `${STORAGE_KEY}${vaultId}`;
const buildPathList = (files: Record<string, FileItem>, limit = 10): string[] => {
  const byId = files;
  const getPath = (id: string): string => {
    const item = byId[id];
    if (!item) return '';
    if (item.parentId === 'root') return item.name;
    if (typeof item.parentId !== 'string') return item.name;
    const parent = byId[item.parentId];
    if (!parent) return item.name;
    const parentPath = getPath(parent.id);
    return parentPath ? `${parentPath}/${item.name}` : item.name;
  };
  return Object.values(files)
    .filter((f) => f?.type === 'file')
    .map((f) => getPath(f.id))
    .filter(Boolean)
    .slice(0, limit);
};
export function VaultManager({ open, onOpenChange }: VaultManagerProps) {
  const vaults = useVaultStore((s) => s.vaults);
  const currentVaultId = useVaultStore((s) => s.currentVaultId);
  const vaultLoading = useVaultStore((s) => s.vaultLoading);
  const createVault = useVaultStore((s) => s.actions.createVault);
  const switchVault = useVaultStore((s) => s.actions.switchVault);
  const deleteVault = useVaultStore((s) => s.actions.deleteVault);
  const [newVaultName, setNewVaultName] = useState('');
  const [busyVaultId, setBusyVaultId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const sortedVaults = useMemo(() => {
    const list = Array.isArray(vaults) ? [...vaults] : [];
    return list.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  }, [vaults]);
  const confirmDeleteName = useMemo(() => {
    if (!confirmDeleteId) return '';
    const list = Array.isArray(vaults) ? vaults : [];
    return list.find((v) => v.id === confirmDeleteId)?.name || 'this vault';
  }, [confirmDeleteId, vaults]);
  const handleCreate = async () => {
    const name = newVaultName.trim() || 'New Vault';
    setBusyVaultId('create');
    try {
      const id = await createVault(name);
      if (id) {
        toast.success(`Created “${name}”`);
        setNewVaultName('');
      } else {
        toast.error('Failed to create vault');
      }
    } catch (err) {
      console.error('Failed to create vault:', err);
      toast.error('Failed to create vault');
    } finally {
      setBusyVaultId(null);
    }
  };
  const handleExport = async (vaultId: string, vaultName: string) => {
    setBusyVaultId(vaultId);
    try {
      const blob = await generateVaultZip({ vaultId, vaultName });
      downloadBlob(blob, `${vaultName || 'vault'}.zip`);
      toast.success(`Exported “${vaultName || 'vault'}”`);
    } catch (err) {
      console.error('Failed to export vault:', err);
      toast.error('Failed to export vault');
    } finally {
      setBusyVaultId(null);
    }
  };
  const loadVaultFilesForDuplicate = async (vaultId: string): Promise<Record<string, FileItem> | null> => {
    try {
      const raw = await idbGet<any>(vaultKey(vaultId));
      const rawFiles = raw?.files ?? raw;
      const files = sanitizeImportedFiles(rawFiles);
      return Object.keys(files).length > 0 ? files : null;
    } catch (err) {
      console.error('Failed to load vault for duplication:', err);
      return null;
    }
  };
  const handleDuplicate = async (vaultId: string, vaultName: string) => {
    setBusyVaultId(`dup:${vaultId}`);
    try {
      const files = await loadVaultFilesForDuplicate(vaultId);
      if (!files) {
        toast.error('Could not duplicate vault (missing data)');
        return;
      }
      const copyName = `${vaultName} Copy`;
      const newId = await createVault(copyName, files);
      if (newId) toast.success(`Duplicated to “${copyName}”`);
      else toast.error('Failed to duplicate vault');
    } catch (err) {
      console.error('Duplicate vault failed:', err);
      toast.error('Failed to duplicate vault');
    } finally {
      setBusyVaultId(null);
    }
  };
  const handleImportPicked = async (file: File) => {
    setImportError(null);
    setBusyVaultId('import');
    try {
      const parsed = await parseVaultImport(file);
      const inferredName = (parsed.vaultName || file.name.replace(/\.(zip|json|md)$/i, '').trim() || 'Imported Vault').trim();
      const files = parsed.files;
      const fileCount = countVaultFiles(files);
      const folderCount = Object.values(files).filter((f) => f?.type === 'folder').length;
      const samplePaths = buildPathList(files, 10);
      if (fileCount === 0) {
        setImportError('No markdown files found in that import.');
        return;
      }
      setPendingImport({ inferredName, files, fileCount, folderCount, samplePaths });
    } catch (err) {
      console.error('Vault import parse failed:', err);
      setImportError('Could not import that vault. Please provide a Cognition ZIP/JSON export or a .md file.');
    } finally {
      setBusyVaultId(null);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };
  const finalizeImport = async () => {
    if (!pendingImport) return;
    setBusyVaultId('import-finalize');
    try {
      const id = await createVault(pendingImport.inferredName, pendingImport.files);
      if (id) {
        toast.success(`Imported “${pendingImport.inferredName}”`);
        setPendingImport(null);
      } else {
        toast.error('Failed to import vault');
      }
    } catch (err) {
      console.error('Vault import failed:', err);
      toast.error('Failed to import vault');
    } finally {
      setBusyVaultId(null);
    }
  };
  const confirmDelete = async () => {
    const id = confirmDeleteId;
    if (!id) return;
    setBusyVaultId(`del:${id}`);
    try {
      await deleteVault(id);
      toast.success(`Deleted “${confirmDeleteName}”`);
    } catch (err) {
      console.error('Failed to delete vault:', err);
      toast.error('Failed to delete vault');
    } finally {
      setBusyVaultId(null);
    }
  };
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
          <div className="bg-background">
            <DialogHeader className="p-6 pb-4 border-b border-border/40">
              <DialogTitle className="text-base">Vault Manager</DialogTitle>
              <DialogDescription className="text-xs">
                Vaults are isolated knowledge bases stored locally in your browser.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
              <div className="md:col-span-2 border-b md:border-b-0 md:border-r border-border/40">
                <div className="p-6 pb-4 flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-foreground">Your vaults</div>
                    <div className="text-[11px] text-muted-foreground">
                      Switch instantly — no page reload needed.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={importInputRef}
                      type="file"
                      className="hidden"
                      accept=".zip,.json,.md"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleImportPicked(f);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-[11px]"
                      onClick={() => importInputRef.current?.click()}
                      disabled={busyVaultId === 'import' || busyVaultId === 'import-finalize'}
                    >
                      {busyVaultId === 'import' || busyVaultId === 'import-finalize' ? (
                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      ) : (
                        <Import className="h-3.5 w-3.5 mr-2" />
                      )}
                      Import
                    </Button>
                  </div>
                </div>
                {importError && (
                  <div className="px-6 pb-4">
                    <div className="text-[11px] text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
                      {importError}
                    </div>
                  </div>
                )}
                <ScrollArea className="h-[360px]">
                  <div className="p-6 pt-2 space-y-3">
                    <AnimatePresence initial={false}>
                      {sortedVaults.length === 0 ? (
                        <motion.div
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-6 text-center"
                        >
                          No vaults found.
                        </motion.div>
                      ) : (
                        sortedVaults.map((v) => {
                          const isCurrent = v.id === currentVaultId;
                          const isBusy =
                            busyVaultId === v.id ||
                            busyVaultId === `del:${v.id}` ||
                            busyVaultId === `dup:${v.id}` ||
                            (vaultLoading && isCurrent);
                          return (
                            <motion.div
                              key={v.id}
                              layout
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.18 }}
                            >
                              <Card className="p-4 flex items-start justify-between gap-4 hover:bg-muted/20 transition-colors">
                                <button
                                  type="button"
                                  className="text-left flex-1 min-w-0"
                                  onClick={() => void switchVault(v.id)}
                                  disabled={isBusy}
                                  aria-label={`Switch to vault ${v.name}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="font-medium text-sm truncate">{v.name}</div>
                                    {isCurrent && <Badge variant="secondary">Current</Badge>}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                    <span>{v.fileCount ?? 0} files</span>
                                    <span className="text-muted-foreground/70">•</span>
                                    <span>
                                      Last opened{' '}
                                      {v.lastAccessed
                                        ? formatDistanceToNow(new Date(v.lastAccessed), { addSuffix: true })
                                        : '—'}
                                    </span>
                                  </div>
                                </button>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-[11px]"
                                    onClick={() => void handleDuplicate(v.id, v.name)}
                                    disabled={isBusy}
                                  >
                                    {busyVaultId === `dup:${v.id}` ? (
                                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5 mr-2" />
                                    )}
                                    Duplicate
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-[11px]"
                                    onClick={() => void handleExport(v.id, v.name)}
                                    disabled={isBusy}
                                  >
                                    {busyVaultId === v.id ? (
                                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                    ) : (
                                      <Archive className="h-3.5 w-3.5 mr-2" />
                                    )}
                                    Export ZIP
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-8 text-[11px]"
                                    onClick={() => setConfirmDeleteId(v.id)}
                                    disabled={isBusy}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                                    Delete
                                  </Button>
                                </div>
                              </Card>
                            </motion.div>
                          );
                        })
                      )}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              </div>
              <div className="p-6">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-foreground">Create a new vault</div>
                  <div className="text-[11px] text-muted-foreground">
                    Great for separating projects, clients, or topics.
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="new-vault-name" className="text-[11px] text-muted-foreground">
                      Vault name
                    </label>
                    <Input
                      id="new-vault-name"
                      value={newVaultName}
                      onChange={(e) => setNewVaultName(e.target.value)}
                      placeholder="e.g. Research, Work, Personal"
                      className="bg-secondary/30"
                    />
                  </div>
                  <Button className="w-full" onClick={() => void handleCreate()} disabled={busyVaultId === 'create'}>
                    {busyVaultId === 'create' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FolderPlus className="h-4 w-4 mr-2" />
                    )}
                    Create Vault
                  </Button>
                  <div className="pt-2 border-t border-border/40">
                    <div className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                      <p>
                        Note: AI features are subject to global request limits shared across apps. If responses are slow
                        or unavailable, try again later.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Verify Integrity / Import Summary */}
      <AlertDialog open={!!pendingImport} onOpenChange={(v) => !v && setPendingImport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import “{pendingImport?.inferredName || 'vault'}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new vault in this browser with the following contents:
              <div className="mt-3 space-y-2 text-[11px] text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Markdown files</span>
                  <span className="tabular-nums">{pendingImport?.fileCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Folders</span>
                  <span className="tabular-nums">{pendingImport?.folderCount ?? 0}</span>
                </div>
                {pendingImport?.samplePaths?.length ? (
                  <div className="pt-2 border-t border-border/40">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">Sample paths</div>
                    <ul className="mt-2 space-y-1">
                      {pendingImport.samplePaths.map((p) => (
                        <li key={p} className="font-mono text-[10px] truncate">
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingImport(null)} disabled={busyVaultId === 'import-finalize'}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void finalizeImport()}
              disabled={busyVaultId === 'import-finalize'}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busyVaultId === 'import-finalize' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Confirm Delete */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{confirmDeleteName}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the vault and its local data from this browser. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = confirmDeleteId;
                setConfirmDeleteId(null);
                if (id) void confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
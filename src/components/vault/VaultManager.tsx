import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Archive, FolderPlus, Import, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { downloadBlob, generateVaultZip, parseVaultImport } from "@/lib/vaultUtils";
type VaultManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
export function VaultManager({ open, onOpenChange }: VaultManagerProps) {
  const vaults = useVaultStore((s) => s.vaults);
  const currentVaultId = useVaultStore((s) => s.currentVaultId);
  const vaultLoading = useVaultStore((s) => s.vaultLoading);
  const createVault = useVaultStore((s) => s.actions.createVault);
  const switchVault = useVaultStore((s) => s.actions.switchVault);
  const deleteVault = useVaultStore((s) => s.actions.deleteVault);
  const [newVaultName, setNewVaultName] = useState("");
  const [busyVaultId, setBusyVaultId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const sortedVaults = useMemo(() => {
    const list = Array.isArray(vaults) ? [...vaults] : [];
    return list.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  }, [vaults]);
  const handleCreate = async () => {
    const name = newVaultName.trim() || "New Vault";
    setBusyVaultId("create");
    try {
      await createVault(name);
      setNewVaultName("");
    } catch (err) {
      console.error("Failed to create vault:", err);
    } finally {
      setBusyVaultId(null);
    }
  };
  const handleExport = async (vaultId: string, vaultName: string) => {
    setBusyVaultId(vaultId);
    try {
      const blob = await generateVaultZip({ vaultId, vaultName });
      downloadBlob(blob, `${vaultName || "vault"}.zip`);
    } catch (err) {
      console.error("Failed to export vault:", err);
    } finally {
      setBusyVaultId(null);
    }
  };
  const handleImportFile = async (file: File) => {
    setImportError(null);
    setBusyVaultId("import");
    try {
      const parsed = await parseVaultImport(file);
      const inferredName = parsed.vaultName || file.name.replace(/\.(zip|json)$/i, "").trim() || "Imported Vault";
      await createVault(inferredName, parsed.files);
    } catch (err) {
      console.error("Vault import failed:", err);
      setImportError("Could not import that vault. Please provide a Cognition ZIP/JSON export.");
    } finally {
      setBusyVaultId(null);
      if (importInputRef.current) importInputRef.current.value = "";
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
                      accept=".zip,.json"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleImportFile(f);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-[11px]"
                      onClick={() => importInputRef.current?.click()}
                      disabled={busyVaultId === "import"}
                    >
                      {busyVaultId === "import" ? (
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
                          const isBusy = busyVaultId === v.id || (vaultLoading && isCurrent);
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
                                      Last opened{" "}
                                      {v.lastAccessed
                                        ? formatDistanceToNow(new Date(v.lastAccessed), { addSuffix: true })
                                        : "—"}
                                    </span>
                                  </div>
                                </button>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-[11px]"
                                    onClick={() => void handleExport(v.id, v.name)}
                                    disabled={isBusy}
                                  >
                                    {isBusy ? (
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
                  <Button
                    className="w-full"
                    onClick={() => void handleCreate()}
                    disabled={busyVaultId === "create"}
                  >
                    {busyVaultId === "create" ? (
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
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this vault?</AlertDialogTitle>
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
                if (id) void deleteVault(id);
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
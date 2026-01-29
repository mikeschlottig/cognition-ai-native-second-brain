import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, BrainCircuit, Loader2, Search, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { useVaultStore } from '@/stores/vaultStore';
import { chatService } from '@/lib/chat';
import { ChatMessage } from './ChatMessage';
import { getRelevantContext } from '@/lib/search';
import type { Message } from '../../../worker/types';
type ContextNote = { id: string; name: string };
export function AssistantPanel() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [contextNotes, setContextNotes] = useState<ContextNote[]>([]);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const activeFileId = useVaultStore((s) => s.activeFileId);
  const files = useVaultStore((s) => s.files);
  const setActiveFile = useVaultStore((s) => s.actions.setActiveFile);
  const activeFile = activeFileId ? files[activeFileId] : null;
  const flushTimerRef = useRef<number | null>(null);
  const streamBufferRef = useRef<string>('');
  const streamingAssistantIdRef = useRef<string | null>(null);
  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);
  const fileIdByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of Object.values(files)) {
      if (!f) continue;
      // First match wins (names may not be unique)
      if (!map.has(f.name)) map.set(f.name, f.id);
    }
    return map;
  }, [files]);
  const loadHistory = async () => {
    const res = await chatService.getMessages();
    if (res.success && res.data) setMessages(res.data.messages || []);
  };
  const scheduleStreamingFlush = () => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      const nextChunk = streamBufferRef.current;
      if (!nextChunk) return;
      streamBufferRef.current = '';
      const assistantId = streamingAssistantIdRef.current;
      if (!assistantId) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: (m.content || '') + nextChunk } : m))
      );
    }, 90);
  };
  const handleSend = async (customPrompt?: string) => {
    const userQuery = (customPrompt || input).trim();
    if (!userQuery || isTyping) return;
    setInput('');
    setIsTyping(true);
    // Build related context + clickable indicators
    const relatedContext = getRelevantContext(userQuery, files, activeFileId);
    const noteNames =
      relatedContext?.length > 0
        ? relatedContext
            .split('\n\n---\n\n')
            .map((c) => c.split('\n')[0]?.replace('NOTE: ', '').trim())
            .filter(Boolean)
        : [];
    const notes: ContextNote[] = noteNames
      .map((name) => {
        const id = fileIdByName.get(name);
        return id ? { id, name } : null;
      })
      .filter((x): x is ContextNote => !!x);
    setContextNotes(notes);
    const fullPrompt = [
      `CONTEXT:`,
      `ACTIVE NOTE (${activeFile?.name || 'None'}):`,
      `${activeFile?.content || ''}`,
      ``,
      `RELATED NOTES:`,
      `${relatedContext || ''}`,
      ``,
      `USER QUESTION: ${userQuery}`,
    ].join('\n');
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: userQuery, timestamp: Date.now() };
    const assistantId = crypto.randomUUID();
    const assistantPlaceholder: Message = { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    // streaming (throttled) to reduce markdown layout shifts
    streamingAssistantIdRef.current = assistantId;
    streamBufferRef.current = '';
    try {
      await chatService.sendMessage(fullPrompt, undefined, (chunk) => {
        // Avoid excessive rerenders by buffering.
        streamBufferRef.current += chunk;
        scheduleStreamingFlush();
      });
      // Replace with canonical server history (includes tool calls etc.)
      await loadHistory();
    } catch (err) {
      console.error('Assistant send error:', err);
    } finally {
      setIsTyping(false);
      streamingAssistantIdRef.current = null;
      streamBufferRef.current = '';
      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    }
  };
  const handleVaultAnalyze = () => {
    const recentNotes = Object.values(files)
      .filter((f) => f.type === 'file')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 8)
      .map((f) => `FILE: ${f.name}\nCONTENT:\n${(f.content || '').slice(0, 900)}`)
      .join('\n\n---\n\n');
    const prompt = [
      `Perform a Knowledge Base Synthesis of my vault based on the data below.`,
      ``,
      `Be specific and actionable. Identify:`,
      `1) Core themes (3–6)`,
      `2) Conceptual gaps (missing definitions, missing "why", missing examples)`,
      `3) Missing links between notes (what should reference what)`,
      `4) Suggested next notes to create (5–10 titles), each with 1 sentence rationale`,
      ``,
      `RECENT DATA:`,
      recentNotes,
    ].join('\n');
    void handleSend(prompt);
  };
  return (
    <>
      <div className="flex flex-col h-full bg-sidebar/50 border-l border-border/40">
        <div className="p-4 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Assistant</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ready</p>
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={handleVaultAnalyze}
              title="Analyze Vault"
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setConfirmClearOpen(true)}
              title="Clear chat history"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1 px-4">
          <div className="py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-10 px-6">
                <div className="bg-muted/30 rounded-2xl p-6 border border-border/40">
                  <p className="text-sm text-muted-foreground">
                    Ask me to synthesize, research, or connect your notes.
                  </p>
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isTyping && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-secondary/30 rounded-xl border border-border/40">
                  <div className="flex items-center gap-2">
                    <Search className="w-3 h-3 text-primary animate-pulse" />
                    <span className="text-[9px] uppercase tracking-tighter text-muted-foreground">
                      Reading:
                    </span>
                  </div>
                  {contextNotes.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {contextNotes.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => setActiveFile(n.id)}
                          className="text-[10px] rounded-md border border-border/40 bg-background/40 px-2 py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title={`Open ${n.name}`}
                        >
                          {n.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Vault</span>
                  )}
                </div>
                <div className="bg-muted/50 rounded-2xl px-4 py-2 text-sm border border-border/40 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Synthesizing...</span>
                </div>
              </div>
            )}
            <div ref={scrollAnchorRef} className="h-4" />
          </div>
        </ScrollArea>
        <div className="p-4 border-t border-border/40 bg-background/50">
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            <Input
              placeholder="Ask Cognition..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isTyping}
              className="pr-10 bg-secondary/30"
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              disabled={!input.trim() || isTyping}
              className="absolute right-1 top-1 text-primary"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this assistant thread for the current session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await chatService.clearMessages();
                  setMessages([]);
                } catch (err) {
                  console.error('Failed to clear messages:', err);
                } finally {
                  setConfirmClearOpen(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
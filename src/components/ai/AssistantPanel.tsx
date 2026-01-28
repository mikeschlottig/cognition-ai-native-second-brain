import React, { useState, useEffect, useRef } from 'react';
import { BrainCircuit, Send, Trash2, Loader2, Sparkles, BarChart3, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVaultStore } from '@/stores/vaultStore';
import { chatService } from '@/lib/chat';
import { ChatMessage } from './ChatMessage';
import { getRelevantContext } from '@/lib/search';
import type { Message } from '../../../worker/types';
export function AssistantPanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [contextNotes, setContextNotes] = useState<string[]>([]);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const activeFileId = useVaultStore((s) => s.activeFileId);
  const files = useVaultStore((s) => s.files);
  const activeFile = activeFileId ? files[activeFileId] : null;
  useEffect(() => { loadHistory(); }, []);
  useEffect(() => { scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);
  const loadHistory = async () => {
    const res = await chatService.getMessages();
    if (res.success && res.data) setMessages(res.data.messages || []);
  };
  const handleSend = async (customPrompt?: string) => {
    const userQuery = customPrompt || input;
    if (!userQuery.trim() || isTyping) return;
    setInput("");
    setIsTyping(true);
    const relatedContext = getRelevantContext(userQuery, files, activeFileId);
    setContextNotes(relatedContext ? relatedContext.split('\n\n---\n\n').map(c => c.split('\n')[0].replace('NOTE: ', '')) : []);
    const fullPrompt = `CONTEXT:\nACTIVE NOTE (${activeFile?.name}):\n${activeFile?.content || ""}\n\nRELATED NOTES:\n${relatedContext}\n\nUSER QUESTION: ${userQuery}`;
    const optimisticUserMsg: Message = { id: crypto.randomUUID(), role: 'user', content: userQuery, timestamp: Date.now() };
    setMessages(prev => [...prev, optimisticUserMsg]);
    try {
      const res = await chatService.sendMessage(fullPrompt);
      if (res.success) await loadHistory();
    } catch (err) { console.error(err); } finally { setIsTyping(false); }
  };
  const handleVaultAnalyze = () => {
    const recentNotes = Object.values(files)
      .filter(f => f.type === 'file')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)
      .map(f => `FILE: ${f.name}\nCONTENT: ${f.content?.slice(0, 500)}`)
      .join("\n\n---\n\n");
    handleSend(`Perform a Knowledge Base Synthesis of my most recent work. Identify connections and potential areas for research.\n\nRECENT DATA:\n${recentNotes}`);
  };
  return (
    <div className="flex flex-col h-full bg-sidebar/50 border-l border-border/40">
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><BrainCircuit className="w-5 h-5 text-primary" /></div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Assistant</h2>
            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ready</p></div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleVaultAnalyze} title="Analyze Vault"><BarChart3 className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={async () => { await chatService.clearMessages(); setMessages([]); }}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>
      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-10 px-6">
              <div className="bg-muted/30 rounded-2xl p-6 border border-border/40"><Sparkles className="w-8 h-8 text-primary/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Ask me to synthesize, research or connect your notes.</p></div>
            </div>
          )}
          {messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)}
          {isTyping && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-1 bg-secondary/30 rounded-full w-fit border border-border/40">
                <Search className="w-3 h-3 text-primary animate-pulse" />
                <span className="text-[9px] uppercase tracking-tighter text-muted-foreground">Reading: {contextNotes.length > 0 ? contextNotes.join(', ') : 'Vault'}</span>
              </div>
              <div className="bg-muted/50 rounded-2xl px-4 py-2 text-sm border border-border/40 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin text-primary" /><span className="text-xs text-muted-foreground">Synthesizing...</span></div>
            </div>
          )}
          <div ref={scrollAnchorRef} className="h-4" />
        </div>
      </ScrollArea>
      <div className="p-4 border-t border-border/40 bg-background/50">
        <form className="relative" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
          <Input placeholder="Ask Cognition..." value={input} onChange={(e) => setInput(e.target.value)} disabled={isTyping} className="pr-10 bg-secondary/30" />
          <Button type="submit" size="icon" variant="ghost" disabled={!input.trim() || isTyping} className="absolute right-1 top-1 text-primary"><Send className="w-4 h-4" /></Button>
        </form>
      </div>
    </div>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import { BrainCircuit, Send, Trash2, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVaultStore } from '@/stores/vaultStore';
import { chatService } from '@/lib/chat';
import { ChatMessage } from './ChatMessage';
import type { Message } from '../../../worker/types';
export function AssistantPanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const activeFileId = useVaultStore((s) => s.activeFileId);
  const files = useVaultStore((s) => s.files);
  const activeFile = activeFileId ? files[activeFileId] : null;
  useEffect(() => {
    loadHistory();
  }, []);
  const scrollToBottom = () => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);
  const loadHistory = async () => {
    try {
      const res = await chatService.getMessages();
      if (res.success && res.data) {
        setMessages(res.data.messages || []);
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  };
  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userQuery = input;
    setInput("");
    setIsTyping(true);
    let fullPrompt = userQuery;
    if (activeFile && activeFile.content) {
      fullPrompt = `CONTEXT (Current Note: ${activeFile.name}):\n---\n${activeFile.content}\n---\nUSER QUESTION: ${userQuery}`;
    }
    // Optimistic Update
    const optimisticUserMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userQuery,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, optimisticUserMsg]);
    try {
      const res = await chatService.sendMessage(fullPrompt, undefined, () => {
        // Handled via loadHistory once stream closes or periodically if needed.
        // For simplicity in this phase, we reload full state after completion.
      });
      if (res.success) {
        await loadHistory();
      }
    } catch (err) {
      console.error("Chat sending error:", err);
    } finally {
      setIsTyping(false);
    }
  };
  const handleClear = async () => {
    if (window.confirm("Clear conversation history?")) {
      await chatService.clearMessages();
      setMessages([]);
    }
  };
  return (
    <div className="flex flex-col h-full bg-sidebar/50 border-l border-border/40">
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BrainCircuit className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Assistant</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ready</p>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleClear}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-10 px-6">
              <div className="bg-muted/30 rounded-2xl p-6 border border-border/40">
                <Sparkles className="w-8 h-8 text-primary/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  How can I help you with your notes today? I can search, summarize, or explain concepts in your vault.
                </p>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isTyping && (
            <div className="flex justify-start py-2">
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
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        >
          <Input
            placeholder="Ask Cognition..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isTyping}
            className="pr-10 bg-secondary/30 border-input hover:bg-secondary/50 focus:ring-1 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/50"
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            disabled={!input.trim() || isTyping}
            className="absolute right-1 top-1 w-8 h-8 text-primary hover:text-primary hover:bg-primary/10 disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="mt-2 text-[9px] text-center text-muted-foreground/60 uppercase tracking-tighter">
          Note: Context is automatically provided from the active file
        </p>
      </div>
    </div>
  );
}
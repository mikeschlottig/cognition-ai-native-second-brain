import React, { useState } from 'react';
import { Sparkles, Send, BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
export function AssistantPanel() {
  const [input, setInput] = useState("");
  return (
    <div className="flex flex-col h-full bg-sidebar/50 border-l border-border/40">
      <div className="p-4 border-b border-border/40 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <BrainCircuit className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Cognition Engine</h2>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active System</p>
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <div className="bg-muted/40 rounded-lg p-3 text-sm border border-border/20">
            <p className="text-foreground/90 leading-relaxed">
              Hello! I'm your Cognition Assistant. I can help you research, summarize notes, or generate tags.
            </p>
          </div>
          <div className="bg-primary/5 rounded-lg p-3 text-xs border border-primary/10 text-muted-foreground">
            <p>Phase 1: Intelligence interface ready. Full model integration scheduled for Phase 2.</p>
          </div>
        </div>
      </ScrollArea>
      <div className="p-4 border-t border-border/40 bg-background/50">
        <div className="relative">
          <Input 
            placeholder="Ask anything..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="pr-10 bg-secondary/30 border-input hover:bg-secondary/50 focus:ring-1 focus:ring-primary/40 transition-all"
          />
          <Button 
            size="icon" 
            variant="ghost" 
            className="absolute right-1 top-1 w-8 h-8 text-primary hover:text-primary hover:bg-primary/10"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="mt-2 text-[10px] text-center text-muted-foreground">
          Cognition may encounter request limits during peak hours.
        </p>
      </div>
    </div>
  );
}
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BrainCircuit, User, Terminal } from 'lucide-react';
import type { Message, ToolCall } from '../../../worker/types';
import { renderToolCall } from '@/lib/chat';
interface ChatMessageProps {
  message: Message;
}
export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex w-full gap-3 py-4",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      {isAssistant && (
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
          <BrainCircuit className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className={cn(
        "flex flex-col max-w-[85%] gap-2",
        isAssistant ? "items-start" : "items-end"
      )}>
        <div className={cn(
          "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
          isAssistant 
            ? "bg-muted/50 text-foreground border border-border/40 rounded-tl-none" 
            : "bg-primary text-primary-foreground rounded-tr-none"
        )}>
          <div className="whitespace-pre-wrap leading-relaxed">
            {message.content}
          </div>
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {message.toolCalls.map((tc: ToolCall) => (
              <div 
                key={tc.id}
                className="flex items-center gap-2 px-2 py-1 rounded-md bg-secondary/50 border border-border/40 text-[10px] text-muted-foreground font-mono"
              >
                <Terminal className="w-3 h-3" />
                {renderToolCall(tc)}
              </div>
            ))}
          </div>
        )}
      </div>
      {!isAssistant && (
        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 border border-border">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  );
}
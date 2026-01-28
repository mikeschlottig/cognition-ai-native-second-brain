import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
interface PreviewPaneProps {
  content: string;
}
export function PreviewPane({ content }: PreviewPaneProps) {
  const [copied, setCopied] = useState(false);
  const copyHtml = () => {
    const el = document.querySelector('.prose-preview');
    if (el) {
      navigator.clipboard.writeText(el.innerHTML);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <div className="h-full flex flex-col bg-background border-l border-border/20">
      <div className="px-4 py-2 border-b border-border/20 flex justify-between items-center bg-muted/5">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Live Preview</span>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 text-[9px] gap-1 px-2 border-border/40 hover:bg-muted/50" 
          onClick={copyHtml}
        >
          {copied ? (
            <Check className="w-3 h-3 text-green-500" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          {copied ? 'COPIED' : 'COPY HTML'}
        </Button>
      </div>
      <ScrollArea className="flex-1 p-8">
        <div className="max-w-2xl mx-auto prose prose-sm dark:prose-invert prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary prose-pre:bg-muted/50 prose-img:rounded-xl prose-preview">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </ScrollArea>
    </div>
  );
}
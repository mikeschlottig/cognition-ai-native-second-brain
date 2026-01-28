import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVaultStore } from '@/stores/vaultStore';
import { AppShell } from '@/components/layout/AppShell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function HomePage() {
  const initialized = useVaultStore((s) => s.initialized);
  const initAction = useVaultStore((s) => s.actions.init);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const startup = async () => {
      try {
        await initAction();
      } catch (err) {
        console.error("Critical storage failure:", err);
        setError("Failed to initialize local storage. Please ensure cookies/local storage are enabled.");
      }
    };
    startup();
  }, [initAction]);
  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-destructive/5 border border-destructive/20 rounded-3xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold text-foreground">System Halted</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Restarting System
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="relative h-screen w-full overflow-hidden">
      <AnimatePresence mode="wait">
        {!initialized ? (
          <motion.div
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="h-screen w-full flex flex-col items-center justify-center bg-background"
          >
            <div className="relative flex flex-col items-center">
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.8, 1, 0.8]
                }}
                transition={{ repeat: Infinity, duration: 2.5 }}
                className="w-24 h-24 rounded-[2rem] bg-gradient-primary flex items-center justify-center shadow-primary"
              >
                <Sparkles className="w-12 h-12 text-white" />
              </motion.div>
              <div className="mt-10 text-center space-y-3">
                <h1 className="text-2xl font-black tracking-tighter text-foreground uppercase">Cognition</h1>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-1 w-12 bg-primary/20 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary"
                      animate={{ x: [-48, 48] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    />
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Synchronizing Vault
                  </p>
                  <div className="h-1 w-12 bg-primary/20 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary"
                      animate={{ x: [-48, 48] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear", delay: 0.2 }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute bottom-10 left-0 right-0 text-center px-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] opacity-40">
                AI Limit: Global request limits may apply to agentic functions.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full w-full"
          >
            <AppShell />
          </motion.div>
        )}
      </AnimatePresence>
      <ThemeToggle className="fixed bottom-10 right-4" />
    </div>
  );
}
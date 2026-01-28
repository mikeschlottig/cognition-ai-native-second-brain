import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVaultStore } from '@/stores/vaultStore';
import { AppShell } from '@/components/layout/AppShell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Sparkles } from 'lucide-react';
export function HomePage() {
  const initialized = useVaultStore((s) => s.initialized);
  const initAction = useVaultStore((s) => s.actions.init);
  useEffect(() => {
    initAction();
  }, [initAction]);
  return (
    <div className="relative h-screen w-full overflow-hidden">
      <AnimatePresence mode="wait">
        {!initialized ? (
          <motion.div 
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            className="h-screen w-full flex flex-col items-center justify-center bg-background"
          >
            <div className="relative flex flex-col items-center">
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0] 
                }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="w-20 h-20 rounded-3xl bg-gradient-primary flex items-center justify-center shadow-primary"
              >
                <Sparkles className="w-10 h-10 text-white" />
              </motion.div>
              <div className="mt-8 text-center space-y-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">Cognition</h1>
                <p className="text-xs font-medium text-muted-foreground animate-pulse">
                  Unlocking your knowledge vault...
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
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
import React, { useEffect } from 'react';
import { useVaultStore } from '@/stores/vaultStore';
import { AppShell } from '@/components/layout/AppShell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Sparkles } from 'lucide-react';
export function HomePage() {
  const initialized = useVaultStore((s) => s.initialized);
  const actions = useVaultStore((s) => s.actions);
  useEffect(() => {
    actions.init();
  }, []);
  if (!initialized) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background">
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-primary animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <p className="mt-6 text-sm font-medium text-muted-foreground animate-fade-in">
            Opening your vault...
          </p>
        </div>
      </div>
    );
  }
  return (
    <>
      <AppShell />
      <ThemeToggle className="fixed bottom-10 right-4" />
    </>
  );
}
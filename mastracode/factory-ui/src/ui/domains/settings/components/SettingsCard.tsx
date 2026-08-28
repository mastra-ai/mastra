import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

export function SettingsCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('border-border1 bg-surface3 divide-border1 divide-y rounded-xl border', className)}>
      {children}
    </div>
  );
}

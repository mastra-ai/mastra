import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SettingsCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('divide-y divide-border1 rounded-xl border border-border1 bg-surface3', className)}>
      {children}
    </div>
  );
}

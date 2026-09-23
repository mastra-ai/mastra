import type { ReactNode } from 'react';

import { frameSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

// The app frame surface inside `AppShell`. Spacing around it is owned by the shell, not the card.
export function MainCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-slot="main-card"
      className={cn('relative min-h-0 flex-1 overflow-hidden rounded-studio-frame', frameSurfaceStyle, className)}
    >
      {children}
    </div>
  );
}

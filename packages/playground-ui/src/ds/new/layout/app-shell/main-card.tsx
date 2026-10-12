import type { ReactNode } from 'react';

import { frameSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

// The app frame surface inside `AppShell`. Spacing around it is owned by the shell, not the card.
// Reserve the 1px inset rim so child dividers don't paint over it and stack their alpha.
export function MainCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-slot="main-card"
      className={cn('relative min-h-0 flex-1 overflow-hidden rounded-studio-frame p-px', frameSurfaceStyle, className)}
    >
      {children}
    </div>
  );
}

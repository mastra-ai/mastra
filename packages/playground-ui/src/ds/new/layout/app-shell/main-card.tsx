import type { ReactNode } from 'react';

import { frameFillStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

// The app frame surface inside `AppShell`. Spacing around it is owned by the shell, not the card.
// Framed only from lg, where the sidebar sits beside it (the sidebar's drawer breakpoint); below lg it is
// flat page content under the mobile header. lg-only classes, not max-lg overrides, so consumer CSS that
// also emits the base classes can't undo the flat state by source order.
// Reserve the 1px inset rim so child dividers don't paint over it and stack their alpha.
export function MainCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-slot="main-card"
      className={cn(
        'relative min-h-0 flex-1 overflow-hidden lg:rounded-studio-frame lg:p-px lg:shadow-raised',
        frameFillStyle,
        className,
      )}
    >
      {children}
    </div>
  );
}

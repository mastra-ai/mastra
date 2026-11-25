import type { ReactNode } from 'react';

import { frameFillStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

// The app frame surface inside `AppShell`. Spacing around it is owned by the shell, not the card.
// Framed only from lg, where the sidebar sits beside it (the sidebar's drawer breakpoint); below lg it is
// flat page content under the mobile header. lg-only classes, not max-lg overrides, so consumer CSS that
// also emits the base classes can't undo the flat state by source order.
// A border keeps the rim visible around the rounded corners even when the page fills the frame.
export function MainCard({
  children,
  className,
  edgeToEdge,
}: {
  children: ReactNode;
  className?: string;
  edgeToEdge?: boolean;
}) {
  const animatesEdgeToEdge = edgeToEdge !== undefined;

  return (
    <div
      data-slot="main-card"
      className={cn(
        'relative min-h-0 flex-1 overflow-hidden border-surface-rim',
        animatesEdgeToEdge &&
          'transition-[border-radius,border-width,box-shadow] duration-(--resize-dur) ease-(--resize-ease) motion-reduce:transition-none!',
        animatesEdgeToEdge && 'in-data-[sidebar-gesture=active]:transition-none!',
        !edgeToEdge && 'lg:rounded-studio-frame lg:border lg:shadow-(--elevation-raised)',
        frameFillStyle,
        className,
      )}
    >
      {children}
    </div>
  );
}

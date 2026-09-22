import { frameSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// The Studio frame surface. Spacing around it is owned by the enclosing shell, not the card.
export function StudioCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-slot="studio-card"
      className={cn('relative min-h-0 flex-1 overflow-hidden rounded-studio-frame', frameSurfaceStyle, className)}
    >
      {children}
    </div>
  );
}

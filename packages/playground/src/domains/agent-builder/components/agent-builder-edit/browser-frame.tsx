import { cn } from '@mastra/playground-ui';
import type { ReactNode } from 'react';

interface BrowserFrameProps {
  children: ReactNode;
  className?: string;
}

export const BrowserFrame = ({ children, className }: BrowserFrameProps) => {
  return (
    <div
      className={cn(
        'h-full min-h-0 overflow-hidden rounded-3xl border border-border1 shadow-elevated bg-surface2',
        className,
      )}
    >
      {children}
    </div>
  );
};

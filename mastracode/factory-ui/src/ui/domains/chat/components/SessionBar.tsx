import { cn } from '@mastra/playground-ui/utils/cn';
import type { ComponentPropsWithoutRef } from 'react';

/**
 * Page-level bar above a chat surface (session breadcrumb, actions). App
 * chrome (sidebar trigger, global search) lives in the root frame's
 * `ChatHeader`, so this bar only renders when the page has something to show.
 */
export function SessionBar({ children, className, ...props }: ComponentPropsWithoutRef<'header'>) {
  if (!children) return null;
  return (
    <header className={cn('flex h-11 min-w-0 shrink-0 items-center gap-2 px-3', className)} {...props}>
      {children}
    </header>
  );
}

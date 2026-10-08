import { ScrollArea, ScrollAreaViewport } from '@mastra/playground-ui/components/ScrollArea';
import { useContext } from 'react';
import type { ReactNode } from 'react';
import { FeatureWorkspaceContext } from '../feature-workspace-context';
import { cn } from '@/lib/utils';

/** Shared positioning for navigation composed by each route or view. */
export function ContextualSidebarLayout({
  label,
  header,
  children,
  footer,
  className,
}: {
  label: string;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const workspace = useContext(FeatureWorkspaceContext);
  const Container = workspace ? 'div' : 'aside';
  return (
    <Container
      aria-label={workspace ? undefined : label}
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-col bg-card [--border:var(--surface-rim)] [&_li>a]:rounded-xl [&_li>button]:rounded-xl',
        !workspace && 'border-r border-surface-rim',
        className,
      )}
    >
      {header}
      <ScrollArea className="min-h-0 flex-1" mask={false}>
        <ScrollAreaViewport className="overscroll-contain [&>div]:flex [&>div]:h-full [&>div]:flex-col">
          {children}
        </ScrollAreaViewport>
      </ScrollArea>
      {footer}
    </Container>
  );
}

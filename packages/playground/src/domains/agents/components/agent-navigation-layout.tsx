import type { ReactNode } from 'react';
import { ContextualSidebarLayout } from '@/components/ui/contextual-sidebar-layout';

/** Agent navigation fills the frame; the active view supplies its sections. */
export function AgentNavigationLayout({
  recentAgents,
  views,
  children,
}: {
  recentAgents: ReactNode;
  views: ReactNode;
  children?: ReactNode;
}) {
  return (
    <ContextualSidebarLayout label="Agent navigation" header={recentAgents}>
      {views}
      {children}
    </ContextualSidebarLayout>
  );
}

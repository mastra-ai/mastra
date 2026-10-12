import type { ReactNode } from 'react';
import { ContextualSidebarLayout } from '@/components/ui/contextual-sidebar-layout';

/** Agent navigation fills the frame; the active view supplies its sections. */
export function AgentNavigationLayout({ header, children }: { header: ReactNode; children?: ReactNode }) {
  return (
    <ContextualSidebarLayout label="Agent navigation" header={header}>
      {children}
    </ContextualSidebarLayout>
  );
}

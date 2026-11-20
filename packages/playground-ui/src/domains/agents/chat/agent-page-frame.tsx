import type { ReactNode } from 'react';
import { AgentPageBody } from './agent-page-body';
import { PageLayout } from '@/ds/components/PageLayout';

/** Studio's agent header and tabbed body; hosts supply their navigation and actions. */
export function AgentPageFrame({
  agentId,
  breadcrumbs,
  headerActions,
  tabs,
  children,
}: {
  agentId: string;
  breadcrumbs: ReactNode;
  headerActions: ReactNode;
  tabs: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageLayout breadcrumbs={breadcrumbs} headerActions={headerActions}>
      <PageLayout.Workspace>
        <h1 className="sr-only">{agentId}</h1>
        <AgentPageBody tabs={tabs}>{children}</AgentPageBody>
      </PageLayout.Workspace>
    </PageLayout>
  );
}

import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useAgents } from '@mastra/react/hooks/agents';
import { useTools } from '@mastra/react/hooks/tools';
import { useState } from 'react';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { navCrumb } from '@/domains/navigation/crumbs';
import { ToolDrawer } from '@/domains/tools/components/tool-drawer/tool-drawer';
import { ToolsPageDrawerBody } from '@/domains/tools/components/tool-drawer/tools-page-tool-drawer-body';
import { NoToolsInfo } from '@/domains/tools/components/tools-list/no-tools-info';
import { ToolsList } from '@/domains/tools/components/tools-list/tools-list';
import type { ToolsSort } from '@/domains/tools/components/tools-list/tools-list';
import { useToolDrawerParam } from '@/domains/tools/hooks/use-tool-drawer-param';

const crumbs = [navCrumb('/tools')];

export default function Tools() {
  const { hasPermission, isLoading: isLoadingPermissions } = usePermissions();
  const canReadAgents = !isLoadingPermissions && hasPermission('agents:read');
  const {
    data: availableAgents = {},
    isLoading: isLoadingAgents,
    error: agentsError,
  } = useAgents({
    queryOptions: { enabled: canReadAgents },
  });
  const { data: tools = {}, isLoading: isLoadingTools, error: toolsError } = useTools();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ToolsSort>();
  const { toolId: openToolId } = useToolDrawerParam();

  const agentsRecord = canReadAgents ? availableAgents : {};
  const isLoading = (canReadAgents && isLoadingAgents) || isLoadingTools;
  const error = toolsError || (canReadAgents ? agentsError : undefined);
  const hasTools =
    Object.keys(tools).length > 0 || Object.values(agentsRecord).some(agent => Object.keys(agent.tools).length > 0);

  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Tools</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Tools</h1>
        <PermissionDenied variant="fill" resource="tools" />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Tools</h1>
        <EmptyState tone="error" variant="fill" titleSlot="Failed to load tools" descriptionSlot={error.message} />
      </PageLayout>
    );
  }

  if (!hasTools && !isLoading) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Tools</h1>
        <NoToolsInfo />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      actionRow={
        <ActionRow>
          <ActionRow.Start>
            <div className="max-w-120 flex-1">
              <ListSearch onSearch={setSearch} label="Filter tools" placeholder="Filter by name" />
            </div>
          </ActionRow.Start>
        </ActionRow>
      }
    >
      <h1 className="sr-only">Tools</h1>
      <ToolsList
        tools={tools}
        agents={agentsRecord}
        isLoading={isLoading}
        search={search}
        sort={sort}
        onSortChange={(direction, key) => setSort({ key, direction })}
        selectedToolId={openToolId}
      />
      <ToolDrawer>
        <ToolsPageDrawerBody />
      </ToolDrawer>
    </PageLayout>
  );
}

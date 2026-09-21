import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useState } from 'react';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { McpServersList } from '@/domains/mcps/components/mcps-list/mcps-list';
import { NoMCPServersInfo } from '@/domains/mcps/components/mcps-list/no-mcp-servers-info';
import { useMCPServers } from '@/domains/mcps/hooks/use-mcp-servers';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/mcps')];

const MCPs = () => {
  const { data: mcpServers = [], isLoading, error } = useMCPServers();
  const [search, setSearch] = useState('');

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <PermissionDenied resource="MCP servers" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <ErrorState title="Failed to load MCP servers" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (mcpServers.length === 0 && !isLoading) {
    return (
      <NoDataPageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <NoMCPServersInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} className="grid grid-rows-[auto_minmax(0,1fr)] p-4">
      <PageLayout.TopArea>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter MCP servers" placeholder="Filter by name" />
        </div>
      </PageLayout.TopArea>

      <McpServersList mcpServers={mcpServers} isLoading={isLoading} search={search} />
    </PageLayout>
  );
};

export default MCPs;

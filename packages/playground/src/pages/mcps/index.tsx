import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useState } from 'react';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { McpServersList } from '@/domains/mcps/components/mcps-list/mcps-list';
import type { McpServersSort } from '@/domains/mcps/components/mcps-list/mcps-list';
import { NoMCPServersInfo } from '@/domains/mcps/components/mcps-list/no-mcp-servers-info';
import { useMCPServers } from '@/domains/mcps/hooks/use-mcp-servers';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/mcps')];

const MCPs = () => {
  const { data: mcpServers = [], isLoading, error } = useMCPServers();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<McpServersSort>();

  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">MCP Servers</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">MCP Servers</h1>
        <PermissionDenied variant="fill" resource="MCP servers" />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">MCP Servers</h1>
        <ErrorState variant="fill" title="Failed to load MCP servers" message={error.message} />
      </PageLayout>
    );
  }

  if (mcpServers.length === 0 && !isLoading) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">MCP Servers</h1>
        <NoMCPServersInfo />
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
              <ListSearch onSearch={setSearch} label="Filter MCP servers" placeholder="Filter by name" />
            </div>
          </ActionRow.Start>
        </ActionRow>
      }
    >
      <h1 className="sr-only">MCP Servers</h1>
      <McpServersList
        mcpServers={mcpServers}
        isLoading={isLoading}
        search={search}
        sort={sort}
        onSortChange={(direction, key) => setSort({ key, direction })}
      />
    </PageLayout>
  );
};

export default MCPs;

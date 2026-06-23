import {
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { useState } from 'react';
import { McpServersList } from '@/domains/mcps/components/mcps-list/mcps-list';
import { NoMCPServersInfo } from '@/domains/mcps/components/mcps-list/no-mcp-servers-info';
import { useMCPServers } from '@/domains/mcps/hooks/use-mcp-servers';

const MCPs = () => {
  const { data: mcpServers = [], isLoading, error } = useMCPServers();
  const [search, setSearch] = useState('');

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="MCP servers" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load MCP servers" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (mcpServers.length === 0 && !isLoading) {
    return (
      <NoDataPageLayout>
        <NoMCPServersInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
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

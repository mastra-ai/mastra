import {
  ButtonWithTooltip,
  ErrorState,
  ListSearch,
  McpServerIcon,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { BookIcon } from 'lucide-react';
import { useState } from 'react';
import { McpServersList } from '@/domains/mcps/components/mcps-list/mcps-list';
import { NoMCPServersInfo } from '@/domains/mcps/components/mcps-list/no-mcp-servers-info';
import { useMCPServers } from '@/domains/mcps/hooks/use-mcp-servers';

const MCPs = () => {
  const { data: mcpServers = [], isLoading, error } = useMCPServers();
  const [search, setSearch] = useState('');

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout title="MCP Servers" icon={<McpServerIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="MCP Servers" icon={<McpServerIcon />}>
        <PermissionDenied resource="MCP servers" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="MCP Servers" icon={<McpServerIcon />}>
        <ErrorState title="Failed to load MCP servers" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (mcpServers.length === 0 && !isLoading) {
    return (
      <NoDataPageLayout title="MCP Servers" icon={<McpServerIcon />}>
        <NoMCPServersInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <McpServerIcon /> MCP Servers
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/tools-mcp/mcp-overview"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to MCP documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </PageLayout.Column>
        </PageLayout.Row>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter MCP servers" placeholder="Filter by name" />
        </div>
      </PageLayout.TopArea>

      <McpServersList mcpServers={mcpServers} isLoading={isLoading} search={search} />
    </PageLayout>
  );
};

export default MCPs;

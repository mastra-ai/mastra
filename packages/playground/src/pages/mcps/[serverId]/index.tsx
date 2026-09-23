import { Badge } from '@mastra/playground-ui/components/Badge';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { MCPDetail } from '@/domains/mcps/components/MCPDetail';
import { useMCPServers } from '@/domains/mcps/hooks/use-mcp-servers';
import { mcpServerCrumb, navCrumb } from '@/domains/navigation/crumbs';

export const McpServerPage = () => {
  const { serverId } = useParams();
  const crumbs = [navCrumb('/mcps'), mcpServerCrumb];
  const { data: mcpServers = [], isLoading } = useMCPServers();

  const server = mcpServers.find(server => server.id === serverId);
  // MCP v2 servers speak Streamable HTTP only; servers that predate transport reporting are 1.x (SSE available).
  const hasSse = server?.transports?.includes('sse') ?? true;

  const header =
    isLoading || server ? (
      <PageHeader>
        <PageHeader.Title isLoading={isLoading}>{server?.name}</PageHeader.Title>
        {server && (
          <PageHeader.Meta beside>
            <Badge size="sm">v{server.version_detail.version}</Badge>
          </PageHeader.Meta>
        )}
        {server && (
          <PageHeader.Description>
            {hasSse
              ? 'This MCP server can be accessed through multiple transport methods. Choose the one that best fits your use case.'
              : 'This MCP server speaks Streamable HTTP only (protocol 2026-07-28).'}
          </PageHeader.Description>
        )}
      </PageHeader>
    ) : undefined;

  return (
    <PageLayout variant="narrow" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} header={header}>
      <MCPDetail isLoading={isLoading} server={server} />
    </PageLayout>
  );
};

import { Link } from 'react-router';

import {
  Txt,
  Header,
  HeaderTitle,
  Icon,
  Badge,
  ToolsIcon,
  Button,
  McpCoinIcon,
  McpServerIcon,
  EmptyState,
} from '@mastra/playground-ui';

import { useMCPServers } from '@/hooks/use-mcp-servers';
import { useMCPServerTools } from '@/hooks/use-mcp-server-tools';
import { client } from '@/lib/client';

import { ServerInfo } from '@mastra/core/mcp';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

const McpServerRow = ({ server }: { server: ServerInfo }) => {
  const { tools, isLoading } = useMCPServerTools(server);
  const effectiveBaseUrl = client.options.baseUrl || 'http://localhost:4111';
  const sseUrl = `${effectiveBaseUrl}/api/mcp/${server.id}/sse`;

  const toolsCount = Object.keys(tools || {}).length;

  return (
    <Link
      to={`/mcps/${server.id}`}
      className="flex justify-between items-center pl-5 pr-6 h-table-row border-b-sm border-border1 hover:bg-surface3 cursor-pointer group/mcp-server"
    >
      <div className="flex gap-3 items-center">
        <Icon size="lg">
          <McpServerIcon />
        </Icon>

        <div>
          <Txt variant="ui-md" className="font-medium text-icon6 !leading-none pb-1">
            {server.name}
          </Txt>
          <Txt variant="ui-xs" className="text-icon3 !leading-none">
            {sseUrl}
          </Txt>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-4 w-24" />
      ) : (
        <Badge icon={<ToolsIcon className="group-hover/mcp-server:text-[#ECB047]" />}>
          {toolsCount} tool{toolsCount === 1 ? '' : 's'}
        </Badge>
      )}
    </Link>
  );
};

const MCPs = () => {
  const { servers, isLoading } = useMCPServers();

  const mcpServers = servers ?? [];

  if (isLoading) return null;

  return (
    <section className="overflow-hidden h-full">
      <Header>
        <HeaderTitle>MCP Servers</HeaderTitle>
      </Header>

      {mcpServers.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            iconSlot={<McpCoinIcon />}
            titleSlot="Configure MCP servers"
            descriptionSlot="MCP servers are not configured yet. You can find more information in the documentation."
            actionSlot={
              <Button
                size="lg"
                className="w-full"
                variant="light"
                as="a"
                href="https://mastra.ai/en/docs/getting-started/mcp-docs-server"
                target="_blank"
              >
                <Icon>
                  <McpServerIcon />
                </Icon>
                Docs
              </Button>
            }
          />
        </div>
      ) : (
        <ScrollArea className="h-full">
          <ul>
            {(mcpServers || []).map(server => (
              <li key={server.id}>
                <McpServerRow server={server} />
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </section>
  );
};

export default MCPs;

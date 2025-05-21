import { Link } from 'react-router';

import { Txt, Header, HeaderTitle, Icon, Badge, ToolsIcon } from '@mastra/playground-ui';

import { useMCPServers } from '@/hooks/use-mcp-servers';
import { useMCPServerTools } from '@/hooks/use-mcp-server-tools';
import { client } from '@/lib/client';

import { ServerInfo } from '@mastra/core/mcp';
import { Skeleton } from '@/components/ui/skeleton';
import { McpServerIcon } from '@mastra/playground-ui';
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
  const { servers: mcpServers } = useMCPServers();

  return (
    <section className="overflow-hidden">
      <Header>
        <HeaderTitle>MCP Servers</HeaderTitle>
      </Header>

      <ScrollArea className="h-full">
        <ul>
          {(mcpServers || []).map(server => (
            <li key={server.id}>
              <McpServerRow server={server} />
            </li>
          ))}
        </ul>
      </ScrollArea>
    </section>
  );
};

export default MCPs;

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
  AgentIcon,
  WorkflowIcon,
  MainContentLayout,
  MainContentContent,
} from '@mastra/playground-ui';

import { useMCPServers } from '@/hooks/use-mcp-servers';
import { useMCPServerTools } from '@/hooks/use-mcp-server-tools';
import { client } from '@/lib/client';

import { ServerInfo } from '@mastra/core/mcp';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const McpServerRow = ({ server }: { server: ServerInfo }) => {
  const { tools, isLoading } = useMCPServerTools(server);
  const effectiveBaseUrl = client.options.baseUrl || 'http://localhost:4111';
  const sseUrl = `${effectiveBaseUrl}/api/mcp/${server.id}/sse`;

  const toolsCount = Object.keys(tools || {}).length;
  const agentToolsCount = Object.keys(tools || {}).filter(tool => tools?.[tool]?.toolType === 'agent').length;
  const workflowToolsCount = Object.keys(tools || {}).filter(tool => tools?.[tool]?.toolType === 'workflow').length;

  const toolsOnlyCount = toolsCount - agentToolsCount - workflowToolsCount;
  const showBreakdown = agentToolsCount > 0 || workflowToolsCount > 0;

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
        <div className="flex gap-x-2 items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge icon={<ToolsIcon className="group-hover/mcp-server:text-[#ECB047]" />}>
                {toolsCount} tool{toolsCount === 1 ? '' : 's'}
              </Badge>
            </TooltipTrigger>
            {showBreakdown && (
              <TooltipContent>
                <div className="flex flex-col gap-1">
                  {toolsOnlyCount > 0 && (
                    <span>
                      <ToolsIcon className="inline mr-1" />
                      {toolsOnlyCount} tool{toolsOnlyCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {agentToolsCount > 0 && (
                    <span>
                      <AgentIcon className="inline mr-1" />
                      {agentToolsCount} agent{agentToolsCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {workflowToolsCount > 0 && (
                    <span>
                      <WorkflowIcon className="inline mr-1" />
                      {workflowToolsCount} workflow{workflowToolsCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      )}
    </Link>
  );
};

const MCPs = () => {
  const { servers, isLoading } = useMCPServers();

  const mcpServers = servers ?? [];

  if (isLoading) return null;

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>MCP Servers</HeaderTitle>
      </Header>

      {mcpServers.length === 0 ? (
        <MainContentContent isCentered={true}>
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
        </MainContentContent>
      ) : (
        <MainContentContent>
          <ul>
            {(mcpServers || []).map(server => (
              <li key={server.id}>
                <McpServerRow server={server} />
              </li>
            ))}
          </ul>
        </MainContentContent>
      )}
    </MainContentLayout>
  );
};

export default MCPs;

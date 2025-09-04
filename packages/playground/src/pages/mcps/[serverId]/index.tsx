import { CodeMirrorBlock } from '@/components/ui/code-mirror-block';
import { CopyButton } from '@/components/ui/copy-button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMCPServerTools } from '@/hooks/use-mcp-server-tools';
import { useMCPServers } from '@/hooks/use-mcp-servers';
import { ToolIconMap } from '@/types';

import { McpToolInfo } from '@mastra/client-js';
import { ServerInfo } from '@mastra/core/mcp';
import {
  Header,
  Crumb,
  Breadcrumb,
  Txt,
  Badge,
  FolderIcon,
  Icon,
  McpServerIcon,
  EntityDescription,
  EntityContent,
  Entity,
  EntityName,
  EntityIcon,
  MainContentLayout,
  MainContentContent,
  PlaygroundTabs,
  TabList,
  Tab,
  TabContent,
} from '@mastra/playground-ui';
import { useRef } from 'react';
import { Link, useParams } from 'react-router';

declare global {
  interface Window {
    MASTRA_SERVER_HOST: string;
    MASTRA_SERVER_PORT: string;
  }
}

export const McpServerPage = () => {
  const { serverId } = useParams();
  const { servers: mcpServers, isLoading } = useMCPServers();

  const server = mcpServers?.find(server => server.id === serverId);

  const host = window.MASTRA_SERVER_HOST;
  const port = window.MASTRA_SERVER_PORT;

  let baseUrl = null;
  if (host && port) {
    baseUrl = `http://${host}:${port}`;
  }

  const effectiveBaseUrl = baseUrl || 'http://localhost:4111';
  const sseUrl = `${effectiveBaseUrl}/api/mcp/${serverId}/sse`;
  const httpStreamUrl = `${effectiveBaseUrl}/api/mcp/${serverId}/mcp`;

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/mcps`}>
            MCP Servers
          </Crumb>

          <Crumb as={Link} to={`/mcps/${serverId}`} isCurrent>
            {isLoading ? <Skeleton className="w-20 h-4" /> : server?.name || 'Not found'}
          </Crumb>
        </Breadcrumb>
      </Header>

      {isLoading ? null : server ? (
        <MainContentContent isDivided={true}>
          <div className="px-8 py-20 mx-auto max-w-[604px] w-full">
            <Txt as="h1" variant="header-md" className="text-icon6 font-medium pb-4">
              {server.name}
            </Txt>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <Badge
                  icon={<span className="font-mono w-6 text-accent1 text-ui-xs font-medium">SSE</span>}
                  className="!text-icon4"
                >
                  {sseUrl}
                </Badge>
                <CopyButton tooltip="Copy SSE URL" content={sseUrl} iconSize="sm" />
              </div>

              <div className="flex items-center gap-1">
                <Badge
                  icon={<span className="font-mono w-6 text-accent1 text-ui-xs font-medium">HTTP</span>}
                  className="!text-icon4"
                >
                  {httpStreamUrl}
                </Badge>
                <CopyButton tooltip="Copy HTTP Stream URL" content={httpStreamUrl} iconSize="sm" />
              </div>
            </div>

            <div className="flex items-center gap-1 pt-3 pb-9">
              <Badge icon={<FolderIcon className="text-icon6" />} className="rounded-r-sm !text-icon4">
                Version
              </Badge>

              <Badge className="rounded-l-sm !text-icon4">{server.version_detail.version}</Badge>
            </div>

            <McpSetupTabs sseUrl={sseUrl} serverName={server.name} />
          </div>

          <div className="h-full overflow-y-scroll border-l-sm border-border1">
            <McpToolList server={server} />
          </div>
        </MainContentContent>
      ) : (
        <MainContentContent>
          <Txt as="h1" variant="header-md" className="text-icon3 font-medium py-20 text-center">
            Server not found
          </Txt>
        </MainContentContent>
      )}
    </MainContentLayout>
  );
};

const McpToolList = ({ server }: { server: ServerInfo }) => {
  const { tools, isLoading } = useMCPServerTools(server);

  if (isLoading) return null;

  const toolsKeyArray = Object.keys(tools);

  return (
    <div className="p-5 overflow-y-scroll">
      <div className="text-icon6 flex gap-2 items-center">
        <Icon size="lg" className="bg-surface4 rounded-md p-1">
          <McpServerIcon />
        </Icon>

        <Txt variant="header-md" as="h2" className="font-medium">
          Available Tools
        </Txt>
      </div>

      <div className="flex flex-col gap-2 pt-6">
        {toolsKeyArray.map(toolId => {
          const tool = tools[toolId];

          return <ToolEntry key={toolId} tool={tool} serverId={server.id} />;
        })}
      </div>
    </div>
  );
};

const ToolEntry = ({ tool, serverId }: { tool: McpToolInfo; serverId: string }) => {
  const linkRef = useRef<HTMLAnchorElement>(null);

  const ToolIconComponent = ToolIconMap[tool.toolType || 'tool'];

  return (
    <Entity onClick={() => linkRef.current?.click()}>
      <EntityIcon>
        <ToolIconComponent className="group-hover/entity:text-[#ECB047]" />
      </EntityIcon>

      <EntityContent>
        <EntityName>
          <Link ref={linkRef} to={`/mcps/${serverId}/tools/${tool.id}`}>
            {tool.id}
          </Link>
        </EntityName>
        <EntityDescription>{tool.description}</EntityDescription>
      </EntityContent>
    </Entity>
  );
};

const McpSetupTabs = ({ sseUrl, serverName }: { sseUrl: string; serverName: string }) => {
  return (
    <PlaygroundTabs defaultTab="cursor">
      <TabList>
        <Tab value="cursor">Cursor</Tab>
        <Tab value="windsurf">Windsurf</Tab>
      </TabList>

      <TabContent value="cursor">
        <Txt className="text-icon3 pb-4">
          Cursor comes with built-in MCP Support.{' '}
          <Link
            to="https://docs.cursor.com/context/model-context-protocol"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-icon6"
          >
            Following the documentation
          </Link>
          , you can register an MCP server using SSE with the following configuration.
        </Txt>

        <CodeMirrorBlock
          editable={false}
          value={`{
  "mcpServers": {
    "${serverName}": {
      "url": "${sseUrl}"
    }
  }
}`}
        />
      </TabContent>
      <TabContent value="windsurf">
        <Txt className="text-icon3 pb-4">
          Windsurf comes with built-in MCP Support.{' '}
          <Link
            to="https://docs.windsurf.com/windsurf/cascade/mcp#mcp-config-json"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-icon6"
          >
            Following the documentation
          </Link>
          , you can register an MCP server using SSE with the following configuration.
        </Txt>

        <CodeMirrorBlock
          editable={false}
          value={`{
  "mcpServers": {
    "${serverName}": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${sseUrl}"]
    }
  }
}`}
        />
      </TabContent>
    </PlaygroundTabs>
  );
};

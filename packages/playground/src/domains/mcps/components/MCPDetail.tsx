import type { McpToolInfo } from '@mastra/client-js';
import type { ServerInfo } from '@mastra/core/mcp';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import {
  Entity,
  EntityContent,
  EntityDescription,
  EntityIcon,
  EntityName,
} from '@mastra/playground-ui/components/Entity';
import { MainContentContent } from '@mastra/playground-ui/components/MainContent';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { FolderIcon } from '@mastra/playground-ui/icons/FolderIcon';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { McpServerIcon } from '@mastra/playground-ui/icons/McpServerIcon';
import { useEffect, useRef, useState } from 'react';
import { useMCPServerTools } from '../hooks/useMCPServerTools';
import { ToolIconMap } from '@/domains/tools';
import { useLinkComponent } from '@/lib/framework';

export interface MCPDetailProps {
  isLoading: boolean;
  server?: ServerInfo;
}

declare global {
  interface Window {
    MASTRA_SERVER_HOST: string;
    MASTRA_SERVER_PORT: string;
  }
}

export const MCPDetail = ({ isLoading, server }: MCPDetailProps) => {
  const [{ sseUrl, httpStreamUrl }, setUrls] = useState<{ sseUrl: string; httpStreamUrl: string }>({
    sseUrl: '',
    httpStreamUrl: '',
  });

  useEffect(() => {
    if (!server) return;

    const host = window.MASTRA_SERVER_HOST;
    const port = window.MASTRA_SERVER_PORT;

    let baseUrl = null;
    if (host && port) {
      baseUrl = `http://${host}:${port}`;
    }

    const effectiveBaseUrl = baseUrl || 'http://localhost:4111';
    const sseUrl = `${effectiveBaseUrl}/api/mcp/${server.id}/sse`;
    const httpStreamUrl = `${effectiveBaseUrl}/api/mcp/${server.id}/mcp`;

    setUrls({ sseUrl, httpStreamUrl });
  }, [server]);

  if (isLoading) return null;

  if (!server)
    return (
      <MainContentContent>
        <Txt as="h1" variant="header-md" className="py-20 text-center font-medium text-neutral3">
          Server not found
        </Txt>
      </MainContentContent>
    );

  const commandLineConfig = `npx -y mcp-remote ${sseUrl}`;

  return (
    <MainContentContent isDivided={true}>
      <div className="mx-auto w-full max-w-2xl px-8 py-12">
        <Txt as="h1" variant="header-md" className="pb-4 font-medium text-neutral6">
          {server.name}
        </Txt>

        <div className="flex items-center gap-1 pb-6">
          <Badge icon={<FolderIcon className="text-neutral6" />} className="rounded-r-sm text-neutral4!">
            Version
          </Badge>
          <Badge className="rounded-l-sm text-neutral4!">{server.version_detail.version}</Badge>
        </div>

        <Txt className="pb-4 text-neutral3">
          This MCP server can be accessed through multiple transport methods. Choose the one that best fits your use
          case.
        </Txt>

        <div className="flex flex-col gap-4">
          {/* HTTP Stream */}
          <div className="rounded-lg border border-border1 bg-surface3 p-4">
            <Badge icon={<span className="mr-1 w-6 font-mono font-medium text-accent1">HTTP</span>}>
              Regular HTTP Endpoint
            </Badge>

            <Txt className="pt-1 pb-2 text-neutral3">Use for stateless HTTP transport with streamable responses.</Txt>

            <div className="flex items-start gap-2">
              <Txt className="rounded-lg bg-surface4 px-2 py-1">{httpStreamUrl}</Txt>
              <div className="pt-1">
                <CopyButton tooltip="Copy HTTP Stream URL" content={httpStreamUrl} />
              </div>
            </div>
          </div>

          {/* SSE */}
          <div className="rounded-lg border border-border1 bg-surface3 p-4">
            <Badge icon={<span className="mr-1 w-6 font-mono font-medium text-accent1">SSE</span>}>
              Server-Sent Events
            </Badge>

            <Txt className="pt-1 pb-2 text-neutral3">Use for real-time communication via SSE.</Txt>

            <div className="flex items-start gap-2">
              <Txt className="rounded-lg bg-surface4 px-2 py-1">{sseUrl}</Txt>
              <div className="pt-1">
                <CopyButton tooltip="Copy SSE URL" content={sseUrl} />
              </div>
            </div>
          </div>

          {/* Command Line */}
          <div className="rounded-lg border border-border1 bg-surface3 p-4">
            <Badge icon={<span className="mr-1 w-6 font-mono font-medium text-accent1">CLI</span>}>Command Line</Badge>

            <Txt className="pt-1 pb-2 text-neutral3">Use for local command-line access via npx and mcp-remote.</Txt>

            <div className="flex items-start gap-2">
              <Txt className="rounded-lg bg-surface4 px-2 py-1">{commandLineConfig}</Txt>
              <div className="pt-1">
                <CopyButton tooltip="Copy Command Line Config" content={commandLineConfig} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-full overflow-y-scroll border-l border-border1">
        <McpToolList server={server} />
      </div>
    </MainContentContent>
  );
};

const McpToolList = ({ server }: { server: ServerInfo }) => {
  const { data: tools = {}, isLoading } = useMCPServerTools(server);

  if (isLoading) return null;

  const toolsKeyArray = Object.keys(tools);

  return (
    <div className="overflow-y-scroll p-5">
      <div className="flex items-center gap-2 text-neutral6">
        <Icon size="lg" className="rounded-md bg-surface4 p-1">
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

/** Check if a tool has an MCP App UI resource */
function hasAppUi(meta?: Record<string, unknown>): boolean {
  if (!meta) return false;
  const ui = meta.ui as { resourceUri?: string } | undefined;
  if (typeof ui?.resourceUri === 'string' && ui.resourceUri.startsWith('ui://')) return true;
  if (typeof meta['ui/resourceUri'] === 'string' && (meta['ui/resourceUri'] as string).startsWith('ui://')) return true;
  return false;
}

const ToolEntry = ({ tool, serverId }: { tool: McpToolInfo; serverId: string }) => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const { Link, paths } = useLinkComponent();

  const ToolIconComponent = ToolIconMap[tool.toolType || 'tool'];
  const isAppTool = hasAppUi(tool._meta);

  return (
    <Entity onClick={() => linkRef.current?.click()}>
      <EntityIcon>
        <ToolIconComponent className="group-hover/entity:text-accent6" />
      </EntityIcon>

      <EntityContent>
        <EntityName>
          <span className="flex items-center gap-2">
            <Link ref={linkRef} href={paths.mcpServerToolLink(serverId, tool.id)}>
              {tool.id}
            </Link>
            {isAppTool && <Badge className="py-0 text-[10px]">App</Badge>}
          </span>
        </EntityName>
        <EntityDescription>{tool.description}</EntityDescription>
      </EntityContent>
    </Entity>
  );
};

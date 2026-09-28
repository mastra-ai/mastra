import type { McpServerInfo } from '@mastra/client-js';
import { Card, CardContent, CardHeader, CardTitle } from '@mastra/playground-ui/components/Card';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEffect, useState } from 'react';
import { McpServerToolsList } from './mcp-server-tools-list';

export interface MCPDetailProps {
  isLoading: boolean;
  server?: McpServerInfo;
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
      <Txt as="h1" variant="heading" tone="muted" className="py-20 text-center">
        Server not found
      </Txt>
    );

  // MCP v2 servers speak Streamable HTTP only; the SSE endpoint exists for 1.x servers.
  // Servers that predate transport reporting are 1.x, so absence means SSE is available.
  const hasSse = server.transports?.includes('sse') ?? true;
  const commandLineConfig = `npx -y mcp-remote ${hasSse ? sseUrl : httpStreamUrl}`;

  const endpoints = [
    {
      value: 'http',
      label: 'HTTP',
      description: 'Use for stateless HTTP transport with streamable responses.',
      content: httpStreamUrl,
      tooltip: 'Copy HTTP Stream URL',
    },
    ...(hasSse
      ? [
          {
            value: 'sse',
            label: 'SSE',
            description: 'Use for real-time communication via SSE.',
            content: sseUrl,
            tooltip: 'Copy SSE URL',
          },
        ]
      : []),
    {
      value: 'cli',
      label: 'CLI',
      description: 'Use for local command-line access via npx and mcp-remote.',
      content: commandLineConfig,
      tooltip: 'Copy Command Line Config',
    },
  ];

  return (
    <div className="flex flex-col gap-6 pt-4">
      <Card>
        <Tabs defaultTab="http">
          <CardHeader className="border-border1 flex-row items-center justify-between gap-3 space-y-0 border-b">
            <CardTitle className="shrink-0">Connect</CardTitle>
            <div className="min-w-0">
              <TabList variant="pill-ghost" size="sm">
                {endpoints.map(endpoint => (
                  <Tab key={endpoint.value} value={endpoint.value}>
                    {endpoint.label}
                  </Tab>
                ))}
              </TabList>
            </div>
          </CardHeader>

          {endpoints.map(endpoint => (
            <TabContent key={endpoint.value} value={endpoint.value} flush>
              <CardContent className="flex flex-col gap-3">
                <Txt tone="muted">{endpoint.description}</Txt>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted py-2 pr-2 pl-3">
                  <Txt as="span" font="mono" className="min-w-0 break-all">
                    {endpoint.content}
                  </Txt>
                  <CopyButton tooltip={endpoint.tooltip} content={endpoint.content} />
                </div>
              </CardContent>
            </TabContent>
          ))}
        </Tabs>
      </Card>

      <McpServerToolsList server={server} />
    </div>
  );
};

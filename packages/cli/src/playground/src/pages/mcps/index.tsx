import { useState } from 'react';
import { useNavigate } from 'react-router';
import { HardDrive, CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Header, HeaderTitle } from '@mastra/playground-ui';

import { useMCPServers } from '@/hooks/use-mcp-servers';
import { useMCPServerTools } from '@/hooks/use-mcp-server-tools';
import { client } from '@/lib/client';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { ServerInfo } from '@mastra/core/mcp';

const MCPs = () => {
  const { servers: mcpServers, isLoading: isLoadingMCPServers } = useMCPServers();
  const [selectedServer, setSelectedServer] = useState<ServerInfo | null>(null);

  const { tools: selectedServerTools, isLoading: isLoadingServerTools } = useMCPServerTools(selectedServer);

  const effectiveBaseUrl = client.options.baseUrl || 'http://localhost:4111';
  const sseUrl = `${effectiveBaseUrl}/api/mcp/${selectedServer?.id}/sse`;
  const httpStreamUrl = `${effectiveBaseUrl}/api/mcp/${selectedServer?.id}/mcp`;

  const navigate = useNavigate();
  const { handleCopy: copySSEUrlToClipboard } = useCopyToClipboard({
    text: sseUrl,
    copyMessage: 'SSE URL copied to clipboard!',
  });
  const { handleCopy: copyStreamableHttpUrlToClipboard } = useCopyToClipboard({
    text: httpStreamUrl,
    copyMessage: 'Streamable HTTP URL copied to clipboard!',
  });

  const handleSelectServer = (server: ServerInfo) => {
    setSelectedServer(server);
  };

  if (isLoadingMCPServers) {
    return (
      <div className="h-full w-full">
        <Header>
          <HeaderTitle>MCP Servers & Tools</HeaderTitle>
        </Header>
        <div className="w-full h-full grid grid-cols-[300px_1fr] py-6 px-4">
          <div className="flex flex-col gap-4">
            {/* Skeleton for server list */}
            <div className="flex flex-col gap-2">
              <div className="px-2 py-2 rounded-md bg-mastra-bg-13 mb-2">
                <div className="flex gap-2 items-center">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-2 items-center px-2 py-2 rounded-md bg-mastra-bg-13">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
          <div className="border-l border-mastra-border-1 pl-4">
            <Skeleton className="h-full w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full ">
      <Header>
        <HeaderTitle>MCP Servers & Tools</HeaderTitle>
      </Header>
      <div className="w-full h-full grid grid-cols-[300px_1fr]">
        <div className="w-full h-full border-r-[0.5px] border-mastra-border-1 py-6 px-4">
          <ul className="flex flex-col gap-4">
            {mcpServers &&
              Object.values(mcpServers).map((server: ServerInfo) => (
                <li
                  key={server.id}
                  className={cn(
                    'px-2 py-2 rounded-md hover:bg-mastra-bg-4/80 transition-colors cursor-pointer',
                    selectedServer?.id === server.id && 'bg-mastra-bg-4/80',
                  )}
                  onClick={() => handleSelectServer(server)}
                >
                  <div className="flex gap-2 items-center">
                    <HardDrive className="size-3" />
                    <p className="text-sm text-mastra-el-6">{server.name}</p>
                  </div>
                </li>
              ))}
            {!mcpServers &&
              [1, 2, 3].map(i => (
                <li key={i} className="px-2 py-2 rounded-md bg-mastra-bg-13">
                  <div className="flex gap-2 items-center">
                    <Skeleton className="h-3 w-3" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </li>
              ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4 py-6 px-4 h-full overflow-y-scroll">
          {selectedServer && (
            <div className="mb-4 p-3 border border-mastra-border-1 rounded-md bg-mastra-bg-13">
              <div className="mb-2">
                <p className="text-xs text-mastra-el-3 mb-1">SSE Endpoint:</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm text-mastra-el-6 bg-mastra-bg-2 p-1 rounded text-nowrap overflow-x-auto">
                    {sseUrl}
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => copySSEUrlToClipboard()} title="Copy SSE URL">
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-xs text-mastra-el-3 mb-1">Streamable HTTP Endpoint:</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm text-mastra-el-6 bg-mastra-bg-2 p-1 rounded text-nowrap overflow-x-auto">
                    {httpStreamUrl}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyStreamableHttpUrlToClipboard()}
                    title="Copy HTTP Stream URL"
                  >
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {selectedServer && isLoadingServerTools ? (
              <>
                {[1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="flex flex-col gap-[0.62rem] bg-mastra-bg-13 px-[0.62rem] py-2 rounded-[0.375rem] border-[0.5px] border-mastra-border-1"
                  >
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </>
            ) : selectedServer && Object.keys(selectedServerTools).length > 0 ? (
              Object.values(selectedServerTools).map(tool => (
                <div
                  onClick={() => {
                    navigate(`/mcps/${selectedServer.id}/${tool.id}`, {
                      state: { toolData: tool, serverName: selectedServer.name },
                    });
                  }}
                  key={tool.id}
                  className="hover:bg-mastra-bg-4/80 transition-colors flex flex-col gap-[0.62rem] bg-mastra-bg-13 px-[0.62rem] py-2 rounded-[0.375rem] cursor-pointer border-[0.5px] border-mastra-border-1"
                >
                  <h3 className="text-sm text-mastra-el-6">{tool.name}</h3>
                  <p className="text-sm text-mastra-el-2 max-h-72 overflow-y-scroll">{tool.description}</p>
                </div>
              ))
            ) : selectedServer ? (
              <div className="col-span-full text-center text-mastra-el-3">
                This server has no tools, or an error occurred fetching them.
              </div>
            ) : (
              <div className="col-span-full text-center text-mastra-el-3">Select an MCP Server to view its tools.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MCPs;

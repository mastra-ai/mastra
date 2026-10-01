import type { McpToolInfo } from '@mastra/client-js';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { McpAppViewer } from '@mastra/playground-ui/domains/mcps/components/mcp-app-viewer';
import { jsonSchemaToZodRuntime } from '@mastra/playground-ui/lib/form/json-schema-to-zod-runtime';
import { z } from 'zod';
import { useMcpAppHtml } from '../hooks/use-mcp-app-html';
import { useExecuteMCPTool } from '../hooks/use-mcp-server-tool';
import { getAppResourceUri, isSuspendedResult } from '../utils/mcp-tool-result';
import { ToolPlayground } from '@/domains/tools/components/tool-playground';
import type { ExecuteTool } from '@/domains/tools/hooks/use-tool-run';
import { isRecord } from '@/domains/tools/utils/is-record';

export interface McpToolPlaygroundProps {
  serverId: string;
  tool: McpToolInfo;
}

/** The Playground for an MCP tool, with its app UI (when it ships one) and a note for suspended results. */
export function McpToolPlayground({ serverId, tool }: McpToolPlaygroundProps) {
  const { mutateAsync, data: result } = useExecuteMCPTool(serverId, tool.name);
  const { data: appHtml } = useMcpAppHtml(serverId, getAppResourceUri(tool._meta));
  const inputSchema: unknown = tool.inputSchema;
  const zodInputSchema = isRecord(inputSchema) ? jsonSchemaToZodRuntime(inputSchema) : z.object({});
  const execute: ExecuteTool = (data, requestContext) => mutateAsync({ data, requestContext });

  return (
    <div className="grid content-start gap-6">
      {appHtml && (
        <McpAppViewer
          html={appHtml}
          toolName={tool.name}
          onToolCall={(_toolName, args) => mutateAsync({ data: args })}
        />
      )}
      {isSuspendedResult(result) && (
        <Notice variant="warning">
          This tool asked for more input, which Studio cannot provide. The suspend payload below shows what it needs.
          Call it from an MCP client with an <code>inputRequests</code> handler to finish the request.
        </Notice>
      )}
      <ToolPlayground
        zodInputSchema={zodInputSchema}
        execute={execute}
        requestContextEntityType="mcp-tool"
        requestContextEntityId={`${serverId}:${tool.name}`}
      />
    </div>
  );
}

import type { McpToolInfo } from '@mastra/client-js';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { McpAppViewer } from '@mastra/playground-ui/domains/mcps/components/mcp-app-viewer';
import { useExecuteMCPTool, useMcpAppHtml } from '@mastra/react/hooks/mcps';
import { getAppResourceUri, isSuspendedResult } from '../utils/mcp-tool-result';
import { ToolPlayground } from '@/domains/tools/components/tool-playground';
import { toZodInputSchema } from '@/domains/tools/utils/to-zod-input-schema';
import type { ToolExecution } from '@/domains/tools/utils/tool-run';

export interface McpToolPlaygroundProps {
  serverId: string;
  tool: McpToolInfo;
}

/** The Playground for an MCP tool, with its app UI (when it ships one) and a note for suspended results. */
export function McpToolPlayground({ serverId, tool }: McpToolPlaygroundProps) {
  const { mutateAsync, status, data: result, error } = useExecuteMCPTool({ serverId, toolId: tool.name });
  const { data: appHtml } = useMcpAppHtml({ serverId, appResourceUri: getAppResourceUri(tool._meta) });
  const zodInputSchema = toZodInputSchema(tool.inputSchema);
  const execution: ToolExecution = {
    execute: (data, requestContext) => mutateAsync({ data, requestContext }),
    status,
    output: result,
    error,
  };

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
          Call it from an MCP client with an <InlineCode>inputRequests</InlineCode> handler to finish the request.
        </Notice>
      )}
      <ToolPlayground
        zodInputSchema={zodInputSchema}
        execution={execution}
        requestContextEntityType="mcp-tool"
        requestContextEntityId={`${serverId}:${tool.name}`}
      />
    </div>
  );
}

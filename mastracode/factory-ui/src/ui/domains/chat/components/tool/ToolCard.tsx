import { ToolCall as SharedToolCall } from '@mastra/playground-ui/components/ai/tool-call';

import type { ToolCall } from '../../services/transcript';

function sharedStatus(status: ToolCall['status']): 'running' | 'success' | 'error' {
  if (status === 'running') return 'running';
  if (status === 'error') return 'error';
  return 'success';
}

/** Adapts Factory's transcript shape to the canonical generic tool-call UI. */
export function ToolCard({ tool }: { tool: ToolCall }) {
  const input = tool.args !== undefined ? tool.args : tool.argsText || undefined;

  return (
    <SharedToolCall
      toolName={tool.toolName}
      input={input}
      result={tool.result}
      output={tool.output || undefined}
      status={sharedStatus(tool.status)}
    />
  );
}

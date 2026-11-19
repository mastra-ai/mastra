import type { McpAppToolInfo } from '@mastra/react/hooks/mcps';
import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { RecordedToolCard } from '@/domains/chat/tools/recorded-tool-card';
import type { ToolCardProps } from '@/domains/chat/tools/tool-card';

/** How the tool calls a trace recorded are drawn, wherever they show (turn messages, a span's Output). */
export interface TraceToolCallsProps {
  /** The agent's MCP app tools (`useMcpAppTools`), so their calls are told apart; optional. */
  mcpAppTools?: Record<string, McpAppToolInfo>;
  /**
   * Draws each tool call. Defaults to `RecordedToolCard`, drawn from what the trace recorded, with no
   * request and no provider; a host may draw richer cards with data of its own (Studio: the live chat cards).
   */
  renderToolCall?: (call: ToolCardProps) => ReactNode;
}

/** The tool card renderer for `MessageRow`: the host's, else the recorded card. Stable across renders. */
export function useTraceToolCardRenderer({ mcpAppTools, renderToolCall }: TraceToolCallsProps) {
  const renderRecorded = useCallback(
    (call: ToolCardProps) => <RecordedToolCard {...call} mcpAppTools={mcpAppTools} />,
    [mcpAppTools],
  );
  return renderToolCall ?? renderRecorded;
}

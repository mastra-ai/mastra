import { useMcpAppTools } from '@mastra/react/hooks/mcps';
import type { TraceToolCallsProps } from '../components/trace-tool-calls';
import { ToolCard } from '@/domains/chat/tools/tool-card';
import type { ToolCardProps } from '@/domains/chat/tools/tool-card';

const renderLiveToolCard = (call: ToolCardProps) => <ToolCard {...call} />;
const NO_MCP_APP_TOOLS: Required<TraceToolCallsProps>['mcpAppTools'] = {};

/**
 * Draws a trace's tool calls with the chat's live cards (the workflow graph and run, the MCP app's UI, the
 * sub-agent's memory thread), which load what the trace did not record through the Mastra client. Spread
 * the result on the parts that draw tool calls; without it, they draw the recorded cards.
 */
export function useLiveToolCalls(): Required<TraceToolCallsProps> {
  const { data: mcpAppTools = NO_MCP_APP_TOOLS } = useMcpAppTools();
  return { mcpAppTools, renderToolCall: renderLiveToolCard };
}

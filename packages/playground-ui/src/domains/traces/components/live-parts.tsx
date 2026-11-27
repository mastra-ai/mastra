import { useTools } from '@mastra/react/hooks/tools';
import { useTraceSpans } from '@mastra/react/hooks/traces';
import { useLiveToolCalls } from '../hooks/use-live-tool-calls';
import { formatSpanToolCallMessages } from './format-trace-thread-messages';
import { SpanDataPanel, useSpanDataPanel } from './span-data-panel';
import { getSpanTools } from './span-payload/span-payload-registry';
import { ThreadTrace } from './thread-trace';
import type { ThreadTraceTurnMessagesProps } from './thread-trace';
import { TracePanel } from './trace-panel';
import type { TracePanelMessagesProps } from './trace-panel';

/*
 * Studio's parts for the detail panels' slots: each loads, through the Mastra client, the data its view
 * draws, and only once that view shows (a tab opens, the messages column shows). Hosts with their own
 * transport put their own parts in these slots.
 */

/** The turn's messages, with the chat's live tool cards and the agent's MCP app tools. */
export function LiveTraceMessages(props: TracePanelMessagesProps) {
  return <TracePanel.Messages {...props} {...useLiveToolCalls()} />;
}

/** A thread turn's messages, with the chat's live tool cards and the agent's MCP app tools. */
export function LiveTurnMessages(props: ThreadTraceTurnMessagesProps) {
  return <ThreadTrace.TurnMessages {...props} {...useLiveToolCalls()} />;
}

/** The span's Input tab, opening the tools it offered once the tool registry loads. */
export function LiveSpanInput() {
  const { span } = useSpanDataPanel();
  // Only a span that offered the model tools lists them: the registry says which have a page.
  const offersTools = !!span && !!getSpanTools(span)?.tools.length;
  const { data: registeredTools } = useTools({ queryOptions: { enabled: offersTools } });
  return <SpanDataPanel.Input registeredTools={registeredTools} />;
}

/** The span's Output tab: the trace's spans give its tool calls their results, drawn with the live cards. */
export function LiveSpanOutput() {
  const { traceId, span } = useSpanDataPanel();
  // Passive: shared with the trace panel and the thread, which already hold the trace when it is open there.
  const { data: trace } = useTraceSpans({ traceId, passive: true, queryOptions: { enabled: !!traceId } });
  const traceSpans = trace?.spans;
  const drawsToolCalls = !!span && formatSpanToolCallMessages(span, traceSpans ?? []).length > 0;
  const toolCalls = useLiveToolCalls({ enabled: drawsToolCalls });
  return <SpanDataPanel.Output traceSpans={traceSpans} {...toolCalls} />;
}

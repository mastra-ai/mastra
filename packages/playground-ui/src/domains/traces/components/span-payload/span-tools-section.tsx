import type { GetToolResponse } from '@mastra/client-js';
import type { SpanRecord, TraceSpanRecord } from '../../types';
import { formatSpanToolCallMessages, getRequestedToolCalls } from '../format-trace-thread-messages';
import { ReadOnlyToolCallProvider } from '../read-only-tool-call-provider';
import { SpanPayloadList, SpanPayloadListName } from './span-payload-primitives';
import { getDelegatedToolHref, getSpanTools } from './span-payload-registry';
import type { SpanTool } from './span-payload-registry';
import { SpanPayloadSection } from './span-payload-section';
import type { SpanPayloadSectionProps } from './span-payload-section';
import { MessageRow } from '@/domains/chat/messages/message-row';
import { Txt } from '@/ds/components/Txt';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { useLinkComponent } from '@/lib/framework';

/** The tool registry as `listTools` returns it: tools by the key they are registered under. */
export type RegisteredTools = Record<string, GetToolResponse>;

/**
 * Registered tool ids by the names a span may record them under: the tool id,
 * or the key it is registered with (what model spans pass to the provider).
 */
function getRegisteredToolIds(tools: RegisteredTools): Map<string, string> {
  const ids = new Map<string, string>();
  for (const [key, tool] of Object.entries(tools)) {
    ids.set(key, tool.id);
    ids.set(tool.id, tool.id);
  }
  return ids;
}

const NO_TOOLS: RegisteredTools = {};

export interface SpanToolListProps {
  tools: SpanTool[];
  /** The tool registry (`listTools`); a tool it holds links to its page. Without it, tools are plain text. */
  registeredTools?: RegisteredTools;
}

/** The tools a span offered the model, linking to their pages when registered. */
export function SpanToolList({ tools, registeredTools = NO_TOOLS }: SpanToolListProps) {
  const { Link, paths } = useLinkComponent();
  const registered = getRegisteredToolIds(registeredTools);

  return (
    <SpanPayloadList
      slot="span-tools"
      card
      items={tools.map(tool => {
        const registeredId = registered.get(tool.id);
        // Workspace, skill and agent-only tools are not in the registry, so they have no page to open.
        const href = getDelegatedToolHref(paths, tool.id) || (registeredId ? paths.toolLink(registeredId) : '');
        return {
          key: tool.id,
          description: tool.description,
          name: href ? (
            <Link href={href} className="w-fit max-w-full truncate text-foreground hover:underline">
              <Txt as="span" variant="label">
                {tool.id}
              </Txt>
            </Link>
          ) : (
            <SpanPayloadListName>{tool.id}</SpanPayloadListName>
          ),
        };
      })}
    />
  );
}

/** The tool calls a span requested, paired with the results their tool spans recorded. */
export type SpanToolCallMessages = ReturnType<typeof formatSpanToolCallMessages>;

export interface SpanToolsSectionProps {
  span: SpanRecord;
  layout?: SpanPayloadSectionProps['layout'];
  /** Every span of the trace (`getTrace`): a call's result lives on its tool span. Without it, calls show no result. */
  traceSpans?: TraceSpanRecord[];
  /** The tool registry (`listTools`), so offered tools link to their pages. */
  registeredTools?: RegisteredTools;
}

/**
 * The tools the model called, each opening on its input and result like in the chat,
 * then the tools the span offered the model.
 */
export function SpanToolsSection({ span, layout, traceSpans, registeredTools }: SpanToolsSectionProps) {
  return (
    <>
      {getRequestedToolCalls(span).length > 0 && (
        <SpanToolCallsSection span={span} layout={layout} traceSpans={traceSpans} />
      )}
      <SpanAvailableToolsSection span={span} layout={layout} registeredTools={registeredTools} />
    </>
  );
}

/** Each call opens on its input and result, like in the chat. */
export function SpanToolCallList({ toolCalls }: { toolCalls: SpanToolCallMessages }) {
  return (
    // Tool rows carry their own vertical margins; strip them at the edges so the container is the only outer spacing.
    <div
      data-slot="span-tool-calls"
      className="flex flex-col [&>[data-slot=message]:first-child]:mt-0 [&>[data-slot=message]:last-child]:mb-0"
    >
      <ReadOnlyToolCallProvider>
        {toolCalls.map(message => (
          <MessageRow key={message.id} message={message} readOnly />
        ))}
      </ReadOnlyToolCallProvider>
    </div>
  );
}

/** The tools the model called, each opening on its input and the result its tool span recorded. */
export function SpanToolCallsSection({ span, layout, traceSpans }: Omit<SpanToolsSectionProps, 'registeredTools'>) {
  const toolCalls = formatSpanToolCallMessages(span, traceSpans ?? []);
  // Only tools the chat never draws (task tools, working memory) were called; the Output JSON keeps them.
  if (toolCalls.length === 0) return null;

  return (
    <SpanPayloadSection
      title={`Tool calls (${toolCalls.length})`}
      icon={<ToolsIcon />}
      raw={getRequestedToolCalls(span)}
      hasPreview
      // Each call folds on its own, so the list never needs clipping.
      clip={false}
      layout={layout}
    >
      <SpanToolCallList toolCalls={toolCalls} />
    </SpanPayloadSection>
  );
}

/** The tools the span offered the model, linking to their pages when registered. */
export function SpanAvailableToolsSection({
  span,
  layout,
  registeredTools,
}: Omit<SpanToolsSectionProps, 'traceSpans'>) {
  const spanTools = getSpanTools(span);
  if (!spanTools) return null;

  return (
    <SpanPayloadSection
      title={`Available tools (${spanTools.tools.length})`}
      icon={<ToolsIcon />}
      raw={spanTools.raw}
      layout={layout}
    >
      <SpanToolList tools={spanTools.tools} registeredTools={registeredTools} />
    </SpanPayloadSection>
  );
}

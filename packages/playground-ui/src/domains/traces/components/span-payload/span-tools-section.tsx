import { useTools } from '@mastra/react/hooks/tools';
import { useTraceSpans } from '@mastra/react/hooks/traces';
import type { ReactNode } from 'react';
import type { SpanRecord } from '../../types';
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

/**
 * Registered tool ids by the names a span may record them under: the tool id,
 * or the key it is registered with (what model spans pass to the provider).
 */
function useRegisteredToolIds(): Map<string, string> {
  const { data: tools = {} } = useTools();
  const ids = new Map<string, string>();
  for (const [key, tool] of Object.entries(tools)) {
    ids.set(key, tool.id);
    ids.set(tool.id, tool.id);
  }
  return ids;
}

function SpanToolList({ tools }: { tools: SpanTool[] }) {
  const { Link, paths } = useLinkComponent();
  const registered = useRegisteredToolIds();

  return (
    <SpanPayloadList
      slot="span-tools"
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

export interface SpanToolsSectionProps {
  span: SpanRecord;
  layout?: SpanPayloadSectionProps['layout'];
}

/**
 * The tools the model called, each opening on its input and result like in the chat,
 * then the tools the span offered the model.
 */
export function SpanToolsSection({ span, layout }: SpanToolsSectionProps) {
  return (
    <>
      {getRequestedToolCalls(span).length > 0 && <SpanToolCallsSection span={span} layout={layout} />}
      <SpanAvailableToolsSection span={span} layout={layout} />
    </>
  );
}

export interface SpanToolCallsSectionProps extends SpanToolsSectionProps {
  /** Replaces the "Tool calls" heading, e.g. with the sentence of the notice the section sits in. */
  heading?: ReactNode;
}

/** The tools the model called, each opening on its input and the result its tool span recorded. */
export function SpanToolCallsSection({ span, layout, heading }: SpanToolCallsSectionProps) {
  // The results live on the tool spans, which the trace panel has usually loaded already.
  const { data } = useTraceSpans({ traceId: span.traceId, passive: true });
  const toolCalls = formatSpanToolCallMessages(span, data?.spans ?? []);
  // Only tools the chat never draws (task tools, working memory) were called; the Output JSON keeps them.
  if (toolCalls.length === 0) return null;

  return (
    <SpanPayloadSection
      title={`Tool calls (${toolCalls.length})`}
      heading={heading}
      icon={<ToolsIcon />}
      raw={getRequestedToolCalls(span)}
      hasPreview
      // Each call folds on its own, so the list never needs clipping.
      clip={false}
      layout={layout}
    >
      {/* Tool rows carry their own vertical margins; strip them at the edges so the card padding is the only outer spacing. */}
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
    </SpanPayloadSection>
  );
}

/** The tools the span offered the model, linking to their pages when registered. */
export function SpanAvailableToolsSection({ span, layout }: SpanToolsSectionProps) {
  const spanTools = getSpanTools(span);
  if (!spanTools) return null;

  return (
    <SpanPayloadSection
      title={`Available tools (${spanTools.tools.length})`}
      icon={<ToolsIcon />}
      raw={spanTools.raw}
      layout={layout}
    >
      <SpanToolList tools={spanTools.tools} />
    </SpanPayloadSection>
  );
}

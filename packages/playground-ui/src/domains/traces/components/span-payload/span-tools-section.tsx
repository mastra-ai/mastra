import type { GetToolResponse } from '@mastra/client-js';
import type { SpanRecord, TraceSpanRecord } from '../../types';
import type { formatSpanToolCallMessages } from '../format-trace-thread-messages';
import { ReadOnlyToolCallProvider } from '../read-only-tool-call-provider';
import { getDelegatedToolOpener, useRecordNavigationOf, useTraceNavigation } from '../trace-navigation';
import { useTraceToolCardRenderer } from '../trace-tool-calls';
import type { TraceToolCallsProps } from '../trace-tool-calls';
import { SpanPayloadList, SpanPayloadListName } from './span-payload-primitives';
import type { SpanTool } from './span-payload-registry';
import { RecordNavigationContext } from '@/domains/chat/context/record-navigation';
import { MessageRow } from '@/domains/chat/messages/message-row';
import { Txt } from '@/ds/components/Txt';

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
  /** The tool registry (`listTools`); a tool it holds opens through `onOpenTool`. Without it, tools are plain text. */
  registeredTools?: RegisteredTools;
}

/** The tools a span offered the model, opening the ones the host can open (registered, or delegated). */
export function SpanToolList({ tools, registeredTools = NO_TOOLS }: SpanToolListProps) {
  const navigation = useTraceNavigation();
  const { onOpenTool } = navigation;
  const registered = getRegisteredToolIds(registeredTools);

  return (
    <SpanPayloadList
      slot="span-tools"
      card
      items={tools.map(tool => {
        const registeredId = registered.get(tool.id);
        // Workspace, skill and agent-only tools are not in the registry, so they have no page to open.
        const open =
          getDelegatedToolOpener(navigation, tool.id) ??
          (registeredId && onOpenTool ? () => onOpenTool(registeredId) : undefined);
        return {
          key: tool.id,
          description: tool.description,
          name: open ? (
            <button
              type="button"
              onClick={open}
              className="w-fit max-w-full truncate text-left text-foreground hover:underline"
            >
              <Txt as="span" variant="label">
                {tool.id}
              </Txt>
            </button>
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

export interface SpanToolCallListProps extends TraceToolCallsProps {
  toolCalls: SpanToolCallMessages;
}

/** Each call opens on its input and result, like in the chat. */
export function SpanToolCallList({ toolCalls, mcpAppTools, renderToolCall }: SpanToolCallListProps) {
  const renderToolCard = useTraceToolCardRenderer({ mcpAppTools, renderToolCall });
  const recordNavigation = useRecordNavigationOf(useTraceNavigation());
  return (
    // Tool rows carry their own vertical margins; strip them at the edges so the container is the only outer spacing.
    <div
      data-slot="span-tool-calls"
      className="flex flex-col [&>[data-slot=message]:first-child]:mt-0 [&>[data-slot=message]:last-child]:mb-0"
    >
      <RecordNavigationContext.Provider value={recordNavigation}>
        <ReadOnlyToolCallProvider>
          {toolCalls.map(message => (
            <MessageRow
              key={message.id}
              message={message}
              readOnly
              mcpAppTools={mcpAppTools}
              renderToolCard={renderToolCard}
            />
          ))}
        </ReadOnlyToolCallProvider>
      </RecordNavigationContext.Provider>
    </div>
  );
}

import { SpanType } from '@mastra/core/observability';
import { isRecord } from '@/domains/chat/messages/signal-data';
import type { SignalData } from '@/domains/chat/messages/signal-data';
import type { SpanRecord } from '@/domains/traces/types';

type SignalSpan = Pick<SpanRecord, 'spanType' | 'input' | 'attributes' | 'metadata'>;

const readString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** Legacy signal types normalized the way core's `createSignal` does. */
function normalizeType(type: string | undefined, tagName: string | undefined) {
  if (type === 'user-message') return { type: 'user', tagName: tagName ?? 'user' };
  if (type === 'system-reminder') return { type: 'reactive', tagName: tagName ?? 'system-reminder' };
  return { type, tagName };
}

/**
 * The signal that started an agent run (`agent.sendSignal()` / `agent.queueSignal()`), read from
 * its AGENT_RUN span. The run's `input` is the signal itself; `attributes.signal` (recorded
 * since signals were traced) carries its `type`, `tagName` and `attributes`, and wins over the
 * input copy. Returns `undefined` for any other span, including resumed runs.
 */
export function getSpanSignal(span: SignalSpan): SignalData | undefined {
  if (span.spanType !== SpanType.AGENT_RUN || span.metadata?.resumed === true) return undefined;
  const input = span.input;
  if (!isRecord(input) || !('contents' in input)) return undefined;

  const recorded = isRecord(span.attributes?.signal) ? span.attributes.signal : undefined;
  if (!recorded && input.__isCreatedSignal !== true) return undefined;

  const source = recorded ?? input;
  const { type, tagName } = normalizeType(
    readString(source.type) ?? readString(input.type),
    readString(source.tagName) ?? readString(input.tagName),
  );
  const attributes = isRecord(source.attributes)
    ? source.attributes
    : isRecord(input.attributes)
      ? input.attributes
      : {};

  return {
    id: readString(source.id) ?? readString(input.id),
    type,
    tagName,
    contents: input.contents,
    ...(Object.keys(attributes).length > 0 ? { attributes: attributes as SignalData['attributes'] } : {}),
    ...(isRecord(input.metadata) ? { metadata: input.metadata } : {}),
  };
}

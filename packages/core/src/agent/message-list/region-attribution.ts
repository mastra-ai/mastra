import { estimateTokenCount } from 'tokenx';
import type { PromptRegionAttribution } from '../../observability/types/tracing';
import type { MessageList } from './index';

/**
 * Region attribution over the FINAL prompt actually sent to the model (after
 * processLLMRequest processors and other post-render rewrites).
 *
 * Regions:
 * - `system`             — untagged MessageList system messages
 * - `tagged-system:<tag>` — one region per taggedSystemMessages key (e.g. memory)
 * - `messages`           — non-system messages (conversation history)
 * - `unattributed`       — content present in the final prompt but not traceable
 *                          to a MessageList partition (processor/loop rewrites)
 *
 * A missing region key means not-present, never zero. Estimates always sum to
 * `totalEstimated` over the final prompt by construction.
 *
 * The emitted shape is the span-attribute contract `PromptRegionAttribution`,
 * which lives with the other span attributes in `observability/types/tracing`.
 */

const ESTIMATION_METHOD = 'tokenx-estimate';

interface PromptLikeMessage {
  role?: unknown;
  content?: unknown;
}

/** Deterministic text projection of a message's content for token estimation. */
function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
          return (part as { text: string }).text;
        }
        return JSON.stringify(part);
      })
      .join('');
  }
  return content === undefined ? '' : JSON.stringify(content);
}

/**
 * Read-only region attribution over the final prompt. Pure function of its
 * inputs — never mutates the MessageList or the messages.
 */
export function attributePromptRegions({
  messageList,
  inputMessages,
}: {
  messageList: Pick<MessageList, 'serializeForSpan'>;
  inputMessages: readonly PromptLikeMessage[];
}): PromptRegionAttribution {
  const { systemMessages } = messageList.serializeForSpan();

  // Map exact system-message text -> region name. Tagged entries win their
  // own region; untagged land in 'system'.
  const systemTextToRegion = new Map<string, string>();
  for (const sys of systemMessages) {
    const text = contentToText(sys.content);
    const region = sys.tag ? `tagged-system:${sys.tag}` : 'system';
    // First writer wins; identical text across regions is attributed to the
    // earlier (untagged-first) partition, matching render order.
    if (!systemTextToRegion.has(text)) {
      systemTextToRegion.set(text, region);
    }
  }

  const regions: Record<string, number> = {};
  let totalEstimated = 0;

  for (const message of inputMessages) {
    const text = contentToText(message.content);
    const tokens = estimateTokenCount(text);
    let region: string;
    if (message.role === 'system') {
      region = systemTextToRegion.get(text) ?? 'unattributed';
    } else {
      region = 'messages';
    }
    regions[region] = (regions[region] ?? 0) + tokens;
    totalEstimated += tokens;
  }

  return { method: ESTIMATION_METHOD, totalEstimated, regions };
}

/**
 * Previous step's serialized prompt, keyed by a per-run object (the
 * MessageList instance). WeakMap so the entry dies with the run.
 */
const previousPromptByKey = new WeakMap<object, string>();

/**
 * Cheap step-to-step prompt-prefix change detector (instrumentation only).
 *
 * Serializes the prompt deterministically and compares against the previous
 * step's serialization for the same key. Returns:
 * - `undefined` on the first step (no previous prompt to compare against)
 * - `false` when the previous prompt is a strict prefix of the current one
 *   (append-only growth — provider prompt caches stay warm)
 * - `true` when earlier bytes changed (prompt prefix invalidated)
 *
 * Cost is one serialization + one startsWith over in-memory strings per step.
 */
export function didPromptPrefixChange(key: object, inputMessages: readonly PromptLikeMessage[]): boolean | undefined {
  const serialized = inputMessages.map(m => `${String(m.role)}\u0000${contentToText(m.content)}`).join('\u0001');
  const previous = previousPromptByKey.get(key);
  previousPromptByKey.set(key, serialized);
  if (previous === undefined) return undefined;
  return !serialized.startsWith(previous);
}

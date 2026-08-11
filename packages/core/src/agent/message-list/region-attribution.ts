import { estimateTokenCount } from 'tokenx';
import type { MessageList } from './index';

/**
 * Prompt token-composition estimate by MessageList region, computed over the
 * FINAL prompt actually sent to the model (after processLLMRequest processors
 * and other post-render rewrites).
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
 */
export interface PromptRegionAttribution {
  /** Token-estimation method used (e.g. 'tokenx-estimate'). */
  method: string;
  /** Sum of all region estimates over the final prompt. */
  totalEstimated: number;
  /** Estimated tokens per region. */
  regions: Record<string, number>;
}

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

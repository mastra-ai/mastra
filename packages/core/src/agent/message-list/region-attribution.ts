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

/**
 * Deterministic text projection of a message's content for token estimation.
 *
 * Structured text payloads (tool-call arguments, tool results) ARE serialized,
 * because the provider serializes them too and charges tokens for them. In a
 * tool-calling loop they are most of the `messages` region, so collapsing them
 * would understate exactly the region a caller is usually trying to measure.
 *
 * Binary payloads are the exception: an image or file part, or any long
 * base64/data-URL string inside a part, projects to a bounded placeholder. Fed
 * whole to the estimator it would dominate every region total it touches, and
 * its real token cost is not a function of its serialized length anyway.
 */
function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(projectPart).join('');
  }
  if (content === undefined) return '';
  if (typeof content === 'object') return projectPart(content);
  return String(content);
}

/** Part types whose payload is bytes, not tokens-worth-of-text. */
const BINARY_PART_TYPES = new Set(['image', 'file']);

/** A data URL, or a long unbroken base64-ish run: too big to estimate, not text anyway. */
function looksBinary(value: string): boolean {
  if (value.startsWith('data:')) return true;
  return value.length > 512 && /^[A-Za-z0-9+/=_-]+$/.test(value);
}

function placeholder(label: string): string {
  return `\u0002${label}\u0002`;
}

function projectPart(part: unknown): string {
  if (typeof part === 'string') return looksBinary(part) ? placeholder('binary') : part;
  if (!part || typeof part !== 'object') return String(part ?? '');
  const text = (part as { text?: unknown }).text;
  if (typeof text === 'string') return text;
  const type = (part as { type?: unknown }).type;
  if (typeof type === 'string' && BINARY_PART_TYPES.has(type)) return placeholder(type);
  try {
    return JSON.stringify(part, (_key, value) => {
      if (typeof value === 'string') return looksBinary(value) ? placeholder('binary') : value;
      // Raw bytes nested in an untyped part: a Uint8Array serializes to
      // {"0":137,"1":80,...} and a Buffer to {"type":"Buffer","data":[...]},
      // both larger than the base64 they replace.
      if (ArrayBuffer.isView(value) || (value as { type?: unknown } | null)?.type === 'Buffer') {
        return placeholder('binary');
      }
      return value;
    });
  } catch {
    // Cyclic or otherwise unserializable: fall back to the type name.
    return placeholder(typeof type === 'string' ? type : 'part');
  }
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
  //
  // Known limitation: when the SAME system text appears both untagged and under
  // a tag, every occurrence is attributed to the first writer (untagged), which
  // under-reports the tagged region. Totals still reconcile.
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
 * Previous step's per-message prompt digests, keyed by a per-run object (the
 * MessageList instance). WeakMap so the entry dies with the run. Digests rather
 * than the prompt itself: retaining a second full copy of every prompt for the
 * life of a run is not a price instrumentation gets to charge.
 */
const previousPromptByKey = new WeakMap<object, string[]>();

/** FNV-1a. Not cryptographic — only needs to be cheap, stable, and collision-shy. */
function digest(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${value.length.toString(36)}:${hash.toString(36)}`;
}

/**
 * Cheap step-to-step prompt-prefix change detector (instrumentation only).
 *
 * Digests each message deterministically and compares against the previous
 * step's digests for the same key. Granularity is per-message, not per-byte:
 * an edit anywhere inside a message counts as a change. Returns:
 * - `undefined` on the first step (no previous prompt to compare against)
 * - `false` when the previous prompt's messages are an unchanged prefix of the
 *   current one (append-only growth — provider prompt caches stay warm)
 * - `true` when an earlier message changed or disappeared (prefix invalidated)
 *
 * Cost is one digest pass over the prompt per step; only digests are retained.
 */
export function didPromptPrefixChange(key: object, inputMessages: readonly PromptLikeMessage[]): boolean | undefined {
  const current = inputMessages.map(m => digest(`${String(m.role)}\u0000${contentToText(m.content)}`));
  const previous = previousPromptByKey.get(key);
  previousPromptByKey.set(key, current);
  if (previous === undefined) return undefined;
  if (previous.length > current.length) return true;
  return previous.some((entry, index) => entry !== current[index]);
}

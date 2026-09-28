import { estimateTokenCount } from 'tokenx';
import type { MastraDBMessage } from '../../agent/message-list';
import { sliceByTokensSafe } from '../../utils/slice-by-tokens';
import type { ProcessToolResultArgs, Processor } from '../index';

/**
 * Configuration options for the ToolResultTokenLimiter processor
 */
export interface ToolResultTokenLimiterOptions {
  /** Maximum number of tokens a single tool result may use */
  limit: number;
}

/**
 * Output processor that limits the size of each tool result, so later model
 * calls see a truncated result instead of a result too large for the context
 * window.
 *
 * Use it alongside `TokenLimiter` when tools can return large results. Without
 * it, one oversized tool result can exceed the input budget, and `TokenLimiter`
 * has to drop the current run's tool call and result to fit.
 *
 * The limited result replaces the original in the message list, so it's also
 * what gets stored. The limiter measures the result as earlier processors left
 * it in the message list, so a processor that runs before it (for example a
 * redactor) has its output limited. Every processor's `result` argument is the
 * tool's original return value, so a processor that runs after the limiter and
 * writes a new result built from `result` replaces the limited one.
 *
 * @example
 * ```ts
 * new Agent({
 *   inputProcessors: [new TokenLimiter(8000)],
 *   outputProcessors: [new ToolResultTokenLimiter(2000)],
 * });
 * ```
 */
export class ToolResultTokenLimiter implements Processor<'tool-result-token-limiter'> {
  public readonly id = 'tool-result-token-limiter';
  public readonly name = 'Tool Result Token Limiter';
  private readonly limit: number;

  constructor(options: number | ToolResultTokenLimiterOptions) {
    this.limit = typeof options === 'number' ? options : options.limit;
    if (!Number.isInteger(this.limit) || this.limit < 1) {
      throw new Error(`ToolResultTokenLimiter: limit must be a positive integer, got ${this.limit}`);
    }
  }

  async processToolResult({ result, toolCallId, toolName, args, messageList }: ProcessToolResultArgs) {
    // An earlier processor may already have rewritten the result in the message list.
    const current = findResult(messageList.get.all.db(), toolCallId);
    const text = toText(current.found ? current.result : result);
    if (text === undefined) return;

    const tokens = estimateTokenCount(text);
    if (tokens <= this.limit) return;

    messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: { state: 'result', toolCallId, toolName, args, result: this.truncate(text, tokens) },
    });
  }

  /**
   * Keep as much text as fits in `limit` tokens together with a marker that
   * reports how many tokens are shown. Falls back to an empty string when the
   * limit is too small for even the marker.
   */
  private truncate(text: string, total: number): string {
    let shown = this.limit;
    while (shown > 0) {
      const marker = `\n[truncated: showing ${shown} of ${total} tokens]`;
      const budget = this.limit - estimateTokenCount(marker);
      if (budget <= 0) break;
      const slice = sliceByTokensSafe(text, 0, Math.min(shown, budget));
      const sliceTokens = estimateTokenCount(slice);
      // Token counts aren't additive across a join, so check the whole value.
      if (sliceTokens === shown && estimateTokenCount(slice + marker) <= this.limit) return slice + marker;
      shown = sliceTokens < shown ? sliceTokens : shown - 1;
    }
    const bare = `[truncated: showing 0 of ${total} tokens]`;
    return estimateTokenCount(bare) <= this.limit ? bare : '';
  }
}

function findResult(messages: MastraDBMessage[], toolCallId: string): { found: boolean; result?: unknown } {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = messages[i]?.content?.parts;
    if (!parts) continue;
    for (const part of parts) {
      if (part?.type === 'tool-invocation' && part.toolInvocation.toolCallId === toolCallId) {
        const invocation = part.toolInvocation;
        if (invocation.state === 'result') return { found: true, result: invocation.result };
      }
    }
  }
  return { found: false };
}

/** Text to measure, or undefined for results this processor leaves alone. */
function toText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (isMedia(value) || (Array.isArray(value) && value.length > 0 && value.every(isMedia))) return undefined;
  try {
    return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v));
  } catch {
    return undefined;
  }
}

function isMedia(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.data === 'string' &&
    (typeof candidate.mediaType === 'string' || typeof candidate.mimeType === 'string')
  );
}

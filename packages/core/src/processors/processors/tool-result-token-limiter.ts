import { estimateTokenCount } from 'tokenx';
import { sliceByTokensSafe } from '../../utils/slice-by-tokens';
import type { ProcessToolResultArgs, Processor } from '../index';

/** Smallest accepted limit, so a useful slice fits beside the truncation marker. */
const MIN_LIMIT = 64;

export interface ToolResultTokenLimiterOptions {
  /** Maximum number of tokens a single tool result may use, including the truncation marker */
  limit: number;
}

/**
 * Output processor that truncates tool results over a token limit before they
 * are stored in the message list or sent to the model on the next step.
 * Provider-executed tool results are left unchanged.
 */
export class ToolResultTokenLimiter implements Processor<'tool-result-token-limiter'> {
  public readonly id = 'tool-result-token-limiter';
  public readonly name = 'ToolResultTokenLimiter';
  private readonly limit: number;

  constructor(options: ToolResultTokenLimiterOptions | number) {
    const limit = typeof options === 'number' ? options : options.limit;
    if (!Number.isInteger(limit) || limit < MIN_LIMIT) {
      throw new Error(`ToolResultTokenLimiter: limit must be an integer of at least ${MIN_LIMIT}, received ${limit}`);
    }
    this.limit = limit;
  }

  processToolResult({ result, toolCallId, toolName, args, providerExecuted, messageList }: ProcessToolResultArgs) {
    if (providerExecuted) return;

    const text = toText(result);
    if (text === undefined) return;

    const tokens = estimateTokenCount(text);
    if (tokens <= this.limit) return;

    const truncated = truncate(text, tokens, this.limit);
    const updated = messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId,
        toolName,
        args,
        result: truncated,
      },
    });
    return updated ? messageList : undefined;
  }
}

function marker(kept: number, total: number): string {
  return `\n[truncated: showing ${kept.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} tokens]`;
}

// Token estimates aren't additive, so re-measure slice + marker and shrink until it fits.
// If even the marker alone doesn't fit, return it anyway so truncation is never silent.
function truncate(text: string, total: number, limit: number): string {
  let budget = limit - estimateTokenCount(marker(0, total));
  while (budget > 0) {
    const slice = sliceByTokensSafe(text, 0, budget);
    const candidate = `${slice}${marker(estimateTokenCount(slice), total)}`;
    if (estimateTokenCount(candidate) <= limit) return candidate;
    budget--;
  }
  return marker(0, total).trimStart();
}

function toText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v));
  } catch {
    return undefined;
  }
}

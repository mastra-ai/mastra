import { estimateTokenCount } from 'tokenx';
import { sliceByTokensSafe } from '../../utils/slice-by-tokens';
import type { ProcessToolResultArgs, Processor } from '../index';

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
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error(`ToolResultTokenLimiter: limit must be a positive integer, received ${limit}`);
    }
    this.limit = limit;
  }

  processToolResult({ result, toolCallId, toolName, args, providerExecuted, messageList }: ProcessToolResultArgs) {
    if (providerExecuted) return;

    const text = toText(result);
    if (text === undefined) return;

    const tokens = estimateTokenCount(text);
    if (tokens <= this.limit) return;

    const fullMarker = `\n[truncated: ~${tokens} tokens]`;
    const markerTokens = estimateTokenCount(fullMarker);
    const marker = markerTokens < this.limit ? fullMarker : '';
    const kept = this.limit - (marker ? markerTokens : 0);
    const updated = messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId,
        toolName,
        args,
        result: `${sliceByTokensSafe(text, 0, kept)}${marker}`,
      },
    });
    return updated ? messageList : undefined;
  }
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

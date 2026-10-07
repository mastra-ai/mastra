import { estimateTokenCount } from 'tokenx';
import { sliceByTokensSafe } from '../../utils/slice-by-tokens';
import type { ProcessToolModelOutputArgs, Processor, ToolModelOutput } from '../index';

/** Smallest accepted limit, so a useful slice fits beside the truncation marker. */
const MIN_LIMIT = 64;

export interface ToolResultTokenLimiterOptions {
  /** Maximum number of tokens a single tool result may use, including the truncation marker */
  limit: number;
}

/**
 * Output processor that caps the model-facing copy of each tool result at a token
 * limit. The stored and streamed result stays whole; only what the model reads on
 * later steps is truncated. Media and provider-executed results are left unchanged.
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

  processToolModelOutput({ result, modelOutput, providerExecuted }: ProcessToolModelOutputArgs) {
    if (providerExecuted) return;
    if (modelOutput) {
      const capped = this.capModelOutput(modelOutput);
      return capped === modelOutput ? undefined : { modelOutput: capped };
    }
    if (isMediaPayload(result)) return;
    const text = toText(result);
    if (text === undefined) return;
    const capped = this.cap(text);
    return capped === text ? undefined : { modelOutput: { type: 'text', value: capped } };
  }

  private capModelOutput(output: ToolModelOutput): ToolModelOutput {
    if (output.type === 'text' && typeof output.value === 'string') {
      const capped = this.cap(output.value);
      return capped === output.value ? output : { ...output, value: capped };
    }
    if (output.type === 'json') {
      const text = toText(output.value);
      if (text === undefined) return output;
      const capped = this.cap(text);
      return capped === text ? output : { type: 'text', value: capped };
    }
    if (output.type === 'content' && Array.isArray(output.value)) {
      let changed = false;
      const value = output.value.map(part => {
        if (part.type !== 'text' || typeof part.text !== 'string') return part;
        const capped = this.cap(part.text);
        if (capped === part.text) return part;
        changed = true;
        return { ...part, text: capped };
      });
      return changed ? ({ ...output, value } as ToolModelOutput) : output;
    }
    return output;
  }

  private cap(text: string): string {
    const tokens = estimateTokenCount(text);
    return tokens <= this.limit ? text : truncate(text, tokens, this.limit);
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

/** `{ data, mediaType | mimeType }` results (images, files) are sent to the model as media, not text. */
function isMediaPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.data === 'string' &&
    (typeof candidate.mediaType === 'string' || typeof candidate.mimeType === 'string')
  );
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

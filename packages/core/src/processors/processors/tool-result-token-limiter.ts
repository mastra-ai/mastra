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
      const value = this.capContent(output.value);
      return value === output.value ? output : ({ ...output, value } as ToolModelOutput);
    }
    return output;
  }

  private cap(text: string): string {
    const tokens = estimateTokenCount(text);
    return tokens <= this.limit ? text : truncate(text, tokens, this.limit);
  }

  // All text entries share one budget: keep them in order until it runs out, truncate the
  // entry where it does, drop the remaining text entries, and add a single marker.
  private capContent<T extends { type: string; text?: unknown }>(parts: T[]): T[] {
    const isText = (part: T) => part.type === 'text' && typeof part.text === 'string';
    const textTokens = parts.map(part => (isText(part) ? estimateTokenCount(part.text as string) : 0));
    const total = textTokens.reduce((sum, tokens) => sum + tokens, 0);
    if (total <= this.limit) return parts;

    let budget = this.limit - estimateTokenCount(marker(0, total));
    while (budget > 0) {
      let remaining = budget;
      let kept = 0;
      let lastKept = -1;
      const value: T[] = [];
      parts.forEach((part, i) => {
        if (!isText(part)) {
          value.push(part);
          return;
        }
        if (remaining <= 0) return;
        const text =
          textTokens[i]! <= remaining ? (part.text as string) : sliceByTokensSafe(part.text as string, 0, remaining);
        const tokens = estimateTokenCount(text);
        remaining -= textTokens[i]! <= remaining ? textTokens[i]! : remaining;
        kept += tokens;
        lastKept = value.length;
        value.push({ ...part, text });
      });
      const end = marker(kept, total);
      const used = kept + estimateTokenCount(end);
      if (used <= this.limit && lastKept >= 0) {
        value[lastKept] = { ...value[lastKept]!, text: `${value[lastKept]!.text as string}${end}` };
        return value;
      }
      budget -= Math.max(1, used - this.limit);
    }
    const first = parts.findIndex(isText);
    return parts
      .filter((part, i) => !isText(part) || i === first)
      .map(part => (isText(part) ? { ...part, text: marker(0, total).trimStart() } : part));
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
    const used = estimateTokenCount(candidate);
    if (used <= limit) return candidate;
    budget -= Math.max(1, used - limit);
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

import { z } from 'zod';
import { ProcessingFailure } from './failure.ts';

const token = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional();
const flatUsage = z
  .object({
    inputTokens: token,
    outputTokens: token,
    totalTokens: token,
    reasoningTokens: token,
    cachedInputTokens: token,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.inputTokens !== undefined && v.cachedInputTokens !== undefined && v.cachedInputTokens > v.inputTokens)
      ctx.addIssue({ code: 'custom', message: 'Cached input cannot exceed input tokens.' });
  });
const nestedUsage = z
  .object({
    inputTokens: z.object({ total: token, noCache: token, cacheRead: token, cacheWrite: token }).strict(),
    outputTokens: z.object({ total: token, text: token, reasoning: token }).strict(),
    raw: z.unknown().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const input = v.inputTokens,
      output = v.outputTokens;
    const invalid = () => ctx.addIssue({ code: 'custom', message: 'Token components must agree with totals.' });
    if (input.total !== undefined) {
      const components = [input.noCache, input.cacheRead, input.cacheWrite];
      if (
        components.some(n => n !== undefined && n > input.total!) ||
        components.reduce<number>((n, component) => n + (component ?? 0), 0) > input.total ||
        (components.every(n => n !== undefined) &&
          components.reduce<number>((n, component) => n + component!, 0) !== input.total)
      )
        invalid();
    }
    if (
      output.total !== undefined &&
      ((output.text !== undefined && output.text > output.total) ||
        (output.reasoning !== undefined && output.reasoning > output.total) ||
        (output.text !== undefined &&
          output.reasoning !== undefined &&
          output.text + output.reasoning !== output.total))
    )
      invalid();
  });
const finishReason = z.union([
  z.enum(['stop', 'tool-calls']),
  z.object({ unified: z.enum(['stop', 'tool-calls']), raw: z.string().nullable().optional() }).strict(),
]);
export type ObservedUsage = { inputTokens: number; outputTokens: number; reasoningTokens?: number };

// The router's public declarations are V2, but its selected Responses adapter returns V3.
// Validate both wire shapes, then expose only the V2 fields the native consumer expects.
export function normalizeModelFinish(value: unknown, limits: { maxInputTokens: number; maxOutputTokens: number }) {
  if (!value || typeof value !== 'object') throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
  const part = value as { finishReason?: unknown; usage?: unknown };
  const reason = finishReason.safeParse(part.finishReason);
  const raw = part.usage && typeof part.usage === 'object' ? (part.usage as Record<string, unknown>) : {};
  const validToken = (v: unknown): v is number => token.safeParse(v).success && typeof v === 'number';
  const nested = typeof raw.inputTokens === 'object' || typeof raw.outputTokens === 'object';
  let limitExceeded = false;
  // Individually valid counts remain bounded even when other fields are absent or malformed.
  const check = (v: unknown, maximum: number) => {
    if (validToken(v) && v > maximum) limitExceeded = true;
  };
  if (nested) {
    for (const [field, maximum] of [
      ['inputTokens', limits.maxInputTokens],
      ['outputTokens', limits.maxOutputTokens],
    ] as const) {
      const counts = raw[field];
      if (counts && typeof counts === 'object') {
        for (const key of field === 'inputTokens'
          ? ['total', 'noCache', 'cacheRead', 'cacheWrite']
          : ['total', 'text', 'reasoning'])
          check((counts as Record<string, unknown>)[key], maximum);
        const components = field === 'inputTokens' ? ['noCache', 'cacheRead', 'cacheWrite'] : ['text', 'reasoning'];
        const lowerBound = components.reduce((sum, key) => {
          const value = (counts as Record<string, unknown>)[key];
          return sum + (validToken(value) ? value : 0);
        }, 0);
        if (lowerBound > maximum) limitExceeded = true;
      }
    }
  } else {
    check(raw.inputTokens, limits.maxInputTokens);
    check(raw.outputTokens, limits.maxOutputTokens);
    check(raw.reasoningTokens, limits.maxOutputTokens);
    check(raw.cachedInputTokens, limits.maxInputTokens);
    check(raw.totalTokens, limits.maxInputTokens + limits.maxOutputTokens);
  }
  let observed: ObservedUsage | undefined;
  if (nested) {
    const usage = nestedUsage.safeParse(raw);
    if (usage.success && usage.data.inputTokens.total !== undefined && usage.data.outputTokens.total !== undefined)
      observed = {
        inputTokens: usage.data.inputTokens.total,
        outputTokens: usage.data.outputTokens.total,
        reasoningTokens: usage.data.outputTokens.reasoning,
      };
  } else {
    const usage = flatUsage.safeParse(raw);
    if (usage.success && usage.data.inputTokens !== undefined && usage.data.outputTokens !== undefined)
      observed = {
        inputTokens: usage.data.inputTokens,
        outputTokens: Math.max(
          usage.data.outputTokens,
          usage.data.reasoningTokens ?? 0,
          usage.data.totalTokens === undefined ? 0 : usage.data.totalTokens - usage.data.inputTokens,
        ),
        reasoningTokens: usage.data.reasoningTokens,
      };
  }
  if (observed) {
    check(observed.inputTokens, limits.maxInputTokens);
    check(observed.outputTokens, limits.maxOutputTokens);
  }
  // Invalid finish reasons still allow valid accounting to be settled before rejecting content.
  return {
    observed,
    limitExceeded,
    validFinish: reason.success,
    finishReason: reason.success ? (typeof reason.data === 'string' ? reason.data : reason.data.unified) : undefined,
  };
}

import { classifyProviderError, getRetryAfterMs, PROVIDER_FAILURE_KINDS } from '@mastra/core/error';
import type { ProviderFailureKind } from '@mastra/core/error';
import { z } from 'zod';

export const MODEL_FALLBACK_PART_TYPE = 'data-mastracode-model-fallback' as const;

export const MODEL_FALLBACK_STATE_KEY = 'mastracodePendingModelFallback' as const;

const modelFallbackReasonSchema = z.enum(['pool-exhausted', 'persistent-outage']);

export type ModelFallbackReason = z.infer<typeof modelFallbackReasonSchema>;

const REASON_CLAUSE: Record<ModelFallbackReason, (model: string) => string> = {
  'pool-exhausted': model => `${model} failed`,
  'persistent-outage': model => `${model} keeps failing`,
};

const modelRouteFailureSchema = z.object({
  kind: z.enum(PROVIDER_FAILURE_KINDS),
  retryAt: z.string().optional(),
});

export type ModelRouteFailure = z.infer<typeof modelRouteFailureSchema>;

export function modelRouteFailureFromError(
  error: unknown,
  now: number,
  kind: ProviderFailureKind = classifyProviderError(error),
): ModelRouteFailure {
  const retryAfterMs = getRetryAfterMs(error, now);
  const retryAt = retryAfterMs === undefined ? undefined : new Date(now + retryAfterMs);
  return {
    kind,
    ...(retryAt && !Number.isNaN(retryAt.getTime()) ? { retryAt: retryAt.toISOString() } : {}),
  };
}

export const pendingModelFallbackSchema = z.object({
  fromEntryId: z.string().min(1),
  toEntryId: z.string().min(1),
  toModelId: z.string().min(1),
  threadId: z.string().optional(),
  reason: modelFallbackReasonSchema,
  at: z.string(),
  failure: modelRouteFailureSchema.optional().catch(undefined),
});

export type PendingModelFallback = z.infer<typeof pendingModelFallbackSchema>;

export function parsePendingModelFallback(value: unknown): PendingModelFallback | null {
  return pendingModelFallbackSchema.safeParse(value).data ?? null;
}

export function pendingModelFallbackForThread(value: unknown, threadId: unknown): PendingModelFallback | null {
  const pending = parsePendingModelFallback(value);
  return pending && (pending.threadId === undefined || pending.threadId === threadId) ? pending : null;
}

const routeEndpointSchema = z.object({ entryId: z.string(), label: z.string() });

const modelFallbackPartSchema = z.object({
  from: routeEndpointSchema,
  to: routeEndpointSchema,
  reason: modelFallbackReasonSchema,
  at: z.string().catch(''),
  failure: modelRouteFailureSchema.optional().catch(undefined),
});

export type ModelFallbackPartData = z.infer<typeof modelFallbackPartSchema>;

const FAILURE_CLAUSE: Partial<Record<ProviderFailureKind, (model: string) => string>> = {
  rate_limited: model => `${model} is rate-limited`,
  quota: model => `${model} is out of credits or quota`,
  auth: model => `${model} has missing or invalid credentials`,
  unavailable: model => `${model} is unavailable`,
  timeout: model => `${model} timed out`,
};

export function modelFallbackNoticeText(
  data: ModelFallbackPartData,
  modelName: (label: string) => string = label => label,
): string {
  const clause = (data.failure && FAILURE_CLAUSE[data.failure.kind]) ?? REASON_CLAUSE[data.reason];
  return `${clause(modelName(data.from.label))}, switched to ${modelName(data.to.label)}`;
}

export function fallbackModelIdsToTry(
  primaryModelId: string,
  fallbackModelIds: readonly string[],
  canUse: (modelId: string) => boolean,
  limit = Number.POSITIVE_INFINITY,
): string[] {
  const usable: string[] = [];
  for (const modelId of new Set(fallbackModelIds)) {
    if (usable.length >= limit) break;
    if (modelId !== primaryModelId && canUse(modelId)) usable.push(modelId);
  }
  return usable;
}

export function parseModelFallbackPart(data: unknown): ModelFallbackPartData | null {
  return modelFallbackPartSchema.safeParse(data).data ?? null;
}

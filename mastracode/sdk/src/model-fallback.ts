import { classifyProviderError, getRetryAfterMs, PROVIDER_FAILURE_KINDS } from '@mastra/core/error';
import type { ProviderFailureKind } from '@mastra/core/error';
import { z } from 'zod';

export const MODEL_FALLBACK_PART_TYPE = 'data-mastracode-model-fallback' as const;

export const MODEL_FALLBACK_STATE_KEY = 'mastracodePendingModelFallback' as const;

const modelFallbackReasonSchema = z.enum(['pool-exhausted', 'persistent-outage']);

export type ModelFallbackReason = z.infer<typeof modelFallbackReasonSchema>;

type FallbackClause = (model: string, wait: string) => string;

const REASON_CLAUSE: Record<ModelFallbackReason, FallbackClause> = {
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

const FAILURE_CLAUSE: Partial<Record<ProviderFailureKind, FallbackClause>> = {
  rate_limited: (model, wait) => `${model} is rate-limited${wait}`,
  quota: (model, wait) => `${model} is out of credits or quota${wait}`,
  auth: model => `${model} has missing or invalid credentials`,
  unavailable: (model, wait) => `${model} is unavailable${wait}`,
  timeout: model => `${model} timed out`,
};

function providerWait({ at, failure }: ModelFallbackPartData): string {
  const minutes = Math.ceil((Date.parse(failure?.retryAt ?? '') - Date.parse(at)) / 60_000);
  if (!(minutes > 0)) return '';
  if (minutes < 60) return ` for ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return ` for ${hours} h`;
  const days = Math.round(hours / 24);
  return ` for ${days} ${days === 1 ? 'day' : 'days'}`;
}

export function modelFallbackNoticeText(
  data: ModelFallbackPartData,
  modelName: (label: string) => string = label => label,
): string {
  const clause = (data.failure && FAILURE_CLAUSE[data.failure.kind]) ?? REASON_CLAUSE[data.reason];
  return `${clause(modelName(data.from.label), providerWait(data))}, switched to ${modelName(data.to.label)}`;
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

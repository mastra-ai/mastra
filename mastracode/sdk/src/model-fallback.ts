import { PROVIDER_FAILURE_KINDS } from '@mastra/core/error';
import type { ProviderFailureKind } from '@mastra/core/error';
import { z } from 'zod';
import type { ThinkingLevelSetting } from './thinking.js';

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
});

export type ModelRouteFailure = z.infer<typeof modelRouteFailureSchema>;

export const pendingModelFallbackSchema = z.object({
  fromEntryId: z.string().min(1),
  toEntryId: z.string().min(1),
  toModelId: z.string().min(1),
  threadId: z.string().optional(),
  reason: modelFallbackReasonSchema,
  at: z.string(),
});

export type PendingModelFallback = z.infer<typeof pendingModelFallbackSchema>;

export function parsePendingModelFallback(value: unknown): PendingModelFallback | null {
  return pendingModelFallbackSchema.safeParse(value).data ?? null;
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
  model_rejected: model => `${model} was not found by its provider`,
};

export function modelFallbackNoticeText(
  data: ModelFallbackPartData,
  modelName: (label: string) => string = label => label,
): string {
  const clause = (data.failure && FAILURE_CLAUSE[data.failure.kind]) ?? REASON_CLAUSE[data.reason];
  return `${clause(modelName(data.from.label))}, switched to ${modelName(data.to.label)}`;
}

export interface ModelFallback {
  modelId: string;
  thinkingLevel?: ThinkingLevelSetting;
}

export function parseModelFallbackPart(data: unknown): ModelFallbackPartData | null {
  return modelFallbackPartSchema.safeParse(data).data ?? null;
}

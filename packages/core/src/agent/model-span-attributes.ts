/**
 * The `model` / `provider` span attributes of one model object. Both come from
 * that object, so they are set together, or not at all when either is missing.
 */
export function modelSpanAttributes(
  model: { modelId?: unknown; provider?: unknown } | undefined,
): { model: string; provider: string } | undefined {
  if (typeof model?.modelId !== 'string' || typeof model.provider !== 'string') return undefined;
  return { model: model.modelId, provider: model.provider };
}

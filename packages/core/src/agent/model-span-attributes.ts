/**
 * The `model` / `provider` span attributes of one model object. Both come from
 * that object, so they are set together, or not at all when either is missing
 * or empty.
 */
export function modelSpanAttributes(
  model: { modelId?: unknown; provider?: unknown } | undefined,
): { model: string; provider: string } | undefined {
  const { modelId, provider } = model ?? {};
  if (typeof modelId !== 'string' || !modelId || typeof provider !== 'string' || !provider) return undefined;
  return { model: modelId, provider };
}

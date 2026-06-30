/**
 * Single source of truth for the per-call HTTP header merge that both the
 * non-durable `loop/workflows/agentic-execution/llm-execution-step.ts` and the
 * durable `agent/durable/workflows/steps/llm-execution.ts` send to the model.
 *
 * Merge order (later wins):
 *   1. `memoryHeaders` – `x-thread-id` / `x-resource-id`, used by memory-aware
 *      gateways (e.g. Memory Gateway) for server-side enrichment.
 *   2. `modelConfigHeaders` – headers configured on the agent's model config.
 *   3. `callTimeHeaders` – headers passed via `modelSettings.headers` on the
 *      individual stream/generate call.
 *
 * Returns `undefined` when every input is empty, so callers can drop the
 * property from the outgoing request entirely instead of sending `{}`.
 */

export interface MergeLlmCallHeadersInput {
  /** Memory-routing headers (`x-thread-id`, `x-resource-id`). */
  memoryHeaders?: Record<string, string> | undefined;
  /** Headers configured on the agent's model config (e.g. provider-level auth). */
  modelConfigHeaders?: Record<string, string> | undefined;
  /** Headers supplied on `modelSettings.headers` at call time (highest priority). */
  callTimeHeaders?: Record<string, string> | undefined;
}

export function buildMemoryHeaders({
  threadId,
  resourceId,
}: {
  threadId?: string | undefined;
  resourceId?: string | undefined;
}): Record<string, string> {
  const headers: Record<string, string> = {};
  if (threadId) headers['x-thread-id'] = threadId;
  if (resourceId) headers['x-resource-id'] = resourceId;
  return headers;
}

export function mergeLlmCallHeaders({
  memoryHeaders,
  modelConfigHeaders,
  callTimeHeaders,
}: MergeLlmCallHeadersInput): Record<string, string> | undefined {
  const merged: Record<string, string> = {
    ...(memoryHeaders ?? {}),
    ...(modelConfigHeaders ?? {}),
    ...(callTimeHeaders ?? {}),
  };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

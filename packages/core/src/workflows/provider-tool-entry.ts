import type { SerializedStepOptions, ProviderToolStepEntry, ProviderToolStepSpec } from './types';

export function isProviderToolStepSpec(value: unknown): value is ProviderToolStepSpec {
  return Boolean(value && typeof value === 'object' && (value as { type?: unknown }).type === 'provider');
}

export function pickProviderToolStepOptions(
  options: Record<string, any> | undefined,
  stepId: string,
): SerializedStepOptions | undefined {
  if (!options) return undefined;

  for (const key of ['onFinish', 'onChunk', 'onError', 'onStepFinish', 'onAbort', 'toolChoice']) {
    if (options[key] !== undefined) {
      throw new Error(`Provider tool step "${stepId}" cannot be stored: option "${key}" does not round-trip.`);
    }
  }
  if (options.scorers !== undefined) {
    throw new Error(`Provider tool step "${stepId}" cannot be stored: option "scorers" is not supported.`);
  }

  const out: SerializedStepOptions = {};
  if (options.retries !== undefined) out.retries = options.retries;
  if (options.metadata !== undefined) out.metadata = options.metadata;
  return Object.keys(out).length > 0 ? out : undefined;
}

export function buildProviderToolEntry(
  spec: ProviderToolStepSpec,
  options?: Record<string, any>,
  stepId?: string,
): ProviderToolStepEntry {
  const id = stepId || `${spec.providerId}:${spec.toolSlug}`;
  const entry: ProviderToolStepEntry = {
    type: 'provider-tool',
    id,
    providerId: spec.providerId,
    toolSlug: spec.toolSlug,
  };
  if (spec.connection !== undefined) entry.connection = spec.connection;
  if (spec.inputSchema !== undefined) entry.inputSchema = spec.inputSchema;
  if (spec.outputSchema !== undefined) entry.outputSchema = spec.outputSchema;
  if (spec.description !== undefined) entry.description = spec.description;
  if (options !== undefined) entry.options = options;
  return entry;
}

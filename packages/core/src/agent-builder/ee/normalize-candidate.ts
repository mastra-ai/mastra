import { getRegisteredProviders, parseModelString } from '../../llm/model/provider-registry.js';
import type { MastraModelConfig } from '../../llm/model/shared.types.js';
import type { StorageConditionalField, StorageModelConfig } from '../../storage/types.js';

export type ModelCandidateOrigin =
  | 'static'
  | 'conditional-variant'
  | 'conditional-default'
  | 'runtime'
  | 'list'
  | 'sdk-instance'
  | 'openai-compatible';

/**
 * A single normalized provider/model candidate extracted from one of the many
 * shapes a model can be expressed in across the codebase.
 *
 * `origin` records which dispatch branch produced the candidate, mainly for
 * error messages on conditional variants.
 *
 * `label` is a short human-friendly description (variant index / SDK provider id
 * / etc.) used by `enforceModelAllowlist` when reporting the offending entry.
 */
export interface ModelCandidate {
  provider: string;
  modelId: string;
  origin: ModelCandidateOrigin;
  label?: string;
}

/**
 * Anything we accept as input to {@link toModelCandidates}. Kept open so call
 * sites can pass arbitrary stored or runtime model values without manual coercion.
 */
export type ModelCandidateInput =
  | string
  | MastraModelConfig
  | StorageModelConfig
  | StorageConditionalField<StorageModelConfig>
  | { provider?: unknown; modelId?: unknown; name?: unknown; id?: unknown; providerId?: unknown }
  | ((...args: unknown[]) => unknown)
  | null
  | undefined;

/**
 * Gateway-aware split of a runtime model string. `parseModelString` only splits
 * on the first slash, which fails for gateway provider IDs that themselves
 * contain a slash (e.g. `acme/custom/foo-1`). We try the longest registered
 * provider prefix first and fall back to the first-slash split when no match
 * is found in the registry.
 */
function splitRuntimeModelString(input: string): { provider: string; modelId: string } | undefined {
  const providers = getRegisteredProviders().sort((a, b) => b.length - a.length);
  for (const providerId of providers) {
    const prefix = `${providerId}/`;
    if (input.startsWith(prefix)) {
      const modelId = input.slice(prefix.length);
      if (modelId.length > 0) return { provider: providerId, modelId };
    }
  }
  const parsed = parseModelString(input);
  if (parsed.provider && parsed.modelId) {
    return { provider: parsed.provider, modelId: parsed.modelId };
  }
  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fromObject(value: Record<string, unknown>, origin: ModelCandidateOrigin, label?: string): ModelCandidate[] {
  // SDK instance: AI SDK language models expose `provider` + `modelId`.
  const providerField = value.provider;
  const modelIdField = value.modelId;
  const nameField = value.name;
  const idField = value.id;
  const providerIdField = value.providerId;

  // OpenAICompatibleConfig `{ id: 'provider/model' }` — must be checked before
  // `{ provider, modelId }` so AI SDK instances (which also have `provider`)
  // don't get pre-empted by a stale `id` lookup.
  if (typeof idField === 'string' && idField.includes('/') && providerField === undefined) {
    const split = splitRuntimeModelString(idField);
    if (split) {
      return [{ ...split, origin: 'openai-compatible', label: label ?? idField }];
    }
  }

  // OpenAICompatibleConfig `{ providerId, modelId }`
  if (typeof providerIdField === 'string' && typeof modelIdField === 'string') {
    return [
      {
        provider: providerIdField,
        modelId: modelIdField,
        origin: 'openai-compatible',
        label: label ?? `${providerIdField}/${modelIdField}`,
      },
    ];
  }

  // AI SDK language model instance: `{ provider, modelId, ... doGenerate }`
  if (typeof providerField === 'string' && typeof modelIdField === 'string') {
    const isSdkInstance = typeof (value as { doGenerate?: unknown }).doGenerate === 'function';
    return [
      {
        provider: providerField,
        modelId: modelIdField,
        origin: isSdkInstance ? 'sdk-instance' : origin,
        label: label ?? `${providerField}/${modelIdField}`,
      },
    ];
  }

  // Stored static `{ provider, name }`
  if (typeof providerField === 'string' && typeof nameField === 'string') {
    return [
      {
        provider: providerField,
        modelId: nameField,
        origin,
        label: label ?? `${providerField}/${nameField}`,
      },
    ];
  }

  return [];
}

/**
 * Convert any supported model expression into a flat list of `{ provider, modelId }`
 * candidates. Empty array means "could not statically determine" — callers
 * should treat that as unenforced at this level (runtime defense in Phase 7
 * picks it up).
 *
 * Dispatch order:
 * 1. `null` / `undefined` / `function` → `[]` (dynamic, defer to runtime)
 * 2. `string` → gateway-aware split
 * 3. Conditional variants array → walk each variant
 * 4. Object → openai-compatible / SDK instance / stored static, see {@link fromObject}
 */
export function toModelCandidates(input: ModelCandidateInput): ModelCandidate[] {
  if (input === null || input === undefined) return [];

  if (typeof input === 'function') return [];

  if (typeof input === 'string') {
    const split = splitRuntimeModelString(input);
    if (!split) return [];
    return [{ ...split, origin: 'runtime', label: input }];
  }

  if (Array.isArray(input)) {
    const candidates: ModelCandidate[] = [];
    input.forEach((variant, index) => {
      if (!isPlainObject(variant)) return;
      const value = (variant as { value?: unknown }).value ?? variant;
      const hasRules = isPlainObject(variant) && 'rules' in variant && (variant as { rules?: unknown }).rules != null;
      const origin: ModelCandidateOrigin = hasRules ? 'conditional-variant' : 'conditional-default';
      const label = hasRules ? `variant[${index}]` : `variant[${index}] (default)`;
      if (typeof value === 'string') {
        const split = splitRuntimeModelString(value);
        if (split) {
          candidates.push({ ...split, origin, label });
        }
        return;
      }
      if (isPlainObject(value)) {
        candidates.push(...fromObject(value, origin, label));
      }
    });
    return candidates;
  }

  if (isPlainObject(input)) {
    return fromObject(input, 'static');
  }

  return [];
}

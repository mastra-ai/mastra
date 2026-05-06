import { createHash } from 'node:crypto';
import type { MastraCache } from '../cache';
import type { FullOutput } from '../stream/base/output';
import type { ChunkType } from '../stream/types';
import type { AgentInstructions } from './types';

/**
 * Configuration for the agent response cache.
 *
 * Set on an agent's constructor as a default for every call, or per-call on
 * `agent.stream()` / `agent.generate()`. Per-call options override agent-level
 * defaults.
 *
 * Cache hits replay both `generate()` and `stream()` results without making
 * an LLM call. The cache key is derived from the request shape (model, model
 * settings, provider options, system prompt, instructions, tools, structured
 * output schema, and the input messages) so config changes automatically
 * invalidate stale entries — see {@link buildAgentResponseCacheKey}.
 *
 * @see https://openrouter.ai/announcements/response-caching for the design
 *   inspiration. Mastra's implementation is local to the Agent rather than the
 *   provider, so it works with any model.
 */
export interface AgentResponseCacheOptions {
  /**
   * Override the auto-derived cache key. When set, none of the request shape
   * is hashed into the key — it's used verbatim. Useful when you want to share
   * a cached response across requests that differ in irrelevant ways (e.g.
   * formatting), or to manually invalidate a cached entry by changing the
   * key.
   */
  key?: string;

  /**
   * Time-to-live in seconds. Defaults to 300 (5 minutes), matching
   * OpenRouter's response cache default. Set to `0` to fall through to the
   * underlying cache implementation's default TTL.
   */
  ttl?: number;

  /**
   * Optional scope appended to the auto-derived cache key for multi-tenant
   * isolation. When omitted, the key falls back to `memory.resource` (when
   * memory is configured) so per-user data is isolated automatically.
   *
   * Set to `null` to opt out of all scoping (cache shared across all callers
   * of this agent).
   */
  scope?: string | null;

  /**
   * Custom cache implementation. Defaults to the Mastra instance's
   * `MastraServerCache` (adapted to the {@link MastraCache} interface).
   *
   * If no Mastra-level cache is configured and no custom cache is provided,
   * `responseCache` is silently disabled (logged via the agent's logger).
   */
  cache?: MastraCache;

  /**
   * Force a cache miss for this request. The cached value (if any) is
   * ignored, the underlying LLM call runs, and the new result overwrites the
   * cached entry. Mirrors OpenRouter's `X-OpenRouter-Cache-Clear` header.
   */
  bust?: boolean;
}

/**
 * Resolved (per-call) response cache config — never `boolean | undefined`.
 *
 * @internal
 */
export type ResolvedResponseCacheConfig = {
  enabled: boolean;
  cache?: MastraCache;
  key?: string;
  ttl?: number;
  scope?: string | null;
  bust: boolean;
};

/**
 * The shape stored in the cache for each agent response.
 *
 * `chunks` is populated for `methodType: 'stream'` so cache hits can replay
 * the original `fullStream` chunk-for-chunk. `fullOutput` is the result of
 * `MastraModelOutput.getFullOutput()` and is returned directly on cache hits
 * for `agent.generate()`.
 *
 * @internal
 */
export interface CachedAgentResponse<OUTPUT = unknown> {
  chunks: ChunkType<OUTPUT>[];
  fullOutput: FullOutput<OUTPUT>;
  cachedAt: number;
}

/**
 * Per-call options accepted on `agent.stream()` / `agent.generate()`. `true`
 * means "use the agent default; if there's none, use defaults across the
 * board". An object lets the caller override any field.
 */
export type AgentResponseCacheOption = boolean | AgentResponseCacheOptions;

/**
 * Resolve the per-call response cache config by merging the per-call option
 * (if any) on top of the agent-level default (if any).
 *
 * @internal
 */
export function resolveResponseCacheConfig(
  agentDefault: AgentResponseCacheOption | undefined,
  perCall: AgentResponseCacheOption | undefined,
): ResolvedResponseCacheConfig {
  // Per-call `false` always wins (explicit opt-out).
  if (perCall === false) {
    return { enabled: false, bust: false };
  }

  const agentEnabled = agentDefault === true || (typeof agentDefault === 'object' && agentDefault !== null);
  const perCallEnabled = perCall === true || (typeof perCall === 'object' && perCall !== null);
  const enabled = perCallEnabled || (perCall === undefined && agentEnabled);

  if (!enabled) {
    return { enabled: false, bust: false };
  }

  const agentObj: AgentResponseCacheOptions =
    typeof agentDefault === 'object' && agentDefault !== null ? agentDefault : {};
  const perCallObj: AgentResponseCacheOptions = typeof perCall === 'object' && perCall !== null ? perCall : {};

  return {
    enabled: true,
    cache: perCallObj.cache ?? agentObj.cache,
    key: perCallObj.key ?? agentObj.key,
    ttl: perCallObj.ttl ?? agentObj.ttl,
    scope: perCallObj.scope !== undefined ? perCallObj.scope : agentObj.scope,
    bust: perCallObj.bust ?? false,
  };
}

/**
 * Inputs that contribute to the auto-derived cache key.
 *
 * @internal
 */
export interface AgentResponseCacheKeyInputs {
  agentId: string;
  methodType: 'stream' | 'generate';
  scope?: string | null;
  model: { provider?: string; modelId?: string; specVersion?: string };
  instructions: AgentInstructions | undefined;
  system?: unknown;
  messages: unknown;
  modelSettings?: unknown;
  providerOptions?: unknown;
  toolChoice?: unknown;
  tools?: unknown;
  structuredOutputSchema?: unknown;
  context?: unknown;
}

/**
 * Build a deterministic cache key from the request shape.
 *
 * The key incorporates everything that can change the LLM's response so
 * config changes automatically invalidate stale entries (matches OpenRouter's
 * "model + request body + streaming mode" cache key strategy, but extended
 * with Mastra-specific fields like instructions, tools, structured output
 * schema, and an explicit per-tenant scope).
 *
 * @internal
 */
export function buildAgentResponseCacheKey(inputs: AgentResponseCacheKeyInputs): string {
  const scope = inputs.scope ?? '';
  const modelTag = `${inputs.model.provider ?? 'unknown'}:${inputs.model.modelId ?? 'unknown'}:${inputs.model.specVersion ?? 'unknown'}`;

  const payload = {
    agent: inputs.agentId,
    method: inputs.methodType,
    scope,
    model: modelTag,
    instructions: normalizeForHash(inputs.instructions),
    system: normalizeForHash(inputs.system),
    messages: normalizeForHash(inputs.messages),
    modelSettings: normalizeForHash(inputs.modelSettings),
    providerOptions: normalizeForHash(inputs.providerOptions),
    toolChoice: normalizeForHash(inputs.toolChoice),
    tools: normalizeForHash(inputs.tools),
    structuredOutputSchema: normalizeForHash(inputs.structuredOutputSchema),
    context: normalizeForHash(inputs.context),
  };

  const serialized = stableStringify(payload);
  const hash = createHash('sha256').update(serialized).digest('hex').slice(0, 32);
  const scopeTag = scope ? `:${createHash('sha256').update(scope).digest('hex').slice(0, 8)}` : '';
  return `mastra:agent-response:${inputs.agentId}:${inputs.methodType}${scopeTag}:${hash}`;
}

/**
 * Normalize a value for hashing: strip undefined, drop function references,
 * preserve plain object/array shape. We intentionally don't try to be smart
 * here — `JSON.stringify` with sorted keys is enough to produce a stable key.
 *
 * @internal
 */
function normalizeForHash(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'function') return '[function]';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>)) {
      const v = (value as Record<string, unknown>)[k];
      if (v === undefined) continue;
      out[k] = normalizeForHash(v);
    }
    return out;
  }
  return String(value);
}

/**
 * `JSON.stringify` with deterministic key ordering at every level. Required
 * because object key order is preserved by `JSON.stringify`, and we don't
 * want `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` to hash to different keys.
 *
 * @internal
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}

/**
 * Extract a serializable summary of a tools input record for use in cache
 * keys. Only includes the fields that influence the LLM's response: tool id,
 * description, and input schema. Function references and runtime state are
 * dropped.
 *
 * @internal
 */
export function summarizeToolsForCacheKey(tools: Record<string, unknown> | undefined | null): unknown {
  if (!tools || typeof tools !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const id of Object.keys(tools).sort()) {
    const tool = tools[id] as Record<string, unknown> | null | undefined;
    if (!tool || typeof tool !== 'object') continue;
    out[id] = {
      description: tool.description ?? null,
      inputSchema: tool.inputSchema ?? tool.parameters ?? null,
      outputSchema: tool.outputSchema ?? null,
    };
  }
  return out;
}

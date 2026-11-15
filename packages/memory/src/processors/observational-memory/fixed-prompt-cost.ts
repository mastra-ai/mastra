import { createHash } from 'node:crypto';
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema } from '@mastra/core/schema';

/** Where the provider-added prompt cost of a request came from. */
export type ProviderAddedSource = 'reported' | 'first-step' | 'estimate';

export type ProviderAddedCost = { tokens: number; source: Exclude<ProviderAddedSource, 'estimate'> };

/** Bump when what goes into the key changes, so old measurements are never reused. */
const KEY_FORMAT_VERSION = 1;
const MAX_ENTRIES = 64;

/** The tool definitions a request sends, as the provider receives them. */
export function toolDefinitions(tools: Record<string, unknown> | undefined, activeTools: string[] | undefined) {
  return Object.entries(tools ?? {})
    .filter(([name]) => !activeTools || activeTools.includes(name))
    .map(([name, tool]) => {
      const { description, inputSchema, parameters } = (tool ?? {}) as Record<string, unknown>;
      const schema = inputSchema ?? parameters;
      const jsonSchema = isStandardSchemaWithJSON(schema)
        ? standardSchemaToJSONSchema(schema, { io: 'input' })
        : ((schema as { jsonSchema?: unknown } | undefined)?.jsonSchema ?? schema);
      return { name, description, parameters: jsonSchema };
    });
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * Identifies the part of a request whose cost the provider adds on top of the messages: the model (whose
 * provider id names the API), the tool definitions, the tool choice and the provider options. The system
 * block is left out on purpose: observations rewrite it, and it is counted locally on every step.
 */
export function providerAddedKey(request: {
  model: string;
  tools: Record<string, unknown> | undefined;
  activeTools: string[] | undefined;
  toolChoice: unknown;
  providerOptions: unknown;
}): string {
  let tools: unknown;
  try {
    tools = toolDefinitions(request.tools, request.activeTools);
  } catch {
    // An unserializable schema still keys by tool name, so the tool set is never confused with another.
    tools = Object.keys(request.tools ?? {}).filter(name => !request.activeTools || request.activeTools.includes(name));
  }
  return createHash('sha256')
    .update(
      canonicalJson({
        version: KEY_FORMAT_VERSION,
        model: request.model,
        tools,
        toolChoice: request.toolChoice,
        providerOptions: request.providerOptions,
      }),
    )
    .digest('hex');
}

/**
 * The tokens a response reports for request fields that are not messages (instructions, tools), when the
 * provider's own usage carries that split (OpenAI Responses `attribution.request_fields`). Mastra keeps the
 * normalized usage's source under `raw`, and the provider SDK keeps the provider's usage under its `raw`.
 */
export function readReportedProviderAdded(usage: unknown): number | undefined {
  const fields = (usage as { raw?: { raw?: { attribution?: { request_fields?: unknown } } } } | undefined)?.raw?.raw
    ?.attribution?.request_fields;
  if (!fields || typeof fields !== 'object') return undefined;
  const counts = Object.values(fields as Record<string, unknown>).map(
    field => (field as { input_tokens?: unknown } | undefined)?.input_tokens,
  );
  if (counts.length === 0) return undefined;
  let total = 0;
  for (const count of counts) {
    if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return undefined;
    total += count;
  }
  return total;
}

/** Measured provider-added costs by request configuration, least recently used dropped first. */
export class ProviderAddedCosts {
  #entries = new Map<string, ProviderAddedCost>();

  get(key: string): ProviderAddedCost | undefined {
    const entry = this.#entries.get(key);
    if (entry) {
      this.#entries.delete(key);
      this.#entries.set(key, entry);
    }
    return entry;
  }

  /** A reported value always wins; a first-step value is taken only once per configuration. */
  record(key: string, cost: ProviderAddedCost): void {
    if (cost.source === 'first-step' && this.#entries.has(key)) return;
    this.#entries.delete(key);
    this.#entries.set(key, cost);
    if (this.#entries.size > MAX_ENTRIES) {
      const oldest = this.#entries.keys().next().value;
      if (oldest !== undefined) this.#entries.delete(oldest);
    }
  }
}

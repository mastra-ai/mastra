/**
 * The direct Perplexity provider now serves the Agent API. models.dev still
 * publishes the retired Sonar catalog under `perplexity` and the Agent catalog
 * under `perplexity-agent`; expose the latter through both native provider IDs.
 */

export const PERPLEXITY_AGENT_PRESETS = ['fast', 'low', 'medium', 'high', 'xhigh'] as const;

const RETIRED_SONAR_MODELS = new Set([
  'sonar',
  'sonar-pro',
  'sonar-reasoning',
  'sonar-reasoning-pro',
  'sonar-deep-research',
]);
const AGENT_REASONING_EFFORTS = new Set(['minimal', 'low', 'medium', 'high', 'xhigh']);

interface PerplexityCatalogModel {
  id?: string;
  reasoning_options?: unknown;
  [key: string]: unknown;
}

interface PerplexityCatalogProvider {
  id?: string;
  name?: string;
  env?: string[];
  api?: string;
  npm?: string;
  doc?: string;
  models: Record<string, PerplexityCatalogModel>;
}

function normalizeReasoningOptions(options: unknown): unknown {
  if (!Array.isArray(options)) return [];
  return options.flatMap(option => {
    if (!option || typeof option !== 'object' || option.type !== 'effort' || !Array.isArray(option.values)) {
      return [];
    }
    const values = option.values.filter(
      (value: unknown) => typeof value === 'string' && AGENT_REASONING_EFFORTS.has(value),
    );
    return values.length > 0 ? [{ ...option, values }] : [];
  });
}

export function normalizePerplexityCatalog<Provider extends PerplexityCatalogProvider>(
  providers: Record<string, Provider>,
): Record<string, Provider> {
  const canonical = providers.perplexity;
  const agent = providers['perplexity-agent'];
  const source = canonical ?? agent;
  if (!source) return providers;

  const models: Record<string, PerplexityCatalogModel> = {};
  for (const [id, model] of Object.entries({ ...agent?.models, ...canonical?.models })) {
    if (RETIRED_SONAR_MODELS.has(id)) continue;
    models[id] =
      model.reasoning_options === undefined
        ? model
        : { ...model, reasoning_options: normalizeReasoningOptions(model.reasoning_options) };
  }
  for (const id of [...PERPLEXITY_AGENT_PRESETS, 'perplexity/sonar']) {
    // Presets select provider-managed models and tools. Do not invent model
    // capabilities (reasoning, attachments, sampling or pricing) for them.
    models[id] ??= { id };
  }

  const common = {
    ...source,
    env: canonical?.env ?? agent?.env ?? ['PERPLEXITY_API_KEY'],
    api: 'https://api.perplexity.ai',
    npm: '@ai-sdk/perplexity',
    doc: agent?.doc ?? 'https://docs.perplexity.ai/docs/agent-api/quickstart',
    models,
  };

  return {
    ...providers,
    perplexity: { ...common, id: 'perplexity', name: canonical?.name ?? 'Perplexity' },
    'perplexity-agent': { ...common, id: 'perplexity-agent', name: agent?.name ?? 'Perplexity Agent' },
  };
}

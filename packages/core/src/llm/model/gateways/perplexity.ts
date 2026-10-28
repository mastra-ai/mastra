import { createPerplexity } from '@ai-sdk/perplexity-v7';
import type { PerplexityProviderSettings } from '@ai-sdk/perplexity-v7';
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Prompt,
  LanguageModelV4ToolResultPart,
} from '@ai-sdk/provider-v7';
import { z } from 'zod/v4';
import { MastraError } from '../../../error/index.js';
import { MASTRA_USER_AGENT } from './constants.js';

const AGENT_PRESETS = new Set(['fast', 'low', 'medium', 'high', 'xhigh']);
const RETIRED_SONAR_MODELS = new Map([
  ['sonar', 'fast'],
  ['sonar-pro', 'low'],
  ['sonar-reasoning', 'medium'],
  ['sonar-reasoning-pro', 'medium'],
  ['sonar-deep-research', 'high'],
]);
const SEARCH_FILTERS = [
  'search_domain_filter',
  'search_recency_filter',
  'search_after_date_filter',
  'search_before_date_filter',
  'last_updated_after_filter',
  'last_updated_before_filter',
] as const;
const legacyOptionsSchema = z.looseObject({
  reasoning: z.record(z.string(), z.unknown()).optional(),
  tools: z.array(z.unknown()).optional(),
  reasoning_effort: z.enum(['minimal', 'low', 'medium', 'high', 'xhigh']).optional(),
  search_domain_filter: z.array(z.string()).optional(),
  search_recency_filter: z.enum(['hour', 'day', 'week', 'month', 'year']).optional(),
  search_after_date_filter: z.string().optional(),
  search_before_date_filter: z.string().optional(),
  last_updated_after_filter: z.string().optional(),
  last_updated_before_filter: z.string().optional(),
  num_search_results: z.number().int().positive().optional(),
  web_search_options: z
    .strictObject({
      search_context_size: z.enum(['low', 'medium', 'high']).optional(),
      user_location: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  disable_search: z.boolean().optional(),
});
const UNSUPPORTED_SONAR_OPTIONS = [
  'return_images',
  'return_videos',
  'return_related_questions',
  'search_language_filter',
  'stream_mode',
  'search_mode',
] as const;

function migrationError(text: string) {
  return new MastraError({
    id: 'PERPLEXITY_AGENT_MIGRATION_REQUIRED',
    domain: 'MODEL_ROUTER',
    category: 'USER',
    text,
  });
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function validateFileInputs(options: LanguageModelV4CallOptions) {
  const validatePart = (part: { type: string; mediaType?: string }) => {
    if (part.type === 'file' && part.mediaType !== 'image' && !part.mediaType?.startsWith('image/')) {
      throw migrationError(
        `Perplexity Agent API does not support ${part.mediaType ?? 'non-image'} file inputs. Send extracted text or choose a provider that supports this file type.`,
      );
    }
  };
  for (const message of options.prompt) {
    if (message.role === 'system') continue;
    for (const part of message.content) {
      validatePart(part);
      if (part.type === 'tool-result' && part.output.type === 'content') {
        for (const outputPart of part.output.value) validatePart(outputPart);
      }
    }
  }
}

/** Agent function outputs accept text; images use its user input_image API. */
function preserveToolImages(prompt: LanguageModelV4Prompt): LanguageModelV4Prompt {
  let changed = false;
  const migrated: LanguageModelV4Prompt = [];
  for (const message of prompt) {
    if (message.role !== 'tool' && message.role !== 'assistant') {
      migrated.push(message);
      continue;
    }
    const images: Extract<LanguageModelV4Prompt[number], { role: 'user' }>['content'] = [];
    const migratePart = (part: LanguageModelV4ToolResultPart): LanguageModelV4ToolResultPart => {
      const { output } = part;
      if (output.type !== 'content' || !output.value.some(value => value.type === 'file')) return part;
      if (output.value.some(value => value.type === 'custom')) {
        throw migrationError(
          'Perplexity Agent API supports text and image tool outputs, not custom tool result content.',
        );
      }
      changed = true;
      images.push({ type: 'text', text: `Images from tool ${part.toolName} (${part.toolCallId}):` });
      // Keep text/image order and file options. Repeating the text beside its
      // images preserves captions that would otherwise become detached.
      for (const value of output.value) {
        if (value.type === 'custom') continue;
        if (value.type === 'file' && value.filename) images.push({ type: 'text', text: `Image: ${value.filename}` });
        images.push(value);
      }
      return {
        ...part,
        output: { ...output, value: output.value.filter(value => value.type === 'text') },
      };
    };
    if (message.role === 'tool') {
      migrated.push({
        ...message,
        content: message.content.map(part => (part.type === 'tool-result' ? migratePart(part) : part)),
      });
    } else {
      migrated.push({
        ...message,
        content: message.content.map(part => (part.type === 'tool-result' ? migratePart(part) : part)),
      });
    }
    // Keep all outputs together before adding images, including parallel calls.
    if (images.length > 0) migrated.push({ role: 'user', content: images });
  }
  return changed ? migrated : prompt;
}

function migrateOptions(modelId: string, options: LanguageModelV4CallOptions): LanguageModelV4CallOptions {
  validateFileInputs(options);
  const prompt = preserveToolImages(options.prompt);
  if (prompt !== options.prompt) options = { ...options, prompt };
  const original = options.providerOptions?.perplexity;
  if (!original) return options;
  for (const key of UNSUPPORTED_SONAR_OPTIONS) {
    const value = original[key];
    if (value !== undefined && value !== false && !(Array.isArray(value) && value.length === 0)) {
      throw migrationError(
        `Perplexity Agent API has no equivalent for providerOptions.perplexity.${key}. Remove it and use a separate service or explicit prompting for that behavior.`,
      );
    }
  }
  const parsed = legacyOptionsSchema.safeParse(original);
  if (!parsed.success) {
    throw migrationError(`Invalid legacy Perplexity options: ${parsed.error.message}`);
  }
  const legacy = parsed.data;
  const migrated: Record<string, unknown> = { ...original };
  for (const key of [
    ...SEARCH_FILTERS,
    ...UNSUPPORTED_SONAR_OPTIONS,
    'reasoning_effort',
    'num_search_results',
    'web_search_options',
    'disable_search',
  ]) {
    delete migrated[key];
  }
  if (legacy.reasoning_effort !== undefined) {
    migrated.reasoning = { effort: legacy.reasoning_effort, ...record(migrated.reasoning) };
  }

  const tools = Array.isArray(migrated.tools) ? [...migrated.tools] : [];
  const searchIndex = tools.findIndex(tool => record(tool).type === 'web_search');
  const filters = Object.fromEntries(
    SEARCH_FILTERS.filter(key => legacy[key] !== undefined).map(key => [key, legacy[key]]),
  );
  const hasSearchOptions =
    Object.keys(filters).length > 0 ||
    legacy.num_search_results !== undefined ||
    legacy.web_search_options !== undefined;

  if (legacy.disable_search === true) {
    if (AGENT_PRESETS.has(modelId) && migrated.max_tool_calls !== 0) {
      throw migrationError(
        'Perplexity Agent API presets cannot disable only web search. Choose a direct model ID without a web_search tool, or explicitly set max_tool_calls: 0 to disable all native tool calls.',
      );
    }
    if (searchIndex >= 0 || hasSearchOptions) {
      throw migrationError(
        'Perplexity disable_search conflicts with web_search tools or search options. Remove the conflicting settings.',
      );
    }
  } else if (hasSearchOptions || legacy.disable_search === false) {
    const nativeSearch = searchIndex < 0 ? {} : record(tools[searchIndex]);
    const search = {
      type: 'web_search',
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
      ...(legacy.num_search_results !== undefined ? { max_results: legacy.num_search_results } : {}),
      ...legacy.web_search_options,
      ...nativeSearch,
      ...(Object.keys(filters).length > 0 ? { filters: { ...filters, ...record(nativeSearch.filters) } } : {}),
    };
    if (searchIndex < 0) tools.push(search);
    else tools[searchIndex] = search;
    migrated.tools = tools;
  }
  return {
    ...options,
    // The source options are JSON values; migration only moves their existing
    // fields into the documented Agent API objects.
    providerOptions: {
      ...options.providerOptions,
      perplexity: migrated,
    } as LanguageModelV4CallOptions['providerOptions'],
  };
}

/** Use the current Agent API without silently changing a retired Sonar model. */
export function createPerplexityGatewayModel(modelId: string, settings: PerplexityProviderSettings): LanguageModelV4 {
  const suggested = RETIRED_SONAR_MODELS.get(modelId);
  if (suggested) {
    throw migrationError(
      `Perplexity retired the Sonar Chat Completions model "${modelId}". Choose an Agent API preset (fast, low, medium, high, xhigh) or an explicit Agent model ID. "${suggested}" is a suggested starting point, not an equivalent alias; model, tools, cost and latency can change.`,
    );
  }
  const headerEntries = Object.entries(settings.headers ?? {});
  const integration = headerEntries.find(([name]) => name.toLowerCase() === 'x-pplx-integration');
  const headers = Object.fromEntries(headerEntries.filter(([name]) => name.toLowerCase() !== 'x-pplx-integration'));
  const model = createPerplexity({
    ...settings,
    headers: { ...headers, 'X-Pplx-Integration': integration?.[1] ?? MASTRA_USER_AGENT },
  })(modelId);
  return new Proxy(model, {
    get(target, property, receiver) {
      if (property === 'doGenerate')
        return (options: LanguageModelV4CallOptions) => target.doGenerate(migrateOptions(modelId, options));
      if (property === 'doStream')
        return (options: LanguageModelV4CallOptions) => target.doStream(migrateOptions(modelId, options));
      return Reflect.get(target, property, receiver);
    },
  });
}

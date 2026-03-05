import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import type { HarnessRequestContext } from '@mastra/core/harness';
import { ModelRouterLanguageModel } from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';
import { wrapLanguageModel } from 'ai';
import { AuthStorage } from '../auth/storage.js';
import { getCustomProviderId, loadSettings } from '../onboarding/settings.js';
import { opencodeClaudeMaxProvider, promptCacheMiddleware } from '../providers/claude-max.js';
import { openaiCodexProvider } from '../providers/openai-codex.js';
import type { ThinkingLevel } from '../providers/openai-codex.js';
import type { stateSchema } from '../schema.js';

const authStorage = new AuthStorage();

const OPENAI_PREFIX = 'openai/';

const CODEX_OPENAI_MODEL_REMAPS: Record<string, string> = {
  'gpt-5.3': 'gpt-5.3-codex',
  'gpt-5.2': 'gpt-5.2-codex',
  'gpt-5.1': 'gpt-5.1-codex',
  'gpt-5.1-mini': 'gpt-5.1-codex-mini',
  'gpt-5': 'gpt-5-codex',
};

type ResolvedModel =
  | ReturnType<typeof openaiCodexProvider>
  | ReturnType<typeof opencodeClaudeMaxProvider>
  | ModelRouterLanguageModel
  | ReturnType<ReturnType<typeof createAnthropic>>
  | ReturnType<ReturnType<typeof createOpenAI>>;

export function remapOpenAIModelForCodexOAuth(modelId: string): string {
  if (!modelId.startsWith(OPENAI_PREFIX)) {
    return modelId;
  }

  const openaiModelId = modelId.substring(OPENAI_PREFIX.length);

  if (openaiModelId.includes('-codex')) {
    return modelId;
  }

  const codexModelId = CODEX_OPENAI_MODEL_REMAPS[openaiModelId];
  if (!codexModelId) {
    return modelId;
  }

  return `${OPENAI_PREFIX}${codexModelId}`;
}

/**
 * Resolve the Anthropic API key from stored credentials.
 * Returns the key if available, undefined otherwise.
 */
export function getAnthropicApiKey(): string | undefined {
  // Check stored API key credential (set via /apikey or UI prompt)
  const storedCred = authStorage.get('anthropic');
  if (storedCred?.type === 'api_key' && storedCred.key.trim().length > 0) {
    return storedCred.key.trim();
  }
  return undefined;
}

/**
 * Resolve the OpenAI API key from stored credentials.
 * Returns the key if available, undefined otherwise.
 */
export function getOpenAIApiKey(): string | undefined {
  const storedCred = authStorage.get('openai-codex');
  if (storedCred?.type === 'api_key' && storedCred.key.trim().length > 0) {
    return storedCred.key.trim();
  }
  return undefined;
}

/**
 * Create an Anthropic model using a direct API key (no OAuth).
 * Applies prompt caching but NOT the Claude Code identity middleware
 * (which is only required for Claude Max OAuth).
 */
function anthropicApiKeyProvider(modelId: string, apiKey: string): LanguageModelV1 {
  const anthropic = createAnthropic({ apiKey });
  return wrapLanguageModel({
    model: anthropic(modelId),
    middleware: [promptCacheMiddleware],
  });
}

/**
 * Create an OpenAI model using a direct API key from AuthStorage.
 */
function openaiApiKeyProvider(modelId: string, apiKey: string): LanguageModelV1 {
  const openai = createOpenAI({ apiKey });
  return wrapLanguageModel({
    model: openai.responses(modelId),
  });
}

/**
 * Resolve a model ID to the correct provider instance.
 * Shared by the main agent, observer, and reflector.
 *
 * - For anthropic/* models: Uses stored OAuth credentials when present, otherwise direct API key
 * - For openai/* models: Uses OAuth when configured, otherwise direct API key from AuthStorage
 * - For moonshotai/* models: Uses Moonshot AI Anthropic-compatible endpoint
 * - For all other providers: Uses Mastra's model router (models.dev gateway)
 */
export function resolveModel(
  modelId: string,
  options?: { thinkingLevel?: ThinkingLevel; remapForCodexOAuth?: boolean },
): ResolvedModel {
  authStorage.reload();
  const [providerId, modelName] = modelId.split('/', 2);
  const settings = loadSettings();
  const customProvider =
    providerId && modelName
      ? settings.customProviders.find(provider => {
          return providerId === getCustomProviderId(provider.name);
        })
      : undefined;

  if (customProvider) {
    return new ModelRouterLanguageModel({
      id: modelId,
      url: customProvider.url,
      apiKey: customProvider.apiKey,
    });
  }

  const isAnthropicModel = modelId.startsWith('anthropic/');
  const isOpenAIModel = modelId.startsWith(OPENAI_PREFIX);
  const isMoonshotModel = modelId.startsWith('moonshotai/');

  if (isMoonshotModel) {
    if (!process.env.MOONSHOT_AI_API_KEY) {
      throw new Error(`Need MOONSHOT_AI_API_KEY`);
    }
    return createAnthropic({
      apiKey: process.env.MOONSHOT_AI_API_KEY!,
      baseURL: 'https://api.moonshot.ai/anthropic/v1',
      name: 'moonshotai.anthropicv1',
    })(modelId.substring('moonshotai/'.length));
  } else if (isAnthropicModel) {
    const bareModelId = modelId.substring('anthropic/'.length);
    const storedCred = authStorage.get('anthropic');

    // Primary path: explicit OAuth credential
    if (storedCred?.type === 'oauth') {
      return opencodeClaudeMaxProvider(bareModelId);
    }

    // Secondary path: explicit stored API key credential
    if (storedCred?.type === 'api_key' && storedCred.key.trim().length > 0) {
      return anthropicApiKeyProvider(bareModelId, storedCred.key.trim());
    }

    // Fallback: direct API key from AuthStorage
    const apiKey = getAnthropicApiKey();
    if (apiKey) {
      return anthropicApiKeyProvider(bareModelId, apiKey);
    }
    // No auth configured — attempt OAuth provider which will prompt login
    return opencodeClaudeMaxProvider(bareModelId);
  } else if (isOpenAIModel) {
    const bareModelId = modelId.substring(OPENAI_PREFIX.length);
    const storedCred = authStorage.get('openai-codex');

    if (storedCred?.type === 'oauth') {
      const resolvedModelId = options?.remapForCodexOAuth ? remapOpenAIModelForCodexOAuth(modelId) : modelId;
      return openaiCodexProvider(resolvedModelId.substring(OPENAI_PREFIX.length), {
        thinkingLevel: options?.thinkingLevel,
      });
    }

    const apiKey = getOpenAIApiKey();
    if (apiKey) {
      return openaiApiKeyProvider(bareModelId, apiKey);
    }

    return new ModelRouterLanguageModel(modelId);
  } else {
    return new ModelRouterLanguageModel(modelId);
  }
}

/**
 * Dynamic model function that reads the current model from harness state.
 * This allows runtime model switching via the /models picker.
 */
export function getDynamicModel({ requestContext }: { requestContext: RequestContext }): ResolvedModel {
  const harnessContext = requestContext.get('harness') as HarnessRequestContext<typeof stateSchema> | undefined;

  const modelId = harnessContext?.state?.currentModelId;
  if (!modelId) {
    throw new Error('No model selected. Use /models to select a model first.');
  }

  const thinkingLevel = harnessContext?.state?.thinkingLevel as ThinkingLevel | undefined;

  return resolveModel(modelId, { thinkingLevel });
}

import { createAnthropic } from '@ai-sdk/anthropic';
import type { HarnessRequestContext } from '@mastra/core/harness';
import { ModelRouterLanguageModel } from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';
import { AuthStorage } from '../auth/storage.js';
import { opencodeClaudeMaxProvider } from '../providers/claude-max.js';
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
  | ReturnType<ReturnType<typeof createAnthropic>>;

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
 * Resolve a model ID to the correct provider instance.
 * Shared by the main agent, observer, and reflector.
 *
 * - For anthropic/* models: Uses Claude Max OAuth provider (opencode auth)
 * - For openai/* models with OAuth: Uses OpenAI Codex OAuth provider
 * - For moonshotai/* models: Uses Moonshot AI Anthropic-compatible endpoint
 * - For all other providers: Uses Mastra's model router (models.dev gateway)
 */
export function resolveModel(
  modelId: string,
  options?: { thinkingLevel?: ThinkingLevel; remapForCodexOAuth?: boolean },
): ResolvedModel {
  authStorage.reload();
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
    return opencodeClaudeMaxProvider(modelId.substring(`anthropic/`.length));
  } else if (isOpenAIModel && authStorage.isLoggedIn('openai-codex')) {
    const resolvedModelId = options?.remapForCodexOAuth ? remapOpenAIModelForCodexOAuth(modelId) : modelId;
    return openaiCodexProvider(resolvedModelId.substring(OPENAI_PREFIX.length), {
      thinkingLevel: options?.thinkingLevel,
    });
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

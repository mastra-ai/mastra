import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import type { MastraLanguageModel } from '@mastra/core/agent';
import type { HarnessRequestContext } from '@mastra/core/harness';
import { ModelRouterLanguageModel } from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';
import { AuthStorage } from '../auth/storage.js';
import { opencodeClaudeMaxProvider } from '../providers/claude-max.js';
import { openaiCodexProvider } from '../providers/openai-codex.js';
import type { stateSchema } from '../schema.js';

const authStorage = new AuthStorage();

/**
 * Resolve a model ID to the correct provider instance.
 * Shared by the main agent, observer, and reflector.
 *
 * - For anthropic/* models: Uses Claude Max OAuth provider (opencode auth)
 * - For openai/* models with OAuth: Uses OpenAI Codex OAuth provider
 * - For moonshotai/* models: Uses Moonshot AI Anthropic-compatible endpoint
 * - For all other providers: Uses Mastra's model router (models.dev gateway)
 */
export function resolveModel(modelId: string): LanguageModelV1 | MastraLanguageModel {
  authStorage.reload();
  const isAnthropicModel = modelId.startsWith('anthropic/');
  const isOpenAIModel = modelId.startsWith('openai/');
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
    const apiKey = authStorage.getStoredApiKey('anthropic') ?? process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      return createAnthropic({ apiKey })(bareModelId);
    }
    return opencodeClaudeMaxProvider(bareModelId);
  } else if (isOpenAIModel) {
    const bareModelId = modelId.substring('openai/'.length);
    if (authStorage.isLoggedIn('openai-codex')) {
      return openaiCodexProvider(bareModelId);
    }
    const apiKey = authStorage.getStoredApiKey('openai-codex') ?? process.env.OPENAI_API_KEY;
    if (apiKey) {
      return createOpenAI({ apiKey }).chat(bareModelId);
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
export function getDynamicModel({
  requestContext,
}: {
  requestContext: RequestContext;
}): LanguageModelV1 | MastraLanguageModel {
  const harnessContext = requestContext.get('harness') as HarnessRequestContext<typeof stateSchema> | undefined;

  const modelId = harnessContext?.state?.currentModelId;
  if (!modelId) {
    throw new Error('No model selected. Use /models to select a model first.');
  }

  return resolveModel(modelId);
}

import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { getCredentialProviderId, withCodexFastModels } from '@mastra/code-sdk/providers/model-ids';

/**
 * Adds each connected OpenAI model's Fast entry to a model picker's list when OpenAI is signed in with ChatGPT.
 * A Factory's own list already says which Fast entries exist, so it is left as the Factory sent it.
 */
export function withFastEntries<T extends { id: string; modelName: string; hasApiKey: boolean }>(
  models: T[],
  { authStorage, factory }: { authStorage?: AuthStorage; factory?: unknown },
): T[] {
  if (factory) return models;
  const codexOAuth = authStorage?.get(getCredentialProviderId('openai'))?.type === 'oauth';
  return withCodexFastModels(models, { codexOAuth });
}

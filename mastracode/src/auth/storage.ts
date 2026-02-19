/**
 * Credential storage for API keys and OAuth tokens.
 * Handles loading, saving, and refreshing credentials from auth.json.
 * Also stores global preferences like last used model.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getAppDataDir } from '../utils/project.js';
import { anthropicOAuthProvider } from './providers/anthropic.js';
import { openaiCodexOAuthProvider } from './providers/openai-codex.js';
import type {
  AuthCredential,
  AuthStorageData,
  OAuthLoginCallbacks,
  OAuthProviderId,
  OAuthProviderInterface,
} from './types.js';

/**
 * Best/default models for each OAuth provider.
 * Used when auto-selecting a model after login.
 */
export const PROVIDER_DEFAULT_MODELS: Record<OAuthProviderId, string> = {
  anthropic: 'anthropic/claude-opus-4-6',
  'openai-codex': 'openai/gpt-5.3-codex',
};

// Provider registry
const oauthProviderRegistry = new Map<string, OAuthProviderInterface>([
  [anthropicOAuthProvider.id, anthropicOAuthProvider],
  [openaiCodexOAuthProvider.id, openaiCodexOAuthProvider],
]);

/**
 * Get an OAuth provider by ID
 */
export function getOAuthProvider(id: OAuthProviderId): OAuthProviderInterface | undefined {
  return oauthProviderRegistry.get(id);
}

/**
 * Get all registered OAuth providers
 */
export function getOAuthProviders(): OAuthProviderInterface[] {
  return Array.from(oauthProviderRegistry.values());
}

/**
 * Credential storage backed by a JSON file.
 */
export class AuthStorage {
  private data: AuthStorageData = {};

  constructor(private authPath: string = join(getAppDataDir(), 'auth.json')) {
    this.reload();
  }

  /**
   * Reload credentials from disk.
   */
  reload(): void {
    if (!existsSync(this.authPath)) {
      this.data = {};
      return;
    }
    try {
      this.data = JSON.parse(readFileSync(this.authPath, 'utf-8'));
    } catch {
      this.data = {};
    }
  }

  /**
   * Save credentials to disk.
   */
  private save(): void {
    const dir = dirname(this.authPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    writeFileSync(this.authPath, JSON.stringify(this.data, null, 2), 'utf-8');
    chmodSync(this.authPath, 0o600);
  }

  /**
   * Get credential for a provider.
   */
  get(provider: string): AuthCredential | undefined {
    return this.data[provider] ?? undefined;
  }

  /**
   * Set credential for a provider.
   */
  set(provider: string, credential: AuthCredential): void {
    this.data[provider] = credential;
    this.save();
  }

  /**
   * Remove credential for a provider.
   */
  remove(provider: string): void {
    delete this.data[provider];
    this.save();
  }

  /**
   * List all providers with credentials.
   */
  list(): string[] {
    return Object.keys(this.data);
  }

  /**
   * Check if credentials exist for a provider.
   */
  has(provider: string): boolean {
    return provider in this.data;
  }

  /**
   * Check if logged in via OAuth for a provider.
   */
  isLoggedIn(provider: string): boolean {
    const cred = this.data[provider];
    return cred?.type === 'oauth';
  }

  /**
   * Login to an OAuth provider.
   */
  async login(providerId: OAuthProviderId, callbacks: OAuthLoginCallbacks): Promise<void> {
    const provider = getOAuthProvider(providerId);
    if (!provider) {
      throw new Error(`Unknown OAuth provider: ${providerId}`);
    }

    const credentials = await provider.login(callbacks);
    this.set(providerId, { type: 'oauth', ...credentials });
  }

  /**
   * Logout from a provider.
   */
  logout(provider: string): void {
    this.remove(provider);
  }

  /**
   * Get API key for a provider, auto-refreshing OAuth tokens if needed.
   */
  async getApiKey(providerId: string): Promise<string | undefined> {
    const cred = this.data[providerId];

    if (cred?.type === 'api_key') {
      return cred.key;
    }

    if (cred?.type === 'oauth') {
      const provider = getOAuthProvider(providerId);
      if (!provider) {
        return undefined;
      }

      // Check if token needs refresh
      if (Date.now() >= cred.expires) {
        try {
          const newCreds = await provider.refreshToken(cred);
          this.set(providerId, { type: 'oauth', ...newCreds });
          return provider.getApiKey(newCreds);
        } catch {
          // Refresh failed - user needs to re-login
          return undefined;
        }
      }

      return provider.getApiKey(cred);
    }

    return undefined;
  }

  /**
   * Get the last used model ID (global preference).
   */
  getLastModelId(): string | undefined {
    return (this.data as any)._lastModelId;
  }

  /**
   * Set the last used model ID (global preference).
   */
  setLastModelId(modelId: string): void {
    (this.data as any)._lastModelId = modelId;
    this.save();
  }

  /**
   * Get the global model ID for a specific mode.
   * @param modeId Mode ID (e.g., "build", "plan", "explore")
   */
  getModeModelId(modeId: string): string | undefined {
    return (this.data as any)[`_modeModelId_${modeId}`];
  }

  /**
   * Set the global model ID for a specific mode.
   * @param modeId Mode ID (e.g., "build", "plan", "explore")
   * @param modelId Full model ID
   */
  setModeModelId(modeId: string, modelId: string): void {
    (this.data as any)[`_modeModelId_${modeId}`] = modelId;
    this.save();
  }

  /**
   * Get the global subagent model ID for an agent type.
   * @param agentType Optional agent type (explore, plan, execute)
   */
  getSubagentModelId(agentType?: string): string | undefined {
    if (agentType) {
      return (this.data as any)[`_subagentModelId_${agentType}`];
    }
    return (this.data as any)._subagentModelId;
  }

  /**
   * Set the global subagent model ID for an agent type.
   * @param modelId Full model ID
   * @param agentType Optional agent type (explore, plan, execute)
   */
  setSubagentModelId(modelId: string, agentType?: string): void {
    if (agentType) {
      (this.data as any)[`_subagentModelId_${agentType}`] = modelId;
    } else {
      (this.data as any)._subagentModelId = modelId;
    }
    this.save();
  }

  /**
   * Get the default model for a provider after login.
   */
  getDefaultModelForProvider(providerId: OAuthProviderId): string | undefined {
    return PROVIDER_DEFAULT_MODELS[providerId];
  }

  // ===========================================================================
  // Model Usage Ranking
  // ===========================================================================

  private getModelRanks(): Record<string, number> {
    return (this.data as any)._modelRanks ?? {};
  }

  /**
   * Get the use count for a model (0 if never used).
   */
  getModelUseCount(modelId: string): number {
    return this.getModelRanks()[modelId] ?? 0;
  }

  /**
   * Get all model use counts.
   */
  getAllModelUseCounts(): Record<string, number> {
    return { ...this.getModelRanks() };
  }

  /**
   * Increment the use count for a model and persist.
   */
  incrementModelUseCount(modelId: string): void {
    const ranks = this.getModelRanks();
    ranks[modelId] = (ranks[modelId] ?? 0) + 1;
    (this.data as any)._modelRanks = ranks;
    this.save();
  }
}

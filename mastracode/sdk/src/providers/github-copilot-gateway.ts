import { MastraModelGateway } from '@mastra/core/llm';
import type { GatewayAuthRequest, GatewayAuthResult, GatewayLanguageModel, ProviderConfig } from '@mastra/core/llm';
import type { CredentialStore } from '../auth/types.js';
import { getAuthStorage, getCopilotModelCatalog, githubCopilotProvider } from './github-copilot.js';

export const GITHUB_COPILOT_GATEWAY_ID = 'github-copilot';

/**
 * Standalone GitHub Copilot gateway.
 *
 * models.dev excludes Copilot from the shared registry, so Mastra Code supplies
 * the provider itself. It is its own gateway so catalog ids are the canonical
 * `github-copilot/<model>` rather than `mastracode/github-copilot/<model>`.
 */
export class GitHubCopilotGateway extends MastraModelGateway {
  readonly id = GITHUB_COPILOT_GATEWAY_ID;
  readonly name = 'GitHub Copilot';
  readonly #credentials?: CredentialStore;

  constructor(options: { credentialStore?: CredentialStore } = {}) {
    super();
    this.#credentials = options.credentialStore;
  }

  get #store(): CredentialStore {
    return this.#credentials ?? getAuthStorage();
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    try {
      const models = await getCopilotModelCatalog({ authStorage: this.#store });
      return {
        [GITHUB_COPILOT_GATEWAY_ID]: {
          name: 'GitHub Copilot',
          apiKeyEnvVar: '',
          apiKeyHeader: 'Authorization',
          gateway: this.id,
          models: models.map(model => model.id),
        },
      };
    } catch (error) {
      console.warn('Failed to load GitHub Copilot model catalog:', error);
      return {};
    }
  }

  buildUrl(_modelId: string): string | undefined {
    return undefined;
  }

  async getApiKey(_modelId: string): Promise<string> {
    return '';
  }

  resolveAuth(_request: GatewayAuthRequest): GatewayAuthResult | undefined {
    // The OAuth token is attached per request by the Copilot fetch wrapper.
    return this.#store.get(GITHUB_COPILOT_GATEWAY_ID)?.type === 'oauth'
      ? { bearerToken: 'oauth', source: 'gateway' }
      : undefined;
  }

  resolveLanguageModel(args: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
    transport?: any;
    responsesWebSocket?: any;
  }): GatewayLanguageModel {
    return githubCopilotProvider(args.modelId, {
      headers: args.headers,
      authStorage: this.#store,
    }) as unknown as GatewayLanguageModel;
  }
}

export function createGitHubCopilotGateway(options?: { credentialStore?: CredentialStore }): GitHubCopilotGateway {
  return new GitHubCopilotGateway(options);
}

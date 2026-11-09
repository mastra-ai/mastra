import { createVertex } from '@ai-sdk/google-vertex';
import { MastraModelGateway } from '@mastra/core/llm';
import type { GatewayAuthRequest, GatewayAuthResult, GatewayLanguageModel, ProviderConfig } from '@mastra/core/llm';
import { getGoogleVertexModelCatalog } from './google-vertex.js';

export const GOOGLE_VERTEX_GATEWAY_ID = 'google-vertex';

export function hasGoogleVertexConfiguration(): boolean {
  return Boolean(process.env.GOOGLE_VERTEX_PROJECT?.trim() && process.env.GOOGLE_VERTEX_LOCATION?.trim());
}

function googleVertexProvider(modelId: string, headers?: Record<string, string>) {
  const vertex = createVertex({
    project: process.env.GOOGLE_VERTEX_PROJECT?.trim(),
    location: process.env.GOOGLE_VERTEX_LOCATION?.trim(),
    headers,
  });
  return vertex(modelId);
}

export class GoogleVertexGateway extends MastraModelGateway {
  readonly id = GOOGLE_VERTEX_GATEWAY_ID;
  readonly name = 'Google Vertex AI';

  shouldEnable(): boolean {
    return hasGoogleVertexConfiguration();
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    const models = await getGoogleVertexModelCatalog();
    return {
      [GOOGLE_VERTEX_GATEWAY_ID]: {
        name: 'Google Vertex AI',
        apiKeyEnvVar: '',
        apiKeyHeader: 'Authorization',
        gateway: this.id,
        models: models.map(model => model.id),
      },
    };
  }

  buildUrl(_modelId: string): string | undefined {
    return undefined;
  }

  async getApiKey(_modelId: string): Promise<string> {
    return hasGoogleVertexConfiguration() ? 'google-application-default-credentials' : '';
  }

  resolveAuth(_request: GatewayAuthRequest): GatewayAuthResult | undefined {
    return hasGoogleVertexConfiguration()
      ? { apiKey: 'google-application-default-credentials', source: 'gateway' }
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
    return googleVertexProvider(args.modelId, args.headers) as unknown as GatewayLanguageModel;
  }
}

export function createGoogleVertexGateway(): GoogleVertexGateway {
  return new GoogleVertexGateway();
}

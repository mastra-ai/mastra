import { existsSync } from 'node:fs';
import path from 'node:path';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { MastraModelGateway } from '@mastra/core/llm';
import type { GatewayAuthRequest, GatewayAuthResult, GatewayLanguageModel, ProviderConfig } from '@mastra/core/llm';
import { wrapLanguageModel } from 'ai';
import type { LanguageModelMiddleware } from 'ai';
import { getBedrockModelCatalog } from './amazon-bedrock.js';

type ModelRequestHeaders = Record<string, string>;

/**
 * Insert Bedrock prompt-cache breakpoints so long agentic threads bill the
 * re-sent prefix at the cache-read rate instead of full-price input every turn.
 *
 * Bedrock uses `providerOptions.bedrock.cachePoint` ({ type: 'default' }) — a
 * different key from Anthropic's `providerOptions.anthropic.cacheControl`, which
 * is why the general prompt-cache middleware (Anthropic-only) never applied here.
 * We mark the last system message and the most recent message, matching how the
 * Anthropic path places its two breakpoints. Models that don't support cache
 * points ignore the field, so this is safe to always apply.
 */
export const bedrockCacheMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v3',
  transformParams: async ({ params }) => {
    const prompt = [...params.prompt];
    const cachePoint = { bedrock: { cachePoint: { type: 'default' as const } } };
    const mark = (msg: (typeof prompt)[number]) => ({
      ...msg,
      providerOptions: { ...msg.providerOptions, ...cachePoint },
    });

    for (let i = prompt.length - 1; i >= 0; i--) {
      if (prompt[i]!.role === 'system') {
        prompt[i] = mark(prompt[i]!);
        break;
      }
    }
    const lastIdx = prompt.length - 1;
    if (lastIdx >= 0) {
      prompt[lastIdx] = mark(prompt[lastIdx]!);
    }

    return { ...params, prompt };
  },
};

export const AMAZON_BEDROCK_GATEWAY_ID = 'amazon-bedrock';

/**
 * Whether AWS credentials look available for Bedrock.
 *
 * Amazon Bedrock authenticates with AWS SigV4 rather than a bearer API key, so
 * this only governs whether Bedrock models are offered as "authenticated" in the
 * picker. We look for the common signals (env vars, bearer token, a configured
 * profile, or a shared credentials/config file) rather than resolving
 * credentials here, since the auth checker must stay sync.
 */
export function hasAwsCredentials(): boolean {
  if (
    process.env.AWS_BEARER_TOKEN_BEDROCK ||
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
    process.env.AWS_SHARED_CREDENTIALS_FILE ||
    process.env.AWS_CONFIG_FILE ||
    process.env.AWS_PROFILE ||
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
    process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI ||
    process.env.AWS_WEB_IDENTITY_TOKEN_FILE
  ) {
    return true;
  }
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    const awsDir = path.join(home, '.aws');
    const credentialsPath = process.env.AWS_SHARED_CREDENTIALS_FILE ?? path.join(awsDir, 'credentials');
    const configPath = process.env.AWS_CONFIG_FILE ?? path.join(awsDir, 'config');
    if (existsSync(credentialsPath) || existsSync(configPath)) {
      return true;
    }
  }
  return false;
}

/**
 * Create an Amazon Bedrock model.
 *
 * Bedrock authenticates with AWS SigV4 rather than a bearer API key, so this
 * resolves credentials through the standard AWS provider chain
 * (`fromNodeProviderChain`): environment variables, shared `~/.aws` config and
 * SSO profiles, and container/instance roles — the same resolution order the AWS
 * CLI uses. The region falls back to `us-east-1` to match the AWS SDK default.
 *
 * When `AWS_BEARER_TOKEN_BEDROCK` is set, `@ai-sdk/amazon-bedrock` uses bearer
 * auth instead and ignores the credential provider, so we leave that path to the
 * SDK and only wire up SigV4 here.
 */
function bedrockProvider(modelId: string, headers?: ModelRequestHeaders) {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const bedrock = createAmazonBedrock({
    region,
    credentialProvider: fromNodeProviderChain(),
    headers,
  });
  // `@ai-sdk/amazon-bedrock` returns a LanguageModelV2 while `wrapLanguageModel`
  // is typed for V3; the SDK wraps both at runtime, so cast to bridge the types
  // (same pattern the gateway uses elsewhere).
  return wrapLanguageModel({
    model: bedrock(modelId) as any,
    middleware: [bedrockCacheMiddleware],
  });
}

/**
 * Standalone Amazon Bedrock gateway.
 *
 * Bedrock is resolved directly via AWS SigV4 (not through the model router) and
 * its models are surfaced from the public models.dev catalog. It is exposed as
 * its own gateway/provider (`amazon-bedrock/...`) rather than nested under the
 * MastraCode gateway namespace.
 */
export class AmazonBedrockGateway extends MastraModelGateway {
  readonly id = AMAZON_BEDROCK_GATEWAY_ID;
  readonly name = 'Amazon Bedrock';

  shouldEnable(): boolean {
    return hasAwsCredentials();
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    const providers: Record<string, ProviderConfig> = {};
    try {
      const bedrockModels = await getBedrockModelCatalog();
      providers['amazon-bedrock'] = {
        name: 'Amazon Bedrock',
        apiKeyEnvVar: '',
        apiKeyHeader: 'Authorization',
        gateway: this.id,
        models: bedrockModels.map(model => model.id),
      };
    } catch (error) {
      console.warn('Failed to load Amazon Bedrock model catalog:', error);
    }
    return providers;
  }

  buildUrl(_modelId: string): string | undefined {
    return undefined;
  }

  async getApiKey(_modelId: string): Promise<string> {
    return hasAwsCredentials() ? 'aws-credential-chain' : '';
  }

  resolveAuth(_request: GatewayAuthRequest): GatewayAuthResult | undefined {
    // Amazon Bedrock authenticates via the AWS credential chain rather than a
    // stored API key, so report it as authenticated whenever AWS credentials look
    // available. The actual SigV4 signing happens inside `bedrockProvider()`.
    if (hasAwsCredentials()) {
      return { apiKey: 'aws-credential-chain', source: 'gateway' };
    }
    return undefined;
  }

  resolveLanguageModel(args: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
    transport?: any;
    responsesWebSocket?: any;
  }): GatewayLanguageModel {
    return bedrockProvider(args.modelId, args.headers) as unknown as GatewayLanguageModel;
  }
}

export function createAmazonBedrockGateway(): AmazonBedrockGateway {
  return new AmazonBedrockGateway();
}

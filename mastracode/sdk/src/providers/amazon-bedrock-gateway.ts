import { existsSync } from 'node:fs';
import path from 'node:path';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { MastraModelGateway } from '@mastra/core/llm';
import type { GatewayAuthRequest, GatewayAuthResult, GatewayLanguageModel, ProviderConfig } from '@mastra/core/llm';
import { getBedrockModelCatalog } from './amazon-bedrock.js';

type ModelRequestHeaders = Record<string, string>;
type BedrockModel = ReturnType<ReturnType<typeof createAmazonBedrock>>;
type BedrockPrompt = Parameters<BedrockModel['doGenerate']>[0]['prompt'];

const CACHEABLE_BEDROCK_MODEL_IDS = [
  'anthropic.claude-3-5-haiku-',
  'anthropic.claude-3-5-sonnet-20241022-v2:0',
  'anthropic.claude-3-7-sonnet-',
  'anthropic.claude-fable-5',
  'anthropic.claude-haiku-4-5-',
  'anthropic.claude-opus-4-',
  'anthropic.claude-sonnet-4-',
  'anthropic.claude-sonnet-5',
];

export function supportsBedrockPromptCaching(modelId: string): boolean {
  return CACHEABLE_BEDROCK_MODEL_IDS.some(cacheableModelId => modelId.includes(cacheableModelId));
}

export function addBedrockCachePoints(prompt: BedrockPrompt): BedrockPrompt {
  const result = [...prompt];
  const markCachePoint = (message: (typeof result)[number]) => ({
    ...message,
    providerOptions: {
      ...message.providerOptions,
      bedrock: {
        ...message.providerOptions?.bedrock,
        cachePoint: { type: 'default' },
      },
    },
  });

  let lastSystemIndex = -1;
  for (let index = result.length - 1; index >= 0; index--) {
    if (result[index]!.role === 'system') {
      lastSystemIndex = index;
      break;
    }
  }

  if (lastSystemIndex >= 0) {
    result[lastSystemIndex] = markCachePoint(result[lastSystemIndex]!);
  }

  let lastNonSystemIndex = -1;
  for (let index = result.length - 1; index >= 0; index--) {
    if (result[index]!.role !== 'system') {
      lastNonSystemIndex = index;
      break;
    }
  }

  if (lastNonSystemIndex >= 0) {
    result[lastNonSystemIndex] = markCachePoint(result[lastNonSystemIndex]!);
  }

  return result;
}

export function withBedrockCache(model: BedrockModel): BedrockModel {
  return new Proxy(model, {
    get(target, property, receiver) {
      if (property === 'doGenerate') {
        return (options: Parameters<BedrockModel['doGenerate']>[0]) =>
          target.doGenerate({ ...options, prompt: addBedrockCachePoints(options.prompt) });
      }
      if (property === 'doStream') {
        return (options: Parameters<BedrockModel['doStream']>[0]) =>
          target.doStream({ ...options, prompt: addBedrockCachePoints(options.prompt) });
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

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
  const model = bedrock(modelId);
  return supportsBedrockPromptCaching(modelId) ? withBedrockCache(model) : model;
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

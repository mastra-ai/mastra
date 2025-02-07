import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { embed as embedAi, embedMany as embedManyAi, EmbedResult, EmbedManyResult } from 'ai';

import { MastraEmbedder } from './embedder';

export type BedrockEmbeddingModelNames =
  | 'amazon.titan-embed-text-v1'
  | 'amazon.titan-embed-image-v1'
  | 'cohere.embed-english-v3'
  | 'cohere.embed-multilingual-v3'
  | (string & {});

export async function embed(
  value: string,
  {
    region = process.env.AWS_REGION || 'us-east-1',
    accessKeyId = process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '',
    sessionToken = process.env.AWS_SESSION_TOKEN || '',
    model = 'amazon.titan-embed-text-v1',
    maxRetries = 3,
  }: {
    maxRetries?: number;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    model: BedrockEmbeddingModelNames;
  },
) {
  const bedrock = createAmazonBedrock({
    region,
    accessKeyId,
    secretAccessKey,
    sessionToken,
  });
  const eModel = bedrock.embedding(model);
  return await embedAi({ model: eModel, value, maxRetries });
}

export async function embedMany(
  values: string[],
  {
    region = process.env.AWS_REGION || 'us-east-1',
    accessKeyId = process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '',
    sessionToken = process.env.AWS_SESSION_TOKEN || '',
    model = 'amazon.titan-embed-text-v1',
    maxRetries = 3,
  }: {
    maxRetries?: number;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    model: BedrockEmbeddingModelNames;
  },
) {
  const bedrock = createAmazonBedrock({
    region,
    accessKeyId,
    secretAccessKey,
    sessionToken,
  });
  const eModel = bedrock.embedding(model);
  return await embedManyAi({
    model: eModel,
    values,
    maxRetries,
  });
}

export class BedrockEmbedder extends MastraEmbedder {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  model: BedrockEmbeddingModelNames;

  constructor({
    region = process.env.AWS_REGION || 'us-east-1',
    accessKeyId = process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '',
    sessionToken = process.env.AWS_SESSION_TOKEN || '',
    model = 'amazon.titan-embed-text-v1',
  }: {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    model?: BedrockEmbeddingModelNames;
  } = {}) {
    super();
    this.region = region;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.sessionToken = sessionToken;
    this.model = model;
  }

  async embed(
    value: string,
    { maxRetries }: { maxRetries?: number } = { maxRetries: 3 },
  ): Promise<EmbedResult<string>> {
    return embed(value, {
      region: this.region,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      sessionToken: this.sessionToken,
      model: this.model,
      maxRetries,
    });
  }

  async embedMany(
    values: string[],
    { maxRetries }: { maxRetries?: number } = { maxRetries: 3 },
  ): Promise<EmbedManyResult<string>> {
    return embedMany(values, {
      region: this.region,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      sessionToken: this.sessionToken,
      model: this.model,
      maxRetries,
    });
  }
}

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';

export type AmazonBedrockEmbeddingModelNames =
  | 'amazon.titan-embed-text-v1'
  | 'amazon.titan-embed-text-v2:0'
  | (string & {});

export function createBedrockEmbeddingModel({
  region,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  model,
}: {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  model: AmazonBedrockEmbeddingModelNames;
}) {
  const amazon = createAmazonBedrock({
    region: region || process.env.AWS_REGION || '',
    accessKeyId: accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '',
    sessionToken: sessionToken || process.env.AWS_SESSION_TOKEN || '',
  });

  return amazon.embedding(model);
}

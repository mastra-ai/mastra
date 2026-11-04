import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

/**
 * Shared Amazon Bedrock provider.
 *
 * Credentials come from the standard AWS provider chain (`fromNodeProviderChain`):
 * - locally: your `aws configure` / SSO profile or AWS_* env vars
 * - on AgentCore Runtime: the runtime's IAM execution role (no keys in the image)
 *
 * Model IDs are env-configurable because Bedrock model availability differs by
 * account and region. Pick IDs that are enabled in your region — list them with
 * `aws bedrock list-inference-profiles` / `aws bedrock list-foundation-models`.
 */
export const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentialProvider: fromNodeProviderChain(),
});

/** Region-prefixed inference profile for the chat model (prefix must match AWS_REGION). */
export const CHAT_MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6';

/** Titan Text Embeddings v2 — default output is 1024 dimensions. */
export const EMBED_MODEL_ID = process.env.BEDROCK_EMBED_MODEL_ID ?? 'amazon.titan-embed-text-v2:0';

/** Must match the embedding model's output size and the vector index dimension. */
export const EMBED_DIMENSION = Number(process.env.EMBED_DIMENSION ?? 1024);

/** Shared embedding model instance (used by both ingestion and the query tool). */
export const embeddingModel = bedrock.embedding(EMBED_MODEL_ID);

/**
 * Shared MongoDB connection config. One Atlas cluster backs BOTH the RAG vector
 * store AND the agent's memory/storage — the headline of this demo.
 */
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

/** Resolve the local URI first, otherwise read the configured plaintext secret with the runtime IAM role. */
async function getMongoDBUri(): Promise<string> {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  if (!process.env.MONGODB_SECRET_ARN) return '';

  // AgentCore supplies the runtime role credentials through the AWS SDK chain.
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
  try {
    const { SecretString } = await client.send(new GetSecretValueCommand({ SecretId: process.env.MONGODB_SECRET_ARN }));
    if (!SecretString) throw new Error('The MongoDB secret must contain the connection URI as plaintext.');
    return SecretString;
  } finally {
    client.destroy();
  }
}

export const MONGODB_URI = await getMongoDBUri();
export const MONGODB_DATABASE = process.env.MONGODB_DATABASE ?? 'mastra_docs';

/** Atlas Vector Search index (collection) name for the docs embeddings. */
export const VECTOR_INDEX = 'mastra_docs_embeddings';

/** Key the vector store is registered under in the Mastra instance. */
export const VECTOR_STORE_NAME = 'mongoVector';

if (!MONGODB_URI) {
  // Surface a clear error early rather than a cryptic driver failure later.
  console.warn('[mongo] Set MONGODB_URI locally or MONGODB_SECRET_ARN for deployment. See the README for setup.');
}

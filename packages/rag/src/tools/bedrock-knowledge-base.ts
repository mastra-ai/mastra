import {
  AgenticRetrieveStreamCommand,
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  type RetrievalResultLocation,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export interface BedrockKBToolOptions {
  /** The ID of the Bedrock Knowledge Base. */
  knowledgeBaseId: string;
  /** AWS region. Defaults to AWS_REGION env var or us-east-1. */
  region?: string;
  /** Maximum number of results. Defaults to 5. */
  numberOfResults?: number;
  /** Use AgenticRetrieveStream for complex queries with query decomposition and managed reranking. Falls back to plain Retrieve on failure. Defaults to true. */
  useAgenticRetrieval?: boolean;
  /** Default AWS user ID for access-controlled retrieval. A userId in the tool request context takes precedence. */
  userId?: string;
}

export interface BedrockKBResult {
  content: string;
  source?: string;
  score?: number;
  metadata: Record<string, unknown>;
}

function getSourceUri(location?: RetrievalResultLocation): string | undefined {
  if (location?.s3Location) return location.s3Location.uri;
  if (location?.webLocation) return location.webLocation.url;
  if (location?.confluenceLocation) return location.confluenceLocation.url;
  if (location?.salesforceLocation) return location.salesforceLocation.url;
  if (location?.sharePointLocation) return location.sharePointLocation.url;
  if (location?.customDocumentLocation) return location.customDocumentLocation.id;
  return undefined;
}

function getMetadataSource(metadata: Record<string, unknown>): string | undefined {
  return typeof metadata._source_uri === 'string' ? metadata._source_uri : undefined;
}

function getUserContext(userId: unknown): { userId: string } | undefined {
  return typeof userId === 'string' && userId.length > 0 ? { userId } : undefined;
}

const inputSchema = z.object({
  queryText: z.string().describe('The search query to find relevant documents in the knowledge base.'),
});

const outputSchema = z.object({
  results: z.array(
    z.object({
      content: z.string(),
      source: z.string().optional(),
      score: z.number().optional(),
      metadata: z.record(z.string(), z.unknown()),
    }),
  ),
});

export function createBedrockKBTool(options: BedrockKBToolOptions) {
  const {
    knowledgeBaseId,
    region = process.env.AWS_REGION ?? 'us-east-1',
    numberOfResults = 5,
    useAgenticRetrieval = process.env.USE_AGENTIC_RETRIEVAL !== 'false',
    userId: defaultUserId,
  } = options;

  const client = new BedrockAgentRuntimeClient({ region, customUserAgent: [['mastra', 'bedrock-kb']] });

  async function managedRetrieve(query: string, userId?: string): Promise<BedrockKBResult[]> {
    const command = new RetrieveCommand({
      knowledgeBaseId,
      retrievalQuery: { text: query },
      retrievalConfiguration: { managedSearchConfiguration: { numberOfResults } },
      userContext: getUserContext(userId),
    });

    const response = await client.send(command);

    return (response.retrievalResults ?? []).map(result => ({
      content: result.content?.text ?? '',
      source: getSourceUri(result.location),
      score: result.score,
      metadata: result.metadata ?? {},
    }));
  }

  async function agenticRetrieve(query: string, userId?: string): Promise<BedrockKBResult[]> {
    try {
      const command = new AgenticRetrieveStreamCommand({
        messages: [{ content: { text: query }, role: 'user' }],
        retrievers: [
          {
            configuration: {
              knowledgeBase: {
                knowledgeBaseId,
                retrievalOverrides: { maxNumberOfResults: numberOfResults },
              },
            },
          },
        ],
        agenticRetrieveConfiguration: {
          foundationModelType: 'MANAGED',
          rerankingModelType: 'MANAGED',
        },
        userContext: getUserContext(userId),
      });

      const response = await client.send(command);
      const results: BedrockKBResult[] = [];

      if (response.stream) {
        for await (const event of response.stream) {
          if (event.result?.results) {
            for (const result of event.result.results) {
              const metadata = result.metadata ?? {};
              results.push({
                content: result.content?.text ?? '',
                source: getMetadataSource(metadata),
                metadata,
              });
            }
          }
        }
      }

      return results;
    } catch (error) {
      console.warn('Agentic retrieval failed, falling back to managed retrieve:', error);
      return managedRetrieve(query, userId);
    }
  }

  return createTool({
    id: `bedrock_knowledge_base_${knowledgeBaseId}`,
    description:
      'Retrieves relevant documents from an Amazon Bedrock Knowledge Base. Use this to answer questions that require specific knowledge or context.',
    inputSchema,
    outputSchema,
    execute: async (inputData, context) => {
      const query = inputData.queryText;
      const userId = context?.requestContext?.get('userId') ?? defaultUserId;
      const results = useAgenticRetrieval
        ? await agenticRetrieve(query, typeof userId === 'string' ? userId : undefined)
        : await managedRetrieve(query, typeof userId === 'string' ? userId : undefined);

      return { results };
    },
  });
}

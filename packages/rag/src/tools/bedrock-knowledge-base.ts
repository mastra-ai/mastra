import { createTool } from '@mastra/core/tools';
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  AgenticRetrieveStreamCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
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
}

export interface BedrockKBResult {
  content: string;
  source: string;
  score: number;
  metadata: Record<string, unknown>;
}

function getSourceUri(result: Record<string, unknown>): string {
  if (result == null) return '';
  const location = (result.location ?? {}) as Record<string, any>;
  if (location.s3Location) return location.s3Location.uri ?? '';
  if (location.webLocation) return location.webLocation.url ?? '';
  if (location.confluenceLocation) return location.confluenceLocation.url ?? '';
  if (location.salesforceLocation) return location.salesforceLocation.url ?? '';
  if (location.sharePointLocation) return location.sharePointLocation.url ?? '';
  if (location.customDocumentLocation) return location.customDocumentLocation.id ?? '';
  // Fallback for agentic results
  const metadata = (result.metadata ?? {}) as Record<string, unknown>;
  return (metadata._source_uri as string) ?? '';
}

const inputSchema = z.object({
  queryText: z.string().describe('The search query to find relevant documents in the knowledge base.'),
});

const outputSchema = z.object({
  results: z.array(
    z.object({
      content: z.string(),
      source: z.string(),
      score: z.number(),
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
  } = options;

  const client = new BedrockAgentRuntimeClient({ region, customUserAgent: [['mastra', 'bedrock-kb']] });

  async function managedRetrieve(query: string): Promise<BedrockKBResult[]> {
    const command = new RetrieveCommand({
      knowledgeBaseId,
      retrievalQuery: { text: query },
      retrievalConfiguration: { managedSearchConfiguration: { numberOfResults } },
    });

    const response = await client.send(command);
    const results: BedrockKBResult[] = [];

    for (const result of response.retrievalResults ?? []) {
      results.push({
        content: result.content?.text ?? '',
        source: getSourceUri(result as unknown as Record<string, unknown>),
        score: result.score ?? 0,
        metadata: (result.metadata as Record<string, unknown>) ?? {},
      });
    }

    return results;
  }

  async function agenticRetrieve(query: string): Promise<BedrockKBResult[]> {
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
      } as any);

      const response = await client.send(command);
      const results: BedrockKBResult[] = [];
      const stream = (response as any).stream;

      if (stream) {
        for await (const event of stream) {
          if ('result' in event && event.result?.results) {
            for (const result of event.result.results) {
              results.push({
                content: result.content?.text ?? '',
                source: getSourceUri(result as Record<string, unknown>),
                score: result.score ?? 0,
                metadata: (result.metadata as Record<string, unknown>) ?? {},
              });
            }
          }
        }
      }

      return results;
    } catch (error) {
      console.warn('Agentic retrieval failed, falling back to managed retrieve:', error);
      return managedRetrieve(query);
    }
  }

  return createTool({
    id: `bedrock_knowledge_base_${knowledgeBaseId}`,
    description: 'Retrieves relevant documents from an Amazon Bedrock Knowledge Base. Use this to answer questions that require specific knowledge or context.',
    inputSchema,
    outputSchema,
    execute: async (inputData: { queryText: string }) => {
      const query = inputData.queryText;
      let results: BedrockKBResult[];

      if (useAgenticRetrieval) {
        results = await agenticRetrieve(query);
      } else {
        results = await managedRetrieve(query);
      }

      return { results };
    },
  });
}

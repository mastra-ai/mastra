import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  AgenticRetrieveStreamCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

export interface BedrockKBToolOptions {
  /** The ID of the Bedrock Knowledge Base. */
  knowledgeBaseId: string;
  /** AWS region. Defaults to AWS_REGION env var or us-east-1. */
  region?: string;
  /** Maximum number of results. Defaults to 5. */
  numberOfResults?: number;
  /** If true, generate a cited answer in addition to retrieval results. Defaults to false. */
  generateResponse?: boolean;

  /** Use AgenticRetrieveStream for complex queries with query decomposition and managed reranking. Falls back to plain Retrieve on failure. Defaults to true. */
  useAgenticRetrieval?: boolean;
}

export interface BedrockKBResult {
  content: string;
  source: string;
  score: number;
  metadata: Record<string, unknown>;
}

function getSourceUri(result: any): string {
  if (result == null) return '';
  const location = result.location ?? {};
  if (location.s3Location) return location.s3Location.uri ?? '';
  if (location.webLocation) return location.webLocation.url ?? '';
  if (location.confluenceLocation) return location.confluenceLocation.url ?? '';
  if (location.salesforceLocation) return location.salesforceLocation.url ?? '';
  if (location.sharePointLocation) return location.sharePointLocation.url ?? '';
  if (location.customDocumentLocation) return location.customDocumentLocation.id ?? '';
  // Fallback for agentic results
  return result.metadata?._source_uri ?? '';
}

export function createBedrockKBTool(options: BedrockKBToolOptions) {
  const {
    knowledgeBaseId,
    region = process.env.AWS_REGION ?? 'us-east-1',
    numberOfResults = 5,
    useAgenticRetrieval = process.env.USE_AGENTIC_RETRIEVAL !== 'false',
  } = options;

  const client = new BedrockAgentRuntimeClient({ region, customUserAgent: [['mastra', 'bedrock-kb']] });

  async function managedRetrieve(query: string): Promise<BedrockKBResult[]> {
    const retrievalConfiguration = { managedSearchConfiguration: { numberOfResults: numberOfResults ?? 5 } };

    const command = new RetrieveCommand({
      knowledgeBaseId,
      retrievalQuery: { text: query },
      retrievalConfiguration,
    });

    const response = await client.send(command);
    const results: BedrockKBResult[] = [];

    for (const result of response.retrievalResults ?? []) {
      results.push({
        content: result.content?.text ?? '',
        source: getSourceUri(result),
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
                retrievalOverrides: {
                  maxNumberOfResults: numberOfResults,
                },
              },
            },
          },
        ],
        agenticRetrieveConfiguration: {
          foundationModelType: 'MANAGED',
          rerankingModelType: 'MANAGED',
        },
      });

      const response = await client.send(command);
      const results: BedrockKBResult[] = [];

      if ((response as any).stream) {
        for await (const event of (response as any).stream) {
          if ('result' in event && event.result?.results) {
          for (const result of event.result.results) {
            results.push({
              content: result.content?.text ?? '',
              source: getSourceUri(result),
              score: result.score ?? 0,
              metadata: (result.metadata as Record<string, unknown>) ?? {},
            });
          }
        }
      }

      return results;
    } catch {
      // Fall back to plain managed retrieve
      return managedRetrieve(query);
    }
  }

  return {
    name: 'bedrock_knowledge_base',
    description:
      'Retrieves relevant documents from an Amazon Bedrock Knowledge Base.',

    async execute(query: string): Promise<BedrockKBResult[]> {
      if (useAgenticRetrieval) {
        return agenticRetrieve(query);
      }
      return managedRetrieve(query);
    },
  };
}

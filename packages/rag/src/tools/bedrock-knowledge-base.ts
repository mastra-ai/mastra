
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

  const client = new BedrockAgentRuntimeClient({ region });

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
        knowledgeBaseId,
        messages: [{ content: { text: query }, role: 'USER' }],
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

      if (response.result?.stream) {
        for await (const event of response.result.stream) {
          if ('retrievalResult' in event && event.retrievalResult) {
            const result = event.retrievalResult;
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

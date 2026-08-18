import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSend = vi.fn();
const commandInputs: unknown[] = [];

vi.mock('@aws-sdk/client-bedrock-agent-runtime', () => ({
  BedrockAgentRuntimeClient: class {
    send = mockSend;
  },
  RetrieveCommand: class {
    constructor(input: unknown) {
      commandInputs.push(input);
    }
  },
  AgenticRetrieveStreamCommand: class {
    constructor(input: unknown) {
      commandInputs.push(input);
    }
  },
}));

import { createBedrockKBTool } from './bedrock-knowledge-base';

type BedrockKBTool = ReturnType<typeof createBedrockKBTool>;
type BedrockKBToolContext = Parameters<NonNullable<BedrockKBTool['execute']>>[1];

function executeTool(tool: BedrockKBTool, queryText: string, requestContext = new RequestContext()) {
  return tool.execute!({ queryText }, { requestContext } as BedrockKBToolContext);
}

describe('createBedrockKBTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    commandInputs.length = 0;
  });

  it('creates a Mastra tool with the expected contract', () => {
    const tool = createBedrockKBTool({ knowledgeBaseId: 'kb-123', useAgenticRetrieval: false });

    expect(tool.id).toBe('bedrock_knowledge_base_kb-123');
    expect(tool.description).toContain('Amazon Bedrock Knowledge Base');
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('returns managed retrieval results with source and score', async () => {
    mockSend.mockResolvedValue({
      retrievalResults: [
        {
          content: { text: 'Managed result' },
          location: { type: 'S3', s3Location: { uri: 's3://bucket/doc.txt' } },
          score: 0.92,
          metadata: { category: 'docs' },
        },
      ],
    });

    const tool = createBedrockKBTool({ knowledgeBaseId: 'kb-123', useAgenticRetrieval: false });
    const output = await executeTool(tool, 'What is RAG?');

    expect(output).toEqual({
      results: [
        {
          content: 'Managed result',
          source: 's3://bucket/doc.txt',
          score: 0.92,
          metadata: { category: 'docs' },
        },
      ],
    });
  });

  it('maps the actual agentic result shape without inventing a score or location', async () => {
    async function* stream() {
      yield {
        result: {
          results: [
            {
              content: { text: 'Agentic result' },
              metadata: { _source_uri: 's3://bucket/agentic.txt', category: 'docs' },
              sourceRetriever: { identifier: 'kb-123' },
            },
          ],
        },
      };
    }

    mockSend.mockResolvedValue({ stream: stream() });

    const tool = createBedrockKBTool({ knowledgeBaseId: 'kb-123' });
    const output = await executeTool(tool, 'Compare the documents');

    expect(output).toEqual({
      results: [
        {
          content: 'Agentic result',
          source: 's3://bucket/agentic.txt',
          metadata: { _source_uri: 's3://bucket/agentic.txt', category: 'docs' },
        },
      ],
    });
  });

  it('falls back to managed retrieval when agentic retrieval fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('Agentic retrieval unavailable')).mockResolvedValueOnce({
      retrievalResults: [{ content: { text: 'Fallback result' }, metadata: {} }],
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const tool = createBedrockKBTool({ knowledgeBaseId: 'kb-123' });
    const output = await executeTool(tool, 'Find a result');

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(output).toEqual({
      results: [{ content: 'Fallback result', source: undefined, score: undefined, metadata: {} }],
    });
  });

  it('returns an empty result list when Bedrock finds no matches', async () => {
    mockSend.mockResolvedValue({ retrievalResults: [] });

    const tool = createBedrockKBTool({ knowledgeBaseId: 'kb-123', useAgenticRetrieval: false });

    await expect(executeTool(tool, 'No matches')).resolves.toEqual({ results: [] });
  });

  it('forwards the request context userId to managed retrieval', async () => {
    mockSend.mockResolvedValue({ retrievalResults: [] });
    const requestContext = new RequestContext();
    requestContext.set('userId', 'user-123');
    const tool = createBedrockKBTool({
      knowledgeBaseId: 'kb-123',
      useAgenticRetrieval: false,
      userId: 'default-user',
    });

    await executeTool(tool, 'Private documents', requestContext);

    expect(commandInputs[0]).toEqual(expect.objectContaining({ userContext: { userId: 'user-123' } }));
  });

  it('uses the configured userId when the request context does not provide one', async () => {
    async function* stream() {}
    mockSend.mockResolvedValue({ stream: stream() });
    const tool = createBedrockKBTool({ knowledgeBaseId: 'kb-123', userId: 'default-user' });

    await executeTool(tool, 'Private documents');

    expect(commandInputs[0]).toEqual(expect.objectContaining({ userContext: { userId: 'default-user' } }));
  });
});

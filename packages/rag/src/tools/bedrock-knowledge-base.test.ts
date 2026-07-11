import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-bedrock-agent-runtime', () => ({
  BedrockAgentRuntimeClient: class MockClient {
    send = mockSend;
  },
  RetrieveCommand: class MockRetrieveCommand {
    constructor(public input: any) {}
  },
  AgenticRetrieveStreamCommand: class MockAgenticCommand {
    constructor(public input: any) {}
  },
}));

import { createBedrockKBTool } from './bedrock-knowledge-base';

describe('createBedrockKBTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ retrievalResults: [] });
  });

  it('creates a tool with id and description', () => {
    const tool = createBedrockKBTool({ knowledgeBaseId: 'TEST123456', useAgenticRetrieval: false });
    expect(tool.id).toBe('bedrock_knowledge_base_TEST123456');
    expect(tool.description).toContain('Bedrock Knowledge Base');
    expect(tool.execute).toBeInstanceOf(Function);
  });

  it('executes managed retrieval with correct config', async () => {
    mockSend.mockResolvedValue({
      retrievalResults: [
        { content: { text: 'result' }, location: { s3Location: { uri: 's3://b/d' } }, score: 0.8, metadata: {} },
      ],
    });

    const tool = createBedrockKBTool({ knowledgeBaseId: 'TEST123456', useAgenticRetrieval: false });
    const output = await tool.execute({ context: {}, queryText: 'query' } as any);

    expect(output.results).toHaveLength(1);
    expect(output.results[0].content).toBe('result');
    expect(output.results[0].source).toBe('s3://b/d');
    expect(output.results[0].score).toBe(0.8);
  });

  it('executes agentic retrieval with stream processing', async () => {
    const mockStream = (async function* () {
      yield { result: { results: [
        { content: { text: 'agentic result' }, location: { s3Location: { uri: 's3://b/a' } }, score: 0.95, metadata: {} },
      ] } };
    })();

    mockSend.mockResolvedValue({ stream: mockStream });

    const tool = createBedrockKBTool({ knowledgeBaseId: 'TEST123456', useAgenticRetrieval: true });
    const output = await tool.execute({ context: {}, queryText: 'complex query' } as any);

    expect(output.results).toHaveLength(1);
    expect(output.results[0].content).toBe('agentic result');
    expect(output.results[0].source).toBe('s3://b/a');
    expect(output.results[0].score).toBe(0.95);
  });

  it('falls back to managed retrieval when agentic fails', async () => {
    // First call (agentic) throws, second call (managed) succeeds
    mockSend
      .mockRejectedValueOnce(new Error('Agentic not available'))
      .mockResolvedValueOnce({
        retrievalResults: [
          { content: { text: 'fallback' }, location: {}, score: 0.6, metadata: {} },
        ],
      });

    const tool = createBedrockKBTool({ knowledgeBaseId: 'TEST123456', useAgenticRetrieval: true });
    const output = await tool.execute({ context: {}, queryText: 'test' } as any);

    expect(output.results).toHaveLength(1);
    expect(output.results[0].content).toBe('fallback');
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('returns empty results when no documents match', async () => {
    mockSend.mockResolvedValue({ retrievalResults: [] });

    const tool = createBedrockKBTool({ knowledgeBaseId: 'TEST123456', useAgenticRetrieval: false });
    const output = await tool.execute({ context: {}, queryText: 'no match' } as any);

    expect(output.results).toHaveLength(0);
  });
});

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

  it('creates a tool with name and description', () => {
    const tool = createBedrockKBTool({ knowledgeBaseId: 'TEST123456', useAgenticRetrieval: false });
    expect(tool.name).toBe('bedrock_knowledge_base');
    expect(tool.description).toBeDefined();
    expect(tool.execute).toBeInstanceOf(Function);
  });

  it('executes with managed config by default', async () => {
    mockSend.mockResolvedValue({
      retrievalResults: [
        { content: { text: 'result' }, location: { s3Location: { uri: 's3://b/d' } }, score: 0.8 },
      ],
    });

    const tool = createBedrockKBTool({ knowledgeBaseId: 'TEST123456', useAgenticRetrieval: false });
    const results = await tool.execute('query');

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('result');
    expect(results[0].source).toBe('s3://b/d');
    expect(results[0].score).toBe(0.8);
  });
});

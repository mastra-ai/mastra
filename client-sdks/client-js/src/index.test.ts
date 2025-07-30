import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from './client';
import type { McpServerListResponse } from './types';
import type { ServerDetailInfo } from '@mastra/core/mcp';
import { ScoringEntityType, ScoringSource } from '@mastra/core/scores';

// Mock fetch globally
global.fetch = vi.fn();

describe('MastraClient Resources', () => {
  let client: MastraClient;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  // Helper to mock successful API responses
  const mockFetchResponse = (data: any, options: { isStream?: boolean } = {}) => {
    if (options.isStream) {
      let contentType = 'text/event-stream';
      let responseBody: ReadableStream;

      if (data instanceof ReadableStream) {
        responseBody = data;
        contentType = 'audio/mp3';
      } else {
        responseBody = new ReadableStream({
          start(controller) {
            if (typeof data === 'string') {
              controller.enqueue(new TextEncoder().encode(data));
            } else if (typeof data === 'object' && data !== null) {
              controller.enqueue(new TextEncoder().encode(JSON.stringify(data)));
            } else {
              controller.enqueue(new TextEncoder().encode(String(data)));
            }
            controller.close();
          },
        });
      }

      const headers = new Headers();
      if (contentType === 'audio/mp3') {
        headers.set('Transfer-Encoding', 'chunked');
      }
      headers.set('Content-Type', contentType);

      (global.fetch as any).mockResolvedValueOnce(
        new Response(responseBody, {
          status: 200,
          statusText: 'OK',
          headers,
        }),
      );
    } else {
      const response = new Response(undefined, {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      });
      response.json = () => Promise.resolve(data);
      (global.fetch as any).mockResolvedValueOnce(response);
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  describe('Vector Resource', () => {
    const vectorName = 'test-vector';
    let vector: ReturnType<typeof client.getVector>;

    beforeEach(() => {
      vector = client.getVector(vectorName);
    });

    it('should get vector index details', async () => {
      const mockResponse = {
        dimension: 128,
        metric: 'cosine',
        count: 1000,
      };
      mockFetchResponse(mockResponse);

      const result = await vector.details('test-index');
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/vector/test-vector/indexes/test-index`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should delete vector index', async () => {
      mockFetchResponse({ success: true });
      const result = await vector.delete('test-index');
      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/vector/test-vector/indexes/test-index`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should get all indexes', async () => {
      const mockResponse = { indexes: ['index1', 'index2'] };
      mockFetchResponse(mockResponse);
      const result = await vector.getIndexes();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/vector/test-vector/indexes`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should create vector index with all parameters', async () => {
      mockFetchResponse({ success: true });
      const result = await vector.createIndex({
        indexName: 'test-index',
        dimension: 128,
        metric: 'cosine',
      });
      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/vector/test-vector/create-index`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining(clientOptions.headers),
          body: JSON.stringify({
            indexName: 'test-index',
            dimension: 128,
            metric: 'cosine',
          }),
        }),
      );
    });

    it('should upsert vectors with metadata and ids', async () => {
      const mockResponse = ['id1', 'id2'];
      mockFetchResponse(mockResponse);
      const result = await vector.upsert({
        indexName: 'test-index',
        vectors: [
          [1, 2],
          [3, 4],
        ],
        metadata: [{ label: 'a' }, { label: 'b' }],
        ids: ['id1', 'id2'],
      });
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/vector/test-vector/upsert`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining(clientOptions.headers),
          body: JSON.stringify({
            indexName: 'test-index',
            vectors: [
              [1, 2],
              [3, 4],
            ],
            metadata: [{ label: 'a' }, { label: 'b' }],
            ids: ['id1', 'id2'],
          }),
        }),
      );
    });

    it('should query vectors with all parameters', async () => {
      const mockResponse = {
        results: [
          {
            id: 'id1',
            score: 0.9,
            metadata: { label: 'a' },
            vector: [1, 2],
          },
        ],
      };
      mockFetchResponse(mockResponse);
      const result = await vector.query({
        indexName: 'test-index',
        queryVector: [1, 2],
        topK: 10,
        filter: { label: 'a' },
        includeVector: true,
      });
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/vector/test-vector/query`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining(clientOptions.headers),
          body: JSON.stringify({
            indexName: 'test-index',
            queryVector: [1, 2],
            topK: 10,
            filter: { label: 'a' },
            includeVector: true,
          }),
        }),
      );
    });
  });

  describe('Agent Resource', () => {
    const agentId = 'test-agent';
    let agent: ReturnType<typeof client.getAgent>;

    beforeEach(() => {
      agent = client.getAgent(agentId);
    });

    it('should get all agents', async () => {
      const mockResponse = {
        agent1: { name: 'Agent 1', model: 'gpt-4' },
        agent2: { name: 'Agent 2', model: 'gpt-3.5' },
      };
      mockFetchResponse(mockResponse);
      const result = await client.getAgents();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/agents`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should get agent details', async () => {
      const mockResponse = {
        name: 'Test Agent',
        model: 'gpt-4',
        instructions: 'Test instructions',
        tools: {},
        workflows: {},
      };
      mockFetchResponse(mockResponse);

      const result = await agent.details();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/agents/test-agent`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should generate response', async () => {
      const mockResponse = {
        response: 'Generated response',
      };
      mockFetchResponse(mockResponse);

      const result = await agent.generate({
        messages: [],
        threadId: 'test-thread',
        resourceId: 'test-resource',
        output: {},
      });
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/agents/test-agent/generate`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining(clientOptions.headers),
          body: JSON.stringify({
            messages: [],
            threadId: 'test-thread',
            resourceId: 'test-resource',
            output: {},
          }),
        }),
      );
    });

    it('should stream responses', async () => {
      const mockChunk = `0:"test response"\n`;
      mockFetchResponse(mockChunk, { isStream: true });

      const response = await agent.stream({
        messages: [
          {
            role: 'user',
            content: 'test',
          },
        ],
      });

      expect(response.body).toBeInstanceOf(ReadableStream);
      const reader = response?.body?.getReader();
      expect(reader).toBeDefined();

      if (reader) {
        const { value, done } = await reader.read();
        expect(done).toBe(false);
        expect(new TextDecoder().decode(value)).toBe(mockChunk);
      }
    });

    it('should stream responses with tool calls', async () => {
      const firstMockChunk = `0:"test "
0:"response"
9:{"toolCallId":"tool1","toolName":"testTool","args":{"arg1":"value1"}}
e:{"finishReason":"tool-calls","usage":{"promptTokens":1,"completionTokens":1},"isContinued":false}
d:{"finishReason":"tool-calls","usage":{"promptTokens":2,"completionTokens":2}}
`;

      const secondMockChunk = `0:"final response"
e:{"finishReason":"stop","usage":{"promptTokens":2,"completionTokens":2},"isContinued":false}
d:{"finishReason":"stop","usage":{"promptTokens":2,"completionTokens":2}}
`;

      const firstResponseBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(firstMockChunk));
          controller.close();
        },
      });

      const secondResponseBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(secondMockChunk));
          controller.close();
        },
      });

      (global.fetch as any)
        .mockResolvedValueOnce(
          new Response(firstResponseBody, {
            status: 200,
            headers: new Headers({ 'Content-Type': 'text/event-stream' }),
          }),
        )
        .mockResolvedValueOnce(
          new Response(secondResponseBody, {
            status: 200,
            headers: new Headers({ 'Content-Type': 'text/event-stream' }),
          }),
        );

      const response = await agent.stream({
        messages: [
          {
            role: 'user',
            content: 'test',
          },
        ],
        clientTools: {
          testTool: {
            id: 'testTool',
            description: 'Test Tool',
            inputSchema: {
              type: 'object',
              properties: {
                arg1: { type: 'string' },
              },
            },
            execute: async () => {
              return 'test result';
            },
          },
        },
      });

      expect(response.body).toBeInstanceOf(ReadableStream);
      const reader = response?.body?.getReader();
      expect(reader).toBeDefined();

      let output = '';
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          output += new TextDecoder().decode(value);
        }
      }

      expect(global.fetch).toHaveBeenCalledTimes(2);

      const [secondUrl, secondConfig] = (global.fetch as any).mock.calls[1];
      expect(secondUrl).toBe(`${clientOptions.baseUrl}/api/agents/test-agent/stream`);

      const secondRequestBody = JSON.parse(secondConfig.body);
      expect(secondRequestBody.messages).toHaveLength(2);
      expect(secondRequestBody.messages[0].content).toBe('test');
      expect(secondRequestBody.messages[1].content).toBe('test response');
      expect(secondRequestBody.messages[1].parts).toEqual([
        {
          type: 'text',
          text: 'test response',
        },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            step: 0,
            toolCallId: 'tool1',
            toolName: 'testTool',
            args: {
              arg1: 'value1',
            },
            result: 'test result',
          },
        },
      ]);
    });

    it('should get agent tool', async () => {
      const mockResponse = {
        id: 'tool1',
        description: 'Test Tool',
      };
      mockFetchResponse(mockResponse);
      const result = await agent.getTool('tool1');
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/agents/test-agent/tools/tool1`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should get agent evals', async () => {
      const mockResponse = { data: 'test' };
      mockFetchResponse(mockResponse);
      const result = await agent.evals();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/agents/test-agent/evals/ci`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
    });

    it('should get live evals', async () => {
      const mockResponse = {
        name: 'Test Agent',
        evals: [{ id: 'eval1', live: true }],
      };
      mockFetchResponse(mockResponse);
      const result = await agent.liveEvals();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/agents/test-agent/evals/live`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });

  describe('Agent Voice Resource', () => {
    const agentId = 'test-agent';
    let agent: ReturnType<typeof client.getAgent>;
    beforeEach(() => {
      agent = client.getAgent(agentId);
    });
    it('should get available speakers', async () => {
      const mockResponse = [{ voiceId: 'speaker1' }];
      mockFetchResponse(mockResponse);

      const result = await agent.voice.getSpeakers();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/agents/test-agent/voice/speakers`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it(`should call speak without options`, async () => {
      const mockAudioStream = new ReadableStream();
      mockFetchResponse(mockAudioStream, { isStream: true });

      const result = await agent.voice.speak('test');

      expect(result).toBeInstanceOf(Response);
      expect(result.body).toBeInstanceOf(ReadableStream);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/agents/test-agent/voice/speak`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it(`should call speak with options`, async () => {
      const mockAudioStream = new ReadableStream();
      mockFetchResponse(mockAudioStream, { isStream: true });

      const result = await agent.voice.speak('test', { speaker: 'speaker1' });
      expect(result).toBeInstanceOf(Response);
      expect(result.body).toBeInstanceOf(ReadableStream);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/agents/test-agent/voice/speak`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it(`should call listen with audio file`, async () => {
      const transcriptionResponse = { text: 'Hello world' };
      mockFetchResponse(transcriptionResponse);

      const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });

      const result = await agent.voice.listen(audioBlob, { filetype: 'wav' });
      expect(result).toEqual(transcriptionResponse);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, config] = (global.fetch as any).mock.calls[0];
      expect(url).toBe(`${clientOptions.baseUrl}/api/agents/test-agent/voice/listen`);
      expect(config.method).toBe('POST');
      expect(config.headers).toMatchObject(clientOptions.headers);

      const formData = config.body;
      expect(formData).toBeInstanceOf(FormData);
      const audioContent = formData.get('audio');
      expect(audioContent).toBeInstanceOf(Blob);
      expect(audioContent.type).toBe('audio/wav');
    });

    it(`should call listen with audio blob and options`, async () => {
      const transcriptionResponse = { text: 'Hello world' };
      mockFetchResponse(transcriptionResponse);

      const audioBlob = new Blob(['test audio data'], { type: 'audio/mp3' });

      const result = await agent.voice.listen(audioBlob, { filetype: 'mp3' });

      expect(result).toEqual(transcriptionResponse);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, config] = (global.fetch as any).mock.calls[0];
      expect(url).toBe(`${clientOptions.baseUrl}/api/agents/test-agent/voice/listen`);
      expect(config.method).toBe('POST');
      expect(config.headers).toMatchObject(clientOptions.headers);

      const formData = config.body as FormData;
      expect(formData).toBeInstanceOf(FormData);
      const audioContent = formData.get('audio');
      expect(audioContent).toBeInstanceOf(Blob);
      expect(formData.get('options')).toBe(JSON.stringify({ filetype: 'mp3' }));
    });
  });

  const agentId = 'test-agent';

  describe('Memory Thread Resource', () => {
    const threadId = 'test-thread';
    let memoryThread: ReturnType<typeof client.getMemoryThread>;

    beforeEach(() => {
      memoryThread = client.getMemoryThread(threadId, agentId);
    });

    it('should get thread details', async () => {
      const mockResponse = {
        id: threadId,
        title: 'Test Thread',
        metadata: {},
      };
      mockFetchResponse(mockResponse);

      const result = await memoryThread.get();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/memory/threads/test-thread?agentId=${agentId}`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should update thread', async () => {
      const mockResponse = {
        id: threadId,
        title: 'Updated Thread',
        metadata: { updated: true },
      };
      mockFetchResponse(mockResponse);

      const result = await memoryThread.update({
        title: 'Updated Thread',
        metadata: { updated: true },
        resourceId: 'test-resource',
      });
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/memory/threads/test-thread?agentId=${agentId}`,
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should delete thread', async () => {
      const mockResponse = { result: 'deleted' };
      mockFetchResponse(mockResponse);
      const result = await memoryThread.delete();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/memory/threads/test-thread?agentId=${agentId}`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should get memory status', async () => {
      const mockResponse = { result: true };
      mockFetchResponse(mockResponse);
      const result = await client.getMemoryStatus(agentId);
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/memory/status?agentId=${agentId}`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should save messages to memory', async () => {
      const messages = [
        {
          id: '1',
          type: 'text' as const,
          content: 'test',
          role: 'user' as const,
          threadId: 'test-thread',
          resourceId: 'test-resource',
          createdAt: new Date('2025-03-26T10:40:55.116Z'),
        },
      ];
      mockFetchResponse(messages);
      const result = await client.saveMessageToMemory({ agentId, messages });
      expect(result).toEqual(messages);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/memory/save-messages?agentId=${agentId}`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
    });

    it('should get thread messages with limit', async () => {
      const mockResponse = {
        messages: [
          {
            id: '1',
            content: 'test',
            threadId,
            role: 'user',
            type: 'text',
            resourceId: 'test-resource',
            createdAt: new Date(),
          },
        ],
        uiMessages: [],
      };
      mockFetchResponse(mockResponse);

      const limit = 5;
      const result = await memoryThread.getMessages({ limit });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/memory/threads/${threadId}/messages?agentId=${agentId}&limit=${limit}`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should get paginated thread messages', async () => {
      const mockResponse = {
        messages: [
          {
            id: '1',
            content: 'test message',
            threadId,
            role: 'user',
            type: 'text',
            resourceId: 'test-resource',
            createdAt: new Date(),
          },
        ],
        total: 5,
        page: 1,
        perPage: 2,
        hasMore: true,
      };
      mockFetchResponse(mockResponse);

      const selectBy = {
        pagination: {
          page: 1,
          perPage: 2,
        },
      };

      const result = await memoryThread.getMessagesPaginated({
        resourceId: 'test-resource',
        format: 'v2',
        selectBy,
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/memory/threads/${threadId}/messages/paginated?resourceId=test-resource&format=v2&selectBy=${encodeURIComponent(JSON.stringify(selectBy))}`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });

  describe('Tool Resource', () => {
    const toolId = 'test-tool';
    let tool: ReturnType<typeof client.getTool>;

    beforeEach(() => {
      tool = client.getTool(toolId);
    });

    it('should get tool details', async () => {
      const mockResponse = {
        id: toolId,
        description: 'Test Tool',
        inputSchema: '{}',
        outputSchema: '{}',
      };
      mockFetchResponse(mockResponse);

      const result = await tool.details();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tools/test-tool`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should execute tool', async () => {
      const mockResponse = { data: 'test' };
      mockFetchResponse(mockResponse);
      const result = await tool.execute({ data: '', runId: 'test-run-id' });
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tools/test-tool/execute?runId=test-run-id`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
    });
  });

  describe('Workflow Resource', () => {
    const workflowId = 'test-workflow';
    let workflow: ReturnType<typeof client.getWorkflow>;

    beforeEach(() => {
      workflow = client.getWorkflow(workflowId);
    });

    it('should get workflow details', async () => {
      const mockResponse = {
        name: 'Test Workflow',
        triggerSchema: '{}',
        steps: {},
        stepGraph: {},
        stepSubscriberGraph: {},
      };
      mockFetchResponse(mockResponse);

      const result = await workflow.details();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workflows/test-workflow`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should execute workflow', async () => {
      const mockResponse = {
        result: 'Workflow execution result',
      };
      mockFetchResponse(mockResponse);

      const result = await workflow.startAsync({ inputData: { test: 'test' } });
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workflows/test-workflow/start-async?`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining(clientOptions.headers),
          body: JSON.stringify({ inputData: { test: 'test' } }),
        }),
      );
    });
  });

  describe('Client Error Handling', () => {
    it('should retry failed requests', async () => {
      // Mock first two calls to fail, third to succeed
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: () => 'application/json',
          },
          json: async () => ({ success: true }),
        });

      const result = await client.request('/test-endpoint');
      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(client.request('/test-endpoint')).rejects.toThrow('Network error');

      expect(global.fetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('Client Configuration', () => {
    it('should handle custom retry configuration', async () => {
      const customClient = new MastraClient({
        baseUrl: 'http://localhost:4111',
        retries: 2,
        backoffMs: 100,
        maxBackoffMs: 1000,
        headers: { 'Custom-Header': 'value' },
      });

      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: () => 'application/json',
          },
          json: async () => ({ success: true }),
        });

      const result = await customClient.request('/test');
      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4111/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Custom-Header': 'value',
          }),
        }),
      );
    });
  });

  describe('MCP Server Registry Client Methods', () => {
    const mockServerInfo1 = {
      id: 'mcp-server-1',
      name: 'Test MCP Server 1',
      version_detail: { version: '1.0.0', release_date: '2023-01-01T00:00:00Z', is_latest: true },
    };
    const mockServerInfo2 = {
      id: 'mcp-server-2',
      name: 'Test MCP Server 2',
      version_detail: { version: '1.1.0', release_date: '2023-02-01T00:00:00Z', is_latest: true },
    };

    const mockServerDetail1: ServerDetailInfo = {
      ...mockServerInfo1,
      description: 'Detailed description for server 1',
      package_canonical: 'npm',
      packages: [{ registry_name: 'npm', name: '@example/server1', version: '1.0.0' }],
      remotes: [{ transport_type: 'sse', url: 'http://localhost/sse1' }],
    };

    describe('getMcpServers()', () => {
      it('should fetch a list of MCP servers', async () => {
        const mockResponse: McpServerListResponse = {
          servers: [mockServerInfo1, mockServerInfo2],
          total_count: 2,
          next: null,
        };
        mockFetchResponse(mockResponse);

        const result = await client.getMcpServers();
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/mcp/v0/servers`,
          expect.objectContaining({
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
      });

      it('should fetch MCP servers with limit and offset parameters', async () => {
        const mockResponse: McpServerListResponse = {
          servers: [mockServerInfo1],
          total_count: 2,
          next: '/api/mcp/v0/servers?limit=1&offset=1',
        };
        mockFetchResponse(mockResponse);

        const result = await client.getMcpServers({ limit: 1, offset: 0 });
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/mcp/v0/servers?limit=1&offset=0`,
          expect.objectContaining({
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
      });
    });

    describe('getMcpServerDetails()', () => {
      const serverId = 'mcp-server-1';

      it('should fetch details for a specific MCP server', async () => {
        mockFetchResponse(mockServerDetail1);

        const result = await client.getMcpServerDetails(serverId);
        expect(result).toEqual(mockServerDetail1);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/mcp/v0/servers/${serverId}`,
          expect.objectContaining({
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
      });

      it('should fetch MCP server details with a version parameter', async () => {
        mockFetchResponse(mockServerDetail1);
        const version = '1.0.0';

        const result = await client.getMcpServerDetails(serverId, { version });
        expect(result).toEqual(mockServerDetail1);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/mcp/v0/servers/${serverId}?version=${version}`,
          expect.objectContaining({
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
      });
    });
  });

  describe('Scores Methods', () => {
    describe('getScorers()', () => {
      it('should fetch all available scorers', async () => {
        const mockResponse = {
          scorers: [
            { id: 'scorer-1', name: 'Test Scorer 1', description: 'A test scorer' },
            { id: 'scorer-2', name: 'Test Scorer 2', description: 'Another test scorer' },
          ],
        };
        mockFetchResponse(mockResponse);

        const result = await client.getScorers();
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/scores/scorers`,
          expect.objectContaining({
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
      });
    });

    describe('getScoresByRunId()', () => {
      it('should fetch scores by run ID without pagination', async () => {
        const mockResponse = {
          pagination: {
            total: 10,
            page: 0,
            perPage: 10,
            hasMore: false,
          },
          scores: [
            {
              id: 'score-1',
              runId: 'run-123',
              scorer: { name: 'test-scorer' },
              result: { score: 0.8 },
              input: { messages: [] },
              output: { response: 'test' },
              source: 'LIVE',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        };

        mockFetchResponse({
          ...mockResponse,
          scores: mockResponse.scores.map(score => ({
            ...score,
            createdAt: score.createdAt.toISOString(),
            updatedAt: score.updatedAt.toISOString(),
          })),
        });

        const result = await client.getScoresByRunId({ runId: 'run-123' });

        expect(result).toEqual({
          ...mockResponse,
          scores: mockResponse.scores.map(score => ({
            ...score,
            createdAt: score.createdAt.toISOString(),
            updatedAt: score.updatedAt.toISOString(),
          })),
        });

        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/scores/run/run-123`,
          expect.objectContaining({
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
      });

      it('should fetch scores by run ID with pagination', async () => {
        const mockResponse = {
          pagination: {
            total: 20,
            page: 1,
            perPage: 5,
            hasMore: true,
          },
          scores: [],
        };
        mockFetchResponse(mockResponse);

        const result = await client.getScoresByRunId({
          runId: 'run-123',
          page: 1,
          perPage: 5,
        });
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/scores/run/run-123?page=1&perPage=5`,
          expect.objectContaining({
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
      });
    });

    describe('getScoresByEntityId()', () => {
      it('should fetch scores by entity ID and type without pagination', async () => {
        const mockResponse = {
          pagination: {
            total: 5,
            page: 0,
            perPage: 10,
            hasMore: false,
          },
          scores: [
            {
              id: 'score-1',
              runId: 'run-123',
              entityId: 'agent-456',
              entityType: 'AGENT',
              scorer: { name: 'test-scorer' },
              result: { score: 0.9 },
              input: { messages: [] },
              output: { response: 'test' },
              source: 'LIVE',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        };

        const mockResponseWithDates = mockResponse.scores.map(score => ({
          ...score,
          createdAt: score.createdAt.toISOString(),
          updatedAt: score.updatedAt.toISOString(),
        }));

        mockFetchResponse({
          ...mockResponse,
          scores: mockResponseWithDates,
        });

        const result = await client.getScoresByEntityId({
          entityId: 'agent-456',
          entityType: 'AGENT',
        });

        expect(result).toEqual({
          ...mockResponse,
          scores: mockResponseWithDates,
        });

        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/scores/entity/AGENT/agent-456`,
          expect.objectContaining({
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
      });

      it('should fetch scores by entity ID and type with pagination', async () => {
        const mockResponse = {
          pagination: {
            total: 15,
            page: 2,
            perPage: 5,
            hasMore: true,
          },
          scores: [],
        };
        mockFetchResponse(mockResponse);

        const result = await client.getScoresByEntityId({
          entityId: 'workflow-789',
          entityType: 'WORKFLOW',
          page: 2,
          perPage: 5,
        });
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/scores/entity/WORKFLOW/workflow-789?page=2&perPage=5`,
          expect.objectContaining({
            body: undefined,
            headers: expect.objectContaining(clientOptions.headers),
            signal: undefined,
          }),
        );
      });
    });

    describe('saveScore()', () => {
      it('should save a score', async () => {
        const scoreData = {
          id: 'score-1',
          scorerId: 'test-scorer',
          runId: 'run-123',
          scorer: { name: 'test-scorer' },
          score: 0.85,
          input: [],
          output: { response: 'test response' },
          source: 'LIVE' as ScoringSource,
          entityId: 'agent-456',
          entityType: 'AGENT' as ScoringEntityType,
          entity: { id: 'agent-456', name: 'test-agent' },
          createdAt: new Date(),
          updatedAt: new Date(),
          runtimeContext: {
            model: {
              name: 'test-model',
              version: '1.0.0',
            },
          },
        };
        const mockResponse = {
          score: {
            ...scoreData,
            createdAt: scoreData.createdAt.toISOString(),
            updatedAt: scoreData.updatedAt.toISOString(),
          },
        };
        mockFetchResponse(mockResponse);

        const result = await client.saveScore({ score: scoreData });
        expect(result).toEqual({
          score: {
            ...scoreData,
            createdAt: scoreData.createdAt.toISOString(),
            updatedAt: scoreData.updatedAt.toISOString(),
          },
        });
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/scores`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining(clientOptions.headers),
            body: JSON.stringify({ score: scoreData }),
          }),
        );
      });
    });
  });
});

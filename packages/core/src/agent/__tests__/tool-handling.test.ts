import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import {
  convertArrayToReadableStream as convertArrayToReadableStreamV3,
  MockLanguageModelV3,
} from '@internal/ai-v6/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MastraError } from '../../error';
import { RequestContext } from '../../request-context';
import { createTool, webSearchTool } from '../../tools';
import { Agent } from '../agent';
import { getSingleDummyResponseModel } from './mock-model';

function toolhandlingTests(version: 'v1' | 'v2' | 'v3' | 'v4') {
  const dummyModel = getSingleDummyResponseModel(version);

  describe(`${version} - agent tool handling`, () => {
    describe('dynamic model resolution', () => {
      it('resolves the model once for all assigned tools', async () => {
        const resolveModel = vi.fn(() => dummyModel);
        const agent = new Agent({
          id: 'dynamic-model-agent',
          name: 'dynamic-model-agent',
          instructions: 'Use the assigned tools.',
          model: resolveModel,
          tools: {
            firstTool: createTool({
              id: 'first-tool',
              description: 'First test tool.',
              inputSchema: z.object({}),
              execute: async () => 'first',
            }),
            secondTool: createTool({
              id: 'second-tool',
              description: 'Second test tool.',
              inputSchema: z.object({}),
              execute: async () => 'second',
            }),
          },
        });

        await agent.getToolsForExecution({ requestContext: new RequestContext() });

        expect(resolveModel).toHaveBeenCalledTimes(1);
      });

      it('does not resolve the model when there are no assigned tools', async () => {
        const resolveModel = vi.fn(() => dummyModel);
        const agent = new Agent({
          id: 'dynamic-model-agent-without-tools',
          name: 'dynamic-model-agent-without-tools',
          instructions: 'No tools are assigned.',
          model: resolveModel,
        });

        await agent.getToolsForExecution({ requestContext: new RequestContext() });

        expect(resolveModel).not.toHaveBeenCalled();
      });
    });

    it('should handle tool name collisions caused by formatting', async () => {
      // Create two tool names that will collide after truncation to 63 chars
      const base = 'a'.repeat(63);
      const toolName1 = base + 'X'; // 64 chars
      const toolName2 = base + 'Y'; // 64 chars, but will be truncated to same as toolName1

      let testModel: MockLanguageModelV1 | MockLanguageModelV2 | MockLanguageModelV3;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        });
      } else if (version === 'v2') {
        testModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            text: 'ok',
            content: [
              {
                type: 'text',
                text: 'ok',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'ok' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          }),
        });
      } else {
        // v3
        testModel = new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 1, text: 1, reasoning: undefined },
            },
            content: [{ type: 'text', text: 'ok' }],
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStreamV3([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'ok' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
                  outputTokens: { total: 1, text: 1, reasoning: undefined },
                },
              },
            ]),
          }),
        });
      }

      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User agent',
        instructions: 'Test tool name collision.',
        model: testModel,
        tools: {
          [toolName1]: {
            id: toolName1,
            description: 'Tool 1',
            inputSchema: z.object({}),
            execute: async () => {},
          },
          [toolName2]: {
            id: toolName2,
            description: 'Tool 2',
            inputSchema: z.object({}),
            execute: async () => {},
          },
        },
      });
      await expect(
        userAgent['convertTools']({ requestContext: new RequestContext(), methodType: 'generate' }),
      ).rejects.toThrow(/same name/i);
    });

    it('should sanitize tool names with invalid characters', async () => {
      const badName = 'bad!@#tool$name';

      let testModel: MockLanguageModelV1 | MockLanguageModelV2 | MockLanguageModelV3;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        });
      } else if (version === 'v2') {
        testModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            text: 'ok',
            content: [
              {
                type: 'text',
                text: 'ok',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'ok' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          }),
        });
      } else {
        // v3
        testModel = new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 1, text: 1, reasoning: undefined },
            },
            content: [{ type: 'text', text: 'ok' }],
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStreamV3([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'ok' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
                  outputTokens: { total: 1, text: 1, reasoning: undefined },
                },
              },
            ]),
          }),
        });
      }

      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User agent',
        instructions: 'Test tool name sanitization.',
        model: testModel,
        tools: {
          [badName]: {
            id: badName,
            description: 'Tool with bad chars',
            inputSchema: z.object({}),
            execute: async () => {},
          },
        },
      });
      const tools = await userAgent['convertTools']({ requestContext: new RequestContext(), methodType: 'generate' });
      expect(Object.keys(tools)).toContain('bad___tool_name');
      expect(Object.keys(tools)).not.toContain(badName);
    });

    it('should prefix tool names that do not start with a letter or underscore', async () => {
      const badStart = '1tool';

      let testModel: MockLanguageModelV1 | MockLanguageModelV2 | MockLanguageModelV3;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        });
      } else if (version === 'v2') {
        testModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            text: 'ok',
            content: [
              {
                type: 'text',
                text: 'ok',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'ok' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          }),
        });
      } else {
        // v3
        testModel = new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 1, text: 1, reasoning: undefined },
            },
            content: [{ type: 'text', text: 'ok' }],
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStreamV3([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'ok' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
                  outputTokens: { total: 1, text: 1, reasoning: undefined },
                },
              },
            ]),
          }),
        });
      }

      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User agent',
        instructions: 'Test tool name prefix.',
        model: testModel,
        tools: {
          [badStart]: {
            id: badStart,
            description: 'Tool with bad start',
            inputSchema: z.object({}),
            execute: async () => {},
          },
        },
      });
      const tools = await userAgent['convertTools']({ requestContext: new RequestContext(), methodType: 'generate' });
      expect(Object.keys(tools)).toContain('_1tool');
      expect(Object.keys(tools)).not.toContain(badStart);
    });

    it('should truncate tool names longer than 63 characters', async () => {
      const longName = 'a'.repeat(70);

      let testModel: MockLanguageModelV1 | MockLanguageModelV2 | MockLanguageModelV3;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        });
      } else if (version === 'v2') {
        testModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            text: 'ok',
            content: [
              {
                type: 'text',
                text: 'ok',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'ok' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          }),
        });
      } else {
        // v3
        testModel = new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 1, text: 1, reasoning: undefined },
            },
            content: [{ type: 'text', text: 'ok' }],
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStreamV3([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'ok' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
                  outputTokens: { total: 1, text: 1, reasoning: undefined },
                },
              },
            ]),
          }),
        });
      }

      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User agent',
        instructions: 'Test tool name truncation.',
        model: testModel,
        tools: {
          [longName]: {
            id: longName,
            description: 'Tool with long name',
            inputSchema: z.object({}),
            execute: async () => {},
          },
        },
      });
      const tools = await userAgent['convertTools']({ requestContext: new RequestContext(), methodType: 'generate' });
      expect(Object.keys(tools).some(k => k.length === 63)).toBe(true);
      expect(Object.keys(tools)).not.toContain(longName);
    });
  });

  describe('agents as tools', () => {
    it('should disable deeper delegated-agent background dispatch without mutating shared agent configuration', async () => {
      const grandchild = new Agent({
        id: 'grandchild',
        name: 'grandchild',
        instructions: 'You are a grandchild agent.',
        model: dummyModel,
        backgroundTasks: { tools: 'all' },
      });
      const child = new Agent({
        id: 'child',
        name: 'child',
        instructions: 'You are a child agent.',
        model: dummyModel,
        agents: { grandchild },
      });

      const nestedTools = await child['convertTools']({
        requestContext: new RequestContext(),
        methodType: 'stream',
        backgroundTaskEnabled: true,
        backgroundTaskPolicy: {
          allowToolDispatch: true,
          allowDelegationDispatch: false,
        },
      });
      expect((nestedTools['agent-grandchild'] as any).backgroundConfig).toBeUndefined();

      const rootTools = await child['convertTools']({
        requestContext: new RequestContext(),
        methodType: 'stream',
        backgroundTaskEnabled: true,
      });
      expect((rootTools['agent-grandchild'] as any).backgroundConfig).toEqual({ enabled: true });
    });

    it('should pass requestContext to sub-agent getModel when determining model version', async () => {
      let receivedRequestContext: RequestContext | undefined;

      // Create a sub-agent with a function-based model that captures the requestContext
      const subAgent = new Agent({
        id: 'sub-agent',
        name: 'sub-agent',
        instructions: 'You are a sub-agent.',
        model: ({ requestContext }) => {
          receivedRequestContext = requestContext;
          return dummyModel;
        },
      });

      // Create an orchestrator agent with the sub-agent
      const orchestratorAgent = new Agent({
        id: 'orchestrator-agent',
        name: 'orchestrator-agent',
        instructions: 'You can delegate to sub-agents.',
        model: dummyModel,
        agents: {
          subAgent,
        },
      });

      // Create a requestContext with a specific value to track
      const testRequestContext = new RequestContext();
      testRequestContext.set('test-key', 'test-value');

      // getModel is called during tool execution (not tool creation) so we
      // need to invoke the agent tool's execute to trigger it.
      const tools = await orchestratorAgent['convertTools']({
        requestContext: testRequestContext,
        methodType: 'generate',
      });

      const agentTool = tools['agent-subAgent'];
      expect(agentTool).toBeDefined();

      // Execute the tool — it will call resolvedAgent.getModel({ requestContext })
      // during version resolution. The generate call itself will fail since the
      // mock model isn't wired for a full conversation, but getModel is invoked first.
      try {
        await agentTool.execute!({ prompt: 'hello' }, { toolCallId: 'test-call', messages: [] } as any);
      } catch {
        // Expected — the mock model doesn't support a full generate flow
      }

      // Verify that the sub-agent's model function received the correct requestContext
      expect(receivedRequestContext).toBeDefined();
      expect(receivedRequestContext?.get('test-key')).toBe('test-value');
    });

    it('should create agent tools for sub-agents with defaultOptions.memory', async () => {
      // Create a sub-agent with its own defaultOptions.memory
      const subAgent = new Agent({
        id: 'sub-agent-with-memory',
        name: 'sub-agent-with-memory',
        instructions: 'You are a sub-agent with custom memory config.',
        model: dummyModel,
        defaultOptions: {
          memory: {
            thread: 'custom-thread',
            resource: 'custom-resource',
          },
        },
      });

      // Create an orchestrator agent
      const orchestratorAgent = new Agent({
        id: 'orchestrator-agent',
        name: 'orchestrator-agent',
        instructions: 'You can delegate to sub-agents.',
        model: dummyModel,
        agents: {
          subAgent,
        },
      });

      // Verify the agent tool is created with proper configuration
      const tools = await orchestratorAgent['convertTools']({
        requestContext: new RequestContext(),
        methodType: 'generate',
        threadId: 'parent-thread',
        resourceId: 'parent-resource',
      });

      expect(tools['agent-subAgent']).toBeDefined();
    });

    it('should create agent tools for sub-agents without defaultOptions', async () => {
      // Create a sub-agent WITHOUT defaultOptions
      const subAgent = new Agent({
        id: 'sub-agent-no-options',
        name: 'sub-agent-no-options',
        instructions: 'You are a sub-agent without default options.',
        model: dummyModel,
      });

      // Create an orchestrator agent
      const orchestratorAgent = new Agent({
        id: 'orchestrator-agent',
        name: 'orchestrator-agent',
        instructions: 'You can delegate to sub-agents.',
        model: dummyModel,
        agents: {
          subAgent,
        },
      });

      // This should not throw - convertTools should handle missing defaultOptions gracefully
      const tools = await orchestratorAgent['convertTools']({
        requestContext: new RequestContext(),
        methodType: 'generate',
        threadId: 'parent-thread',
        resourceId: 'parent-resource',
      });

      // Verify the agent tool was created
      expect(tools['agent-subAgent']).toBeDefined();
    });

    it('should create agent tools for sub-agents with function-based defaultOptions', async () => {
      // Create a sub-agent with function-based defaultOptions
      const subAgent = new Agent({
        id: 'sub-agent-fn-options',
        name: 'sub-agent-fn-options',
        instructions: 'You are a sub-agent with function-based options.',
        model: dummyModel,
        defaultOptions: ({ requestContext }) => ({
          memory: {
            thread: `thread-${requestContext.get('userId') || 'default'}`,
            resource: 'custom-resource',
          },
        }),
      });

      // Create an orchestrator agent
      const orchestratorAgent = new Agent({
        id: 'orchestrator-agent',
        name: 'orchestrator-agent',
        instructions: 'You can delegate to sub-agents.',
        model: dummyModel,
        agents: {
          subAgent,
        },
      });

      // Verify the agent tool is created successfully
      const tools = await orchestratorAgent['convertTools']({
        requestContext: new RequestContext(),
        methodType: 'generate',
        threadId: 'parent-thread',
        resourceId: 'parent-resource',
      });

      expect(tools['agent-subAgent']).toBeDefined();
    });
  });
}

describe('webSearchTool agent resolution', () => {
  it('resolves the sentinel by value and preserves the user tool key', async () => {
    const agent = new Agent({
      id: 'web-search-agent',
      name: 'web-search-agent',
      instructions: 'Search the web.',
      model: 'openai/gpt-5-mini',
      tools: {
        searchTheWeb: webSearchTool,
      },
    });

    const tools = await agent.getToolsForExecution({ requestContext: new RequestContext() });

    expect(tools.searchTheWeb).toMatchObject({
      type: 'provider-defined',
      id: 'openai.web_search',
      name: 'web_search',
    });
    expect(tools.searchTheWeb.execute).toBeUndefined();
  });

  it('resolves the sentinel when listing tools for serialization', async () => {
    const agent = new Agent({
      id: 'web-search-agent',
      name: 'web-search-agent',
      instructions: 'Search the web.',
      model: 'google/gemini-3.5-flash',
      tools: {
        searchTheWeb: webSearchTool,
      },
    });

    const tools = await agent.listTools({ requestContext: new RequestContext() });

    expect(tools.searchTheWeb).toMatchObject({
      type: 'provider-defined',
      id: 'google.google_search',
      name: 'google_search',
    });
  });

  it('resolves router-string providers from the configured model', async () => {
    const agent = new Agent({
      id: 'web-search-agent',
      name: 'web-search-agent',
      instructions: 'Search the web.',
      model: 'anthropic/claude-sonnet-4-20250514',
      tools: {
        searchTheWeb: webSearchTool,
      },
    });

    const tools = await agent.getToolsForExecution({ requestContext: new RequestContext() });

    expect(tools.searchTheWeb).toMatchObject({
      type: 'provider-defined',
      id: 'anthropic.web_search_20250305',
      name: 'web_search',
    });
  });

  it('uses the per-call model override when resolving web search during execution', async () => {
    let capturedTools: Record<string, any> | undefined;
    const overrideModel = new MockLanguageModelV2({
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-20250514',
      doGenerate: async ({ tools }) => {
        capturedTools = tools;
        return {
          content: [{ type: 'text', text: 'ok' }],
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        };
      },
    });
    const agent = new Agent({
      id: 'web-search-agent',
      name: 'web-search-agent',
      instructions: 'Search the web.',
      model: 'openai/gpt-5-mini',
      tools: {
        searchTheWeb: webSearchTool,
      },
    });

    await agent.generate('search', { model: overrideModel });

    const capturedWebSearchTool = Array.isArray(capturedTools)
      ? capturedTools.find(tool => tool.name === 'web_search')
      : capturedTools?.searchTheWeb;

    expect(capturedWebSearchTool).toMatchObject({
      type: 'provider-defined',
      id: 'anthropic.web_search_20250305',
      name: 'web_search',
    });
  });

  it('does not resolve web search during MCP guidance before applying a supported per-call model override', async () => {
    let capturedTools: Record<string, any> | undefined;
    const overrideModel = new MockLanguageModelV2({
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-20250514',
      doGenerate: async ({ tools }) => {
        capturedTools = tools;
        return {
          content: [{ type: 'text', text: 'ok' }],
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        };
      },
    });
    const agent = new Agent({
      id: 'web-search-agent',
      name: 'web-search-agent',
      instructions: 'Search the web.',
      model: 'unsupported/model',
      tools: {
        searchTheWeb: webSearchTool,
      },
    });

    await agent.generate('search', { model: overrideModel });

    const capturedWebSearchTool = Array.isArray(capturedTools)
      ? capturedTools.find(tool => tool.name === 'web_search')
      : capturedTools?.searchTheWeb;

    expect(capturedWebSearchTool).toMatchObject({
      type: 'provider-defined',
      id: 'anthropic.web_search_20250305',
      name: 'web_search',
    });
  });

  it('throws for unsupported providers', async () => {
    const agent = new Agent({
      id: 'web-search-agent',
      name: 'web-search-agent',
      instructions: 'Search the web.',
      model: 'unsupported/model',
      tools: {
        searchTheWeb: webSearchTool,
      },
    });

    await expect(agent.getToolsForExecution({ requestContext: new RequestContext() })).rejects.toThrow(MastraError);
  });

  it('does not replace custom tools with web search-like names', async () => {
    const customTool = createTool({
      id: 'web_search',
      description: 'Custom web search.',
      inputSchema: z.object({}),
      execute: async () => 'custom',
    });
    const agent = new Agent({
      id: 'custom-web-search-agent',
      name: 'custom-web-search-agent',
      instructions: 'Search the web.',
      model: 'openai/gpt-5-mini',
      tools: {
        webSearch: customTool,
        web_search: customTool,
      },
    });

    const tools = await agent.getToolsForExecution({ requestContext: new RequestContext() });

    expect(tools.webSearch.id).toBe('web_search');
    expect(tools.webSearch.execute).toBeTypeOf('function');
    expect(tools.web_search.id).toBe('web_search');
    expect(tools.web_search.execute).toBeTypeOf('function');
  });
});

toolhandlingTests('v1');
toolhandlingTests('v2');
toolhandlingTests('v3');
toolhandlingTests('v4');

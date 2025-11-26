import { MockLanguageModelV1 } from '@internal/ai-sdk-v4';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { describe, expect, it } from 'vitest';
import z from 'zod';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';
import { getOpenAIModel, getSingleDummyResponseModel } from './mock-model';

function toolhandlingTests(version: 'v1' | 'v2') {
  const dummyModel = getSingleDummyResponseModel(version);
  const openaiModel = getOpenAIModel(version);

  describe(`${version} - agent tool handling`, () => {
    it('should handle tool name collisions caused by formatting', async () => {
      // Create two tool names that will collide after truncation to 63 chars
      const base = 'a'.repeat(63);
      const toolName1 = base + 'X'; // 64 chars
      const toolName2 = base + 'Y'; // 64 chars, but will be truncated to same as toolName1

      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        });
      } else {
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
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'ok' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
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

      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        });
      } else {
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
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'ok' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
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

      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        });
      } else {
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
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'ok' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
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

      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        });
      } else {
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
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'ok' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
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
    it('should expose sub-agents as tools when using generate/stream', async () => {
      // Create a research agent that will be used as a tool
      const researchAgent = new Agent({
        id: 'research-agent',
        name: 'research-agent',
        instructions: 'You are a research agent. Provide concise, factual information.',
        model: dummyModel,
      });

      // Create an orchestrator agent that has access to the research agent
      const orchestratorAgent = new Agent({
        id: 'orchestrator-agent',
        name: 'orchestrator-agent',
        instructions: 'You can delegate research tasks to specialized agents.',
        model: openaiModel,
        agents: {
          researchAgent,
        },
      });

      let result;
      let toolCalls;

      if (version === 'v1') {
        result = await orchestratorAgent.generateLegacy('Use the research agent to find information about TypeScript', {
          maxSteps: 2,
          toolChoice: 'required',
        });
        toolCalls = result.toolResults;
      } else {
        result = await orchestratorAgent.generate('Use the research agent to find information about TypeScript');
        toolCalls = result.toolResults;
      }

      // Verify that the research agent was called as a tool
      expect(toolCalls.length).toBeGreaterThan(0);

      const agentToolCall =
        version === 'v1'
          ? toolCalls.find((tc: any) => tc.toolName === 'agent-researchAgent')
          : toolCalls.find((tc: any) => tc.payload?.toolName === 'agent-researchAgent');

      expect(version === 'v1' ? toolCalls[0]?.result : toolCalls[0]?.payload?.result).toStrictEqual({
        ...(version === 'v1' ? {} : { subAgentResourceId: expect.any(String), subAgentThreadId: expect.any(String) }),
        text: 'Dummy response',
      });

      expect(agentToolCall).toBeDefined();
    }, 50000);
  });
}

toolhandlingTests('v1');
toolhandlingTests('v2');

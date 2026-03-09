import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import {
  convertArrayToReadableStream as convertArrayToReadableStreamV3,
  MockLanguageModelV3,
} from '@internal/ai-v6/test';
import { describe, expect, it } from 'vitest';
import z from 'zod';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';
import { getSingleDummyResponseModel } from './mock-model';

function toolhandlingTests(version: 'v1' | 'v2' | 'v3') {
  const dummyModel = getSingleDummyResponseModel(version);

  describe(`${version} - agent tool handling`, () => {
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

      // Call convertTools which internally calls listAgentTools -> agent.getModel()
      await orchestratorAgent['convertTools']({
        requestContext: testRequestContext,
        methodType: 'generate',
      });

      // Verify that the sub-agent's model function received the correct requestContext
      expect(receivedRequestContext).toBeDefined();
      expect(receivedRequestContext?.get('test-key')).toBe('test-value');
    });
  });
}

toolhandlingTests('v1');
toolhandlingTests('v2');
toolhandlingTests('v3');

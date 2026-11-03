import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { getLLMRecordingsDir, defaultNameGenerator, getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../memory/mock';
import { RequestContext } from '../request-context';
import type { ChunkType } from '../stream/types';
import { createTool } from '../tools';
import { Agent } from './index';

setupDummyApiKeys(getLLMTestMode(), ['google']);

let memory: MockMemory;
let requestContext: RequestContext;

let mockGateway: any;

// The AI SDK generates Gemini tool-call ids client-side from `Math.random()`
// (`createIdGenerator` in @ai-sdk/provider-utils). The auto-resume protocol
// makes the model echo those ids back (`suspendedToolCallId`), so replayed
// recordings can only correlate with the current run's persisted suspension if
// the ids are deterministic per test — same reason `crypto.randomUUID` is
// stubbed globally. Only draws made by the id generator consume the seeded
// stream; every other `Math.random` caller gets real randomness so incidental
// draws (e.g. live-mode networking) cannot shift the id sequence between
// record and replay.
let mathRandomSeed = 0;
const seededRandom = () => {
  // Mulberry32 — small deterministic PRNG, reset per test.
  mathRandomSeed = (mathRandomSeed + 0x6d2b79f5) | 0;
  let t = mathRandomSeed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const realRandom = Math.random.bind(Math);
// Matches the `generator` closure from `createIdGenerator` in
// @ai-sdk/provider-utils and its vendored copies (packages/_vendored/ai_*).
// Frames appear as `at generator (...)` or `at Object.generator [as generateId] (...)`.
const idGeneratorFrame = /at (?:\S+\.)?generator(?: \[as \w+\])? \(.*(@ai-sdk[/+]provider-utils|_vendored[/\\]ai_)/;

beforeEach(async c => {
  mathRandomSeed = 0;
  vi.spyOn(Math, 'random').mockImplementation(() =>
    idGeneratorFrame.test(new Error().stack ?? '') ? seededRandom() : realRandom(),
  );
  memory = new MockMemory();
  requestContext = new RequestContext();
  mockGateway = createGatewayMock({
    maxChunkDelay: 1000,
    replayWithTiming: true,
    name: `test-${Buffer.from(
      // use stable 8-char hash from c.task.name
      createHash('sha256').update(c.task.name).digest('hex').slice(0, 8),
    )}`,
    exactMatch: true,
    recordingsDir: join(getLLMRecordingsDir(c.task.file.filepath), defaultNameGenerator(c.task.file.filepath)),
    transformRequest: ({ url, body }) => {
      let serialized = JSON.stringify(body);
      // Normalize UUIDs (runId, suspendedToolRunId)
      // serialized = serialized.replace(
      //   /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      //   '00000000-0000-0000-0000-000000000000',
      // );
      // Normalize toolCallId (AI SDK generated, alphanumeric ~16 chars).
      serialized = serialized.replace(/"toolCallId":"[a-zA-Z0-9]+"/g, '"toolCallId":"NORMALIZED"');
      serialized = serialized.replace(/\\"toolCallId\\":\\"[a-zA-Z0-9]+\\"/g, '\\"toolCallId\\":\\"NORMALIZED\\"');
      // Normalize workflow run IDs that depend on UUID counter state.
      serialized = serialized.replace(/"runId":"[^"]+"/g, '"runId":"NORMALIZED"');
      serialized = serialized.replace(/\\"runId\\":\\"[^\\"]+\\"/g, '\\"runId\\":\\"NORMALIZED\\"');
      serialized = serialized.replace(/"suspendedToolRunId":"[^"]+"/g, '"suspendedToolRunId":"NORMALIZED"');
      serialized = serialized.replace(
        /\\"suspendedToolRunId\\":\\"[^\\"]+\\"/g,
        '\\"suspendedToolRunId\\":\\"NORMALIZED\\"',
      );
      serialized = serialized.replace(/"suspendedToolCallId":"[^"]+"/g, '"suspendedToolCallId":"NORMALIZED"');
      serialized = serialized.replace(
        /\\"suspendedToolCallId\\":\\"[^\\"]+\\"/g,
        '\\"suspendedToolCallId\\":\\"NORMALIZED\\"',
      );
      // Normalize workflow timestamps embedded in multi-level stringified results.
      // They can appear at various escape depths (\"startedAt\", \\\"startedAt\\\", etc.)
      serialized = serialized.replace(/(\\*"startedAt\\*":\s*)\d{10,}/g, '$10');
      serialized = serialized.replace(/(\\*"completedAt\\*":\s*)\d{10,}/g, '$10');
      serialized = serialized.replace(/(\\*"endedAt\\*":\s*)\d{10,}/g, '$10');
      // Normalize wall-clock durations embedded in network completion-check feedback
      // (e.g. "Duration: 3649ms") — replay is much faster than the recorded run.
      serialized = serialized.replace(/Duration: \d+ms/g, 'Duration: NORMALIZEDms');

      const parsed = JSON.parse(serialized);

      // Normalize client-generated tool call ids echoed back in Gemini
      // functionCall/functionResponse parts — the AI SDK generates a fresh
      // random id per run, so they can never match the recorded request.
      // Also drop the provider-injected `skip_thought_signature_validator`
      // sentinel: @ai-sdk/google decides when to inject it for Gemini 3
      // parallel function calls without a real thoughtSignature, and that
      // decision changed across provider versions (4.0.18 injected it on
      // every unsigned call; 4.0.25 skips calls that follow a signed call
      // in the same model response). Real signatures are replay-stable and
      // remain part of the hash.
      const normalizeFunctionCallIds = (value: unknown): void => {
        if (Array.isArray(value)) {
          for (const item of value) normalizeFunctionCallIds(item);
          return;
        }
        if (value && typeof value === 'object') {
          const obj = value as Record<string, unknown>;
          if (obj.thoughtSignature === 'skip_thought_signature_validator') {
            delete obj.thoughtSignature;
          }
          // Provider upgrades can represent this permissive schema differently.
          // Its shape does not affect the suspension behavior under test.
          if (obj.description === 'The resumeData object created from the resumeSchema of suspended tool') {
            for (const key of Object.keys(obj)) {
              if (key !== 'description') delete obj[key];
            }
          }
          for (const [key, child] of Object.entries(obj)) {
            if (
              (key === 'functionCall' || key === 'functionResponse') &&
              child &&
              typeof child === 'object' &&
              'id' in (child as Record<string, unknown>)
            ) {
              (child as Record<string, unknown>).id = 'NORMALIZED';
            }
            normalizeFunctionCallIds(child);
          }
        }
      };
      normalizeFunctionCallIds(parsed);

      return { url, body: parsed };
    },
  });
  await mockGateway.start();
});
afterEach(async () => {
  await mockGateway.saveAndStop();
  vi.mocked(Math.random).mockRestore();
});

// These cases check which message orderings and request shapes the real Gemini API
// accepts, so they stay recorded until they move to the real-provider tier (#28459).
// Engine behaviour that used to live here is covered by aimock scenarios under
// src/loop/test-utils/aimock/scenarios (#27423).
describe('Gemini Model Compatibility Tests', () => {
  // gemini-2.0-flash was shut down 2026-06-01 and gemini-3-pro-preview was shut
  // down 2026-03-09, so recordings can no longer be refreshed against them.
  const MODEL = 'google/gemini-2.5-flash';
  const GEMINI_3_PRO = 'google/gemini-3.1-pro-preview';

  describe('Direct generate() method - Gemini basic functionality', () => {
    it('should throw error for empty user message', async () => {
      const agent = new Agent({
        id: 'system-context-agent',
        name: 'System Context Agent',
        instructions: 'You are an expert assistant. Always provide detailed explanations.',
        model: MODEL,
      });

      await expect(agent.generate('')).rejects.toThrow();
    });

    it('should handle single turn with maxSteps=1 and messages ending with assistant', async () => {
      const agent = new Agent({
        id: 'max-steps-agent',
        name: 'Max Steps Agent',
        instructions: 'You help users choose between options A, B, or C.',
        model: MODEL,
        memory,
      });

      const result = await agent.generate(
        [
          {
            role: 'user',
            content:
              'I need to choose between option A (fast), option B (cheap), or option C (reliable). I value reliability most.',
          },
          { role: 'assistant', content: 'Let me help you make the best choice.' },
        ],
        {
          maxSteps: 1,
          structuredOutput: {
            schema: z.object({
              selection: z.string(),
              reason: z.string(),
            }),
          },
        },
      );

      expect(result).toBeDefined();
      expect(result.object).toBeDefined();
    });

    it('should handle conversation ending with tool result', async () => {
      const testTool = createTool({
        id: 'weather-tool',
        description: 'Gets weather information',
        inputSchema: z.object({ location: z.string() }),
        outputSchema: z.object({ weather: z.string() }),
        execute: async () => ({ weather: 'Sunny, 72°F' }),
      });

      const agent = new Agent({
        id: 'tool-result-ending-agent',
        name: 'Tool Result Ending Agent',
        instructions: 'You help with weather queries',
        model: MODEL,
        tools: { testTool },
      });

      const result = await agent.generate([
        { role: 'user', content: 'What is the weather?' },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              toolName: 'weather-tool',
              args: { location: 'San Francisco' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_1',
              toolName: 'weather-tool',
              result: 'Sunny, 72°F',
            },
          ],
        },
      ]);

      expect(result).toBeDefined();
    });

    it('should handle messages starting with assistant-with-tool-call', async () => {
      const testTool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async () => ({ result: 'test result' }),
      });

      const agent = new Agent({
        id: 'tool-call-agent',
        name: 'Tool Call Agent',
        instructions: 'You help users with their queries',
        model: MODEL,
        tools: { testTool },
      });

      const result = await agent.generate([
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              toolName: 'test-tool',
              args: { query: 'test' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_1',
              toolName: 'test-tool',
              result: 'previous result',
            },
          ],
        },
        { role: 'user', content: 'What was that about?' },
      ]);

      expect(result).toBeDefined();
    });

    it('should handle messages with only assistant role', async () => {
      const agent = new Agent({
        id: 'assistant-only-agent',
        name: 'Assistant Only Agent',
        instructions: 'You help users with their queries',
        model: MODEL,
      });

      const result = await agent.generate([{ role: 'assistant', content: 'I can help you with that task.' }]);

      expect(result).toBeDefined();
    });
  });

  describe('Agent network() method', () => {
    it('should handle empty user message with system context in network', async () => {
      const helperAgent = new Agent({
        id: 'helper-agent',
        name: 'Helper Agent',
        instructions: 'You help with tasks',
        model: MODEL,
        defaultOptions: {
          maxSteps: 1,
        },
      });

      const agent = new Agent({
        id: 'network-empty-message-agent',
        name: 'Network Empty Message Agent',
        instructions: 'You coordinate tasks. Always provide detailed explanations.',
        model: MODEL,
        agents: { helperAgent },
        memory,
        defaultOptions: {
          maxSteps: 1,
        },
      });

      const stream = await agent.network('', {
        requestContext,
        maxSteps: 1,
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      console.log(JSON.stringify(chunks, null, 2));
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
    }, 120_000);

    it('should handle single turn with maxSteps=1 and messages ending with assistant in network', async () => {
      const helperAgent = new Agent({
        id: 'helper-agent',
        name: 'Calculator Agent',
        instructions: 'You are a calculator. When asked for math, respond with just the numeric answer.',
        model: MODEL,
      });

      const agent = new Agent({
        id: 'network-max-steps-agent',
        name: 'Network Max Steps Agent',
        instructions: 'You coordinate tasks. Always delegate math questions to helperAgent.',
        model: MODEL,
        agents: { helperAgent },
        memory,
      });

      const stream = await agent.network(
        [
          { role: 'user', content: 'What is 5 plus 3?' },
          { role: 'assistant', content: 'Let me calculate that for you.' },
        ],
        {
          requestContext,
          maxSteps: 1,
        },
      );

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
    }, 30_000);

    it(
      'should handle conversation ending with tool result in network (with follow-up user message)',
      { timeout: 30_000 },
      async () => {
        const testTool = createTool({
          id: 'weather-tool',
          description: 'Gets weather information',
          inputSchema: z.object({ location: z.string() }),
          outputSchema: z.object({ weather: z.string() }),
          execute: async () => ({ weather: 'Sunny, 72°F' }),
        });

        const agent = new Agent({
          id: 'network-tool-result-ending-agent',
          name: 'Network Tool Result Ending Agent',
          instructions: 'You help with weather queries. Summarize weather results when asked.',
          model: MODEL,
          tools: { testTool },
          memory,
        });

        const stream = await agent.network(
          [
            { role: 'user', content: 'What is the weather?' },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_1',
                  toolName: 'weather-tool',
                  args: { location: 'San Francisco' },
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call_1',
                  toolName: 'weather-tool',
                  result: 'Sunny, 72°F',
                },
              ],
            },
            { role: 'user', content: 'Is that good weather for a picnic?' },
          ],
          {
            requestContext,
            maxSteps: 1,
          },
        );

        const chunks: ChunkType[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        expect(chunks).toBeDefined();
        expect(chunks.length).toBeGreaterThan(1);
      },
    );

    it('should handle conversation ending with tool result in network (agentic loop pattern)', async () => {
      const testTool = createTool({
        id: 'weather-tool',
        description: 'Gets weather information',
        inputSchema: z.object({ location: z.string() }),
        outputSchema: z.object({ weather: z.string() }),
        execute: async () => ({ weather: 'Sunny, 72°F' }),
      });

      const agent = new Agent({
        id: 'network-agentic-tool-result-agent',
        name: 'Network Agentic Tool Result Agent',
        instructions: 'You help with weather queries. Summarize weather results.',
        model: MODEL,
        tools: { testTool },
        memory,
      });

      const stream = await agent.network(
        [
          { role: 'user', content: 'What is the weather?' },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_1',
                toolName: 'weather-tool',
                args: { location: 'San Francisco' },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_1',
                toolName: 'weather-tool',
                result: 'Sunny, 72°F',
              },
            ],
          },
        ],
        {
          requestContext,
          maxSteps: 1,
        },
      );

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
    }, 30_000);

    it('should handle messages starting with assistant-with-tool-call in network', async () => {
      const testTool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async () => ({ result: 'test result' }),
      });

      const agent = new Agent({
        id: 'network-tool-call-agent',
        name: 'Network Tool Call Agent',
        instructions: 'You help users understand tool results. Explain tool outputs clearly.',
        model: MODEL,
        tools: { testTool },
        memory,
      });

      const stream = await agent.network(
        [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_1',
                toolName: 'test-tool',
                args: { query: 'test' },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_1',
                toolName: 'test-tool',
                result: 'previous result',
              },
            ],
          },
          { role: 'user', content: 'Explain what this result means.' },
        ],
        {
          requestContext,
          maxSteps: 1,
        },
      );

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
    }, 30_000);

    it('should handle simple conversation ending with assistant in network', async () => {
      const agent = new Agent({
        id: 'network-simple-ending-agent',
        name: 'Network Simple Ending Agent',
        instructions: 'You help users with their queries',
        model: MODEL,
        memory,
      });

      const stream = await agent.network(
        [
          { role: 'user', content: 'Hello, how are you?' },
          { role: 'assistant', content: 'I am doing well, thank you!' },
        ],
        {
          requestContext,
          maxSteps: 1,
        },
      );

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
    }, 30_000);

    it('should handle messages with only assistant role in network', async () => {
      const helperAgent = new Agent({
        id: 'helper-agent',
        name: 'Helper Agent',
        instructions: 'You help with tasks',
        model: MODEL,
      });

      const agent = new Agent({
        id: 'network-assistant-only-agent',
        name: 'Network Assistant Only Agent',
        instructions: 'You coordinate tasks',
        model: MODEL,
        agents: { helperAgent },
        memory,
      });

      const stream = await agent.network([{ role: 'assistant', content: 'This is a system message' }], {
        requestContext,
        maxSteps: 1,
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
    }, 30_000);
  });

  describe('Gemini 3 Pro with tool calls', () => {
    // TODO: gemini-3-pro-preview streaming endpoint hangs (>120s), needs investigation
    it.skip(
      'should preserve thought_signature metadata through tool call round-trip',
      { retry: 2, timeout: 120_000 },
      async () => {
        const weatherTool = createTool({
          id: 'get-weather',
          description: 'Gets the current weather for a location',
          inputSchema: z.object({
            location: z.string().describe('The city and state, e.g. San Francisco, CA'),
          }),
          outputSchema: z.object({
            temperature: z.number(),
            conditions: z.string(),
          }),
          execute: async () => {
            return {
              temperature: 72,
              conditions: 'Sunny',
            };
          },
        });

        const agent = new Agent({
          id: 'weather-gemini3-agent',
          name: 'Weather Gemini3 Agent',
          instructions: 'You are a helpful weather assistant. Use the get-weather tool to answer weather questions.',
          model: GEMINI_3_PRO,
          tools: { weatherTool },
          memory,
        });

        // This should trigger a tool call, then process the result
        const stream = await agent.stream('What is the weather in San Francisco?', {
          maxSteps: 5,
          memory: {
            thread: 'tool-calls',
            resource: 'gemini-3',
          },
        });

        const result = await stream.getFullOutput();
        expect(result).toBeDefined();
        expect(result.request.body).toContain(`thoughtSignature`);
        expect(result.text).toBeDefined();
        expect(result.text.length).toBeGreaterThan(0);
        expect(result.error).toBeUndefined();

        const stream2 = await agent.stream('Whats the weather there now?', {
          memory: {
            thread: 'tool-calls',
            resource: 'gemini-3',
          },
        });
        const result2 = await stream2.getFullOutput();
        expect(result2).toBeDefined();
        expect(result2.request.body).toContain(`thoughtSignature`);
        expect(result2.text).toBeDefined();
        expect(result2.text.length).toBeGreaterThan(0);
        expect(result2.error).toBeUndefined();
      },
    );

    it('should handle multi-step tool calls with gemini 3 pro', { retry: 5, timeout: 120_000 }, async () => {
      const weatherTool = createTool({
        id: 'get-weather-multi',
        description: 'Gets the current weather for a location',
        inputSchema: z.object({
          location: z.string().describe('The city and state, e.g. San Francisco, CA'),
        }),
        outputSchema: z.object({
          temperature: z.number(),
          conditions: z.string(),
        }),
        execute: async () => {
          return {
            temperature: 72,
            conditions: 'Sunny',
          };
        },
      });

      const agent = new Agent({
        id: 'weather-multi-gemini3-agent',
        name: 'Weather Multi Gemini3 Agent',
        instructions:
          'You are a helpful weather assistant. Use the get-weather-multi tool to answer weather questions.',
        model: GEMINI_3_PRO,
        tools: { weatherTool },
        memory,
      });

      // This should trigger a tool call, then process the result
      const result = await agent.generate('What is the weather in San Francisco and New York?', {
        maxSteps: 5,
      });

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });
  });
});

import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable/create-durable-agent';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import type { MastraDBMessage } from '../../memory/types';
import { InMemoryStore } from '../../storage';
import { createStep, createWorkflow } from '../../workflows';
import { ProcessorStepInputSchema, ProcessorStepOutputSchema } from '../step-schema';

import { TokenLimiterProcessor } from './token-limiter';
import { ToolCallFilter } from './tool-call-filter';

const ANSWER = 'You have 400 rules.';
const TOOL_PAYLOAD = 'Registered guests only. ';

// Regression for #24111: the assistant answer shares a stored message with a large
// tool result that ToolCallFilter removes from the prompt.
const issueHistory = (): MastraDBMessage[] => [
  {
    id: 'history-user',
    role: 'user',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    content: { format: 2, parts: [{ type: 'text', text: 'What are the house rules?' }] },
  },
  {
    id: 'history-assistant',
    role: 'assistant',
    createdAt: new Date('2024-01-01T00:01:00Z'),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'call-rules',
            toolName: 'listRules',
            args: {},
            result: TOOL_PAYLOAD.repeat(2500),
          },
        },
        { type: 'text', text: ANSWER },
      ],
    },
  },
  {
    id: 'current-user',
    role: 'user',
    createdAt: new Date('2024-01-01T00:02:00Z'),
    content: { format: 2, parts: [{ type: 'text', text: 'How many rules are there?' }] },
  },
];

const longHistory = (): MastraDBMessage[] =>
  Array.from({ length: 40 }, (_, i) => ({
    id: `message-${i}`,
    role: i % 2 ? ('assistant' as const) : ('user' as const),
    createdAt: new Date(Date.UTC(2024, 0, 1, 0, i)),
    content: {
      format: 2 as const,
      parts: [{ type: 'text' as const, text: `message ${i} ` + 'lorem ipsum dolor sit amet '.repeat(20) }],
    },
  }));

const LONG_HISTORY_LENGTH = 40;

function createV2Model() {
  const prompts: LanguageModelV2Prompt[] = [];
  const model = new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        content: [{ type: 'text', text: 'ok' }],
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'response-1', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'ok' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
  return { model, prompts };
}

const nonSystemCount = (prompt: LanguageModelV2Prompt | undefined) =>
  prompt?.filter(message => message.role !== 'system').length ?? 0;

describe('TokenLimiterProcessor through an agent', () => {
  describe('prompt-stage budgeting after ToolCallFilter (#24111)', () => {
    it('keeps the assistant answer in generate()', async () => {
      const { model, prompts } = createV2Model();
      const agent = new Agent({
        id: 'limiter-generate',
        name: 'limiter-generate',
        instructions: 'Answer briefly.',
        model,
        inputProcessors: [new ToolCallFilter({ exclude: ['listRules'] }), new TokenLimiterProcessor(8000)],
      });

      await agent.generate(issueHistory());

      const prompt = JSON.stringify(prompts.at(-1));
      expect(prompt).toContain(ANSWER);
      expect(prompt).not.toContain(TOOL_PAYLOAD);
    });

    it('keeps the assistant answer in stream()', async () => {
      const { model, prompts } = createV2Model();
      const agent = new Agent({
        id: 'limiter-stream',
        name: 'limiter-stream',
        instructions: 'Answer briefly.',
        model,
        inputProcessors: [new ToolCallFilter({ exclude: ['listRules'] }), new TokenLimiterProcessor(8000)],
      });

      const result = await agent.stream(issueHistory());
      await result.consumeStream();

      const prompt = JSON.stringify(prompts.at(-1));
      expect(prompt).toContain(ANSWER);
      expect(prompt).not.toContain(TOOL_PAYLOAD);
    });

    it('keeps the assistant answer in a durable agent stream()', async () => {
      const { model, prompts } = createV2Model();
      const agent = new Agent({
        id: 'limiter-durable',
        name: 'limiter-durable',
        instructions: 'Answer briefly.',
        model,
        inputProcessors: [new ToolCallFilter({ exclude: ['listRules'] }), new TokenLimiterProcessor(8000)],
      });
      void new Mastra({ agents: { 'limiter-durable': agent }, storage: new InMemoryStore() });
      const pubsub = new EventEmitterPubSub();

      try {
        const durableAgent = createDurableAgent({ agent, pubsub });
        const result = await durableAgent.stream(issueHistory(), { maxSteps: 1 });
        for await (const _chunk of result.fullStream) {
          // drain
        }
      } finally {
        await pubsub.close();
      }

      const prompt = JSON.stringify(prompts.at(-1));
      expect(prompt).toContain(ANSWER);
      expect(prompt).not.toContain(TOOL_PAYLOAD);
    });

    it('keeps the assistant answer when input processors are resolved per request', async () => {
      const { model, prompts } = createV2Model();
      const agent = new Agent({
        id: 'limiter-dynamic',
        name: 'limiter-dynamic',
        instructions: 'Answer briefly.',
        model,
        inputProcessors: () => [new ToolCallFilter({ exclude: ['listRules'] }), new TokenLimiterProcessor(8000)],
      });

      await agent.generate(issueHistory());

      const prompt = JSON.stringify(prompts.at(-1));
      expect(prompt).toContain(ANSWER);
      expect(prompt).not.toContain(TOOL_PAYLOAD);
    });
  });

  describe('over-budget history', () => {
    it('trims the prompt in generate()', async () => {
      const { model, prompts } = createV2Model();
      const agent = new Agent({
        id: 'limiter-over-budget',
        name: 'limiter-over-budget',
        instructions: 'Answer briefly.',
        model,
        inputProcessors: [new TokenLimiterProcessor(500)],
      });

      await agent.generate(longHistory());

      const count = nonSystemCount(prompts.at(-1));
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(LONG_HISTORY_LENGTH);
    });

    it('trims the prompt in generateLegacy()', async () => {
      const prompts: unknown[][] = [];
      const model = new MockLanguageModelV1({
        doGenerate: async ({ prompt }) => {
          prompts.push(prompt);
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          };
        },
      });
      const agent = new Agent({
        id: 'limiter-legacy',
        name: 'limiter-legacy',
        instructions: 'Answer briefly.',
        model,
        inputProcessors: [new TokenLimiterProcessor(500)],
      });

      await agent.generateLegacy(longHistory());

      const prompt = prompts.at(-1) as Array<{ role: string }> | undefined;
      const count = prompt?.filter(message => message.role !== 'system').length ?? 0;
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(LONG_HISTORY_LENGTH);
    });

    it('trims the prompt when the limiter is nested in a processor workflow', async () => {
      const { model, prompts } = createV2Model();
      const workflow = createWorkflow({
        id: 'limiter-workflow',
        inputSchema: ProcessorStepInputSchema,
        outputSchema: ProcessorStepOutputSchema,
      })
        .then(createStep(new TokenLimiterProcessor(500)))
        .commit();
      const agent = new Agent({
        id: 'limiter-nested',
        name: 'limiter-nested',
        instructions: 'Answer briefly.',
        model,
        inputProcessors: [workflow],
      });

      await agent.generate(longHistory());

      const count = nonSystemCount(prompts.at(-1));
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(LONG_HISTORY_LENGTH);
    });
  });
});

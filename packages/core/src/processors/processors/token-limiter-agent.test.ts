import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable/create-durable-agent';
import { MessageList } from '../../agent/message-list';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { carryCappedProviderMetadata } from '../../loop/shared/read-tool-result';
import {
  commitToolResult,
  computeModelOutputProviderMetadata,
  shouldComputeModelOutputProviderMetadata,
} from '../../loop/shared/steps/tool-result-commit-core';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { MastraDBMessage } from '../../memory/types';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
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

    it('does not persist the cap into stored history for durable agents (#24110)', async () => {
      const big = 'result '.repeat(3000);
      const lookup = createTool({
        id: 'lookup',
        description: 'Look something up',
        inputSchema: z.object({ q: z.string() }),
        execute: async () => big,
      });
      const prompts: LanguageModelV2Prompt[] = [];
      const hasToolResult = (prompt: LanguageModelV2Prompt) =>
        (prompt as any[])
          .flatMap(m => (Array.isArray(m.content) ? m.content : []))
          .some((c: any) => c.type === 'tool-result');
      const model = new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          prompts.push(prompt);
          const chunks: any[] = hasToolResult(prompt)
            ? [
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'ok' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
              ]
            : [
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{"q":"x"}' },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ];
          return {
            stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...chunks]),
            rawCall: { rawPrompt: [], rawSettings: {} },
            warnings: [],
          };
        },
      });
      const limiter = new TokenLimiterProcessor({ limit: 50000, maxToolResultTokens: 50 });
      const mockMemory = new MockMemory();
      const agent = new Agent({
        id: 'limiter-durable-persist',
        name: 'limiter-durable-persist',
        instructions: 'Answer briefly.',
        model,
        tools: { lookup },
        memory: mockMemory,
        inputProcessors: [limiter],
        outputProcessors: [limiter],
      });
      void new Mastra({ agents: { 'limiter-durable-persist': agent }, storage: new InMemoryStore() });
      const pubsub = new EventEmitterPubSub();
      const threadId = 'thread-cap-persist';
      const resourceId = 'resource-cap-persist';

      try {
        const durableAgent = createDurableAgent({ agent, pubsub });

        const turn1 = await durableAgent.stream('question', {
          maxSteps: 2,
          memory: { thread: threadId, resource: resourceId },
        });
        for await (const _chunk of turn1.fullStream) {
          // drain
        }

        const turn1Prompt = JSON.stringify(prompts.at(-1));
        expect(turn1Prompt).toMatch(/\[truncated: showing/);

        const turn2 = await durableAgent.stream('second question', {
          maxSteps: 1,
          memory: { thread: threadId, resource: resourceId },
        });
        for await (const _chunk of turn2.fullStream) {
          // drain
        }

        const turn2Prompt = JSON.stringify(prompts.at(-1));
        expect(turn2Prompt).not.toMatch(/\[truncated: showing/);
        expect(turn2Prompt.length).toBeGreaterThan(JSON.stringify(big).length);
      } finally {
        await pubsub.close();
      }

      const { messages } = await mockMemory.recall({ threadId, resourceId });
      const toolPart = messages
        .flatMap(message => message.content.parts ?? [])
        .find(part => part.type === 'tool-invocation');
      const storedMastra = toolPart?.providerMetadata?.mastra as Record<string, unknown> | undefined;
      expect(storedMastra?.modelOutput).toBeUndefined();
      expect(storedMastra?.modelOutputCapped).toBeUndefined();
    });

    it('threads the modelOutput cap from tool-call.ts to llm-mapping.ts across the durable step boundary (#24110)', async () => {
      const big = 'result '.repeat(3000);
      const pendingCall = (): MastraDBMessage => ({
        id: 'msg-call-1',
        role: 'assistant',
        content: {
          format: 2,
          content: '',
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'lookup', args: {} },
            },
          ],
        },
        createdAt: new Date('2024-01-01T00:00:00Z'),
      });

      // Step 1: the tool-call step's local MessageList runs the cap processor, same as
      // TokenLimiterProcessor.processToolResult does inside tool-call.ts's hook.
      const processor = new TokenLimiterProcessor({ limit: 50_000, maxToolResultTokens: 50 });
      const toolCallMessageList = new MessageList();
      toolCallMessageList.add(pendingCall(), 'response');
      await processor.processToolResult({
        result: big,
        toolCallId: 'call-1',
        toolName: 'lookup',
        args: {},
        messageList: toolCallMessageList,
        steps: [],
        systemMessages: [],
        state: {},
      } as any);

      // Drives the exact function tool-call.ts calls to carry the cap onto its step
      // output (see tool-call.ts's `carried = carryCappedProviderMetadata(...)` call).
      const carried = carryCappedProviderMetadata(toolCallMessageList, 'call-1', undefined);
      expect(carried.resultCapped).toBe(true);

      // Step 2: the tool-call step's output crosses to llm-mapping.ts as JSON (the real
      // engine round-trips it through pubsub/storage). JSON.parse/stringify severs any
      // shared object references, so unlike the deleted end-to-end test this actually
      // forces the step-boundary path instead of surviving on live object identity.
      const toolCallStepOutput = JSON.parse(
        JSON.stringify({
          toolCallId: 'call-1',
          toolName: 'lookup',
          result: big,
          resultCapped: carried.resultCapped,
          providerMetadata: carried.providerMetadata,
        }),
      );

      // A tool with a `toModelOutput` mapper: if llm-mapping.ts's `resultCapped` guard is
      // ever dropped, this recomputes and clobbers the carried cap, making the assertions
      // below fail.
      const mappedTool = { toModelOutput: () => 'SHOULD-NOT-BE-SEEN-WHEN-CAP-IS-CARRIED' };

      // Drives the exact guard llm-mapping.ts calls (see llm-mapping.ts's
      // `if (shouldComputeModelOutputProviderMetadata(toolResult))` check): a
      // `resultCapped` result is not recomputed through `toModelOutput`, the carried
      // metadata is used as-is.
      const providerMetadata = shouldComputeModelOutputProviderMetadata(toolCallStepOutput)
        ? await computeModelOutputProviderMetadata({
            tool: mappedTool,
            toolName: toolCallStepOutput.toolName,
            toolCallId: toolCallStepOutput.toolCallId,
            result: toolCallStepOutput.result,
            existingProviderMetadata: toolCallStepOutput.providerMetadata,
          })
        : toolCallStepOutput.providerMetadata;

      // Step 3: llm-mapping.ts commits against a freshly rebuilt MessageList, not the
      // tool-call step's local copy.
      const llmMappingMessageList = new MessageList();
      llmMappingMessageList.add(pendingCall(), 'response');

      commitToolResult({
        messageList: llmMappingMessageList,
        outcome: { kind: 'result', result: toolCallStepOutput.result },
        toolCallId: toolCallStepOutput.toolCallId,
        toolName: toolCallStepOutput.toolName,
        toolArgs: {},
        providerMetadata: providerMetadata as any,
      });

      const committedPart = llmMappingMessageList.get.all
        .db()
        .flatMap(message => message.content.parts ?? [])
        .find(part => part.type === 'tool-invocation' && part.toolInvocation?.toolCallId === 'call-1') as any;
      const committedMastra = committedPart?.providerMetadata?.mastra;
      expect(committedMastra?.modelOutputCapped).toBe(true);
      expect(committedMastra?.modelOutput?.value).toMatch(/\[truncated: showing \d+ of [\d,]+ tokens\]$/);
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

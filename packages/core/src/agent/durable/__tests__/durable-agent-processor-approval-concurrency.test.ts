/**
 * Issue #24377: the durable tool-call concurrency gate only inspected the
 * run-level `toolsMetadata` (serialized once from the agent's static tools).
 * A `requireApproval` tool injected per step by an input processor was
 * invisible to it, so two same-turn calls fanned out in parallel and both
 * suspended for approval.
 *
 * The LLM step now stamps `requireApproval` / `hasSuspendSchema` on each tool
 * call from the step's effective tools, and the gate serializes stamped batches.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import type { ProcessInputStepArgs, Processor } from '../../../processors';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

const resolvedConcurrency = vi.hoisted(() => [] as Array<{ toolNames: string[]; value: number }>);

vi.mock('../workflows/shared/tool-call-concurrency', async importOriginal => {
  const actual = await importOriginal<typeof import('../workflows/shared/tool-call-concurrency')>();
  return {
    ...actual,
    resolveDurableToolCallConcurrency: (args: Parameters<typeof actual.resolveDurableToolCallConcurrency>[0]) => {
      const value = actual.resolveDurableToolCallConcurrency(args);
      resolvedConcurrency.push({ toolNames: (args.toolCalls ?? []).map(tc => tc.toolName!), value });
      return value;
    },
  };
});

function createTwoCallModel() {
  let turn = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      turn++;
      if (turn === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            ...['a', 'b'].map(id => ({
              type: 'tool-call' as const,
              toolCallId: `tc-${id}`,
              toolName: 'gatedAction',
              input: JSON.stringify({ id }),
            })),
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `resp-${turn}`, modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Done.' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

class InjectGatedToolProcessor implements Processor {
  readonly id = 'inject-gated-tool';

  processInputStep({ tools }: ProcessInputStepArgs) {
    return {
      tools: {
        ...tools,
        gatedAction: createTool({
          id: 'gatedAction',
          description: 'An action that needs approval',
          inputSchema: z.object({ id: z.string() }),
          requireApproval: true,
          execute: async ({ id }) => ({ done: id }),
        }),
      },
    };
  }
}

describe('DurableAgent concurrency gate with processor-injected approval tools (#24377)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
    resolvedConcurrency.length = 0;
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('serializes same-turn calls to a requireApproval tool absent from the static tool set', async () => {
    const agent = new Agent({
      id: 'processor-approval',
      name: 'processor-approval',
      instructions: 'Use gatedAction.',
      model: createTwoCallModel() as LanguageModelV2,
      tools: {
        unrelated: createTool({
          id: 'unrelated',
          description: 'unrelated',
          inputSchema: z.object({}),
          execute: async () => ({}),
        }),
      },
      inputProcessors: [new InjectGatedToolProcessor()],
    });
    const durableAgent = createDurableAgent({ agent, pubsub });
    new Mastra({
      agents: { 'processor-approval': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('Do both actions', { maxSteps: 3 });
    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
      if (chunk.type === 'tool-call-approval') break;
    }

    expect(chunks.filter(c => c.type === 'tool-call-approval')).toHaveLength(1);
    const gate = resolvedConcurrency.find(r => r.toolNames.includes('gatedAction'));
    expect(gate).toEqual({ toolNames: ['gatedAction', 'gatedAction'], value: 1 });
  });
});

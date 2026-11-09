import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { waitForCondition } from './signals-test-utils';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const thread = { resourceId: 'busy-user', threadId: 'busy-thread' };

function scriptedStream(parts: any[]) {
  return {
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'stream-start', warnings: [] });
        for (const part of parts) controller.enqueue(part);
        controller.close();
      },
    }),
  };
}

/**
 * An agent whose first step calls a tool and whose second step blocks until released, so a test can send a
 * signal while the turn is still running. Records every prompt the model receives.
 */
function createBusyAgent() {
  const prompts: string[] = [];
  let releaseSecondStep!: () => void;
  const secondStepGate = new Promise<void>(resolve => (releaseSecondStep = resolve));

  const nextStep = async (prompt: unknown) => {
    const call = prompts.push(JSON.stringify(prompt));
    if (call === 1) return { toolCall: true, call };
    if (call === 2) await secondStepGate;
    return { toolCall: false, call };
  };

  const model = new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      const step = await nextStep(prompt);
      return {
        content: step.toolCall
          ? [{ type: 'tool-call' as const, toolCallId: 'c1', toolName: 'work', input: '{}' }]
          : [{ type: 'text' as const, text: `reply ${step.call}` }],
        finishReason: step.toolCall ? ('tool-calls' as const) : ('stop' as const),
        usage,
        warnings: [],
      };
    },
    doStream: async ({ prompt }) => {
      const step = await nextStep(prompt);
      if (step.toolCall) {
        return scriptedStream([
          { type: 'tool-call', toolCallId: 'c1', toolName: 'work', input: '{}' },
          { type: 'finish', finishReason: 'tool-calls', usage },
        ]);
      }
      return scriptedStream([
        { type: 'text-start', id: `t${step.call}` },
        { type: 'text-delta', id: `t${step.call}`, delta: `reply ${step.call}` },
        { type: 'text-end', id: `t${step.call}` },
        { type: 'finish', finishReason: 'stop', usage },
      ]);
    },
  });

  const work = createTool({
    id: 'work',
    description: 'work',
    inputSchema: z.object({}),
    execute: async () => ({ done: true }),
  });
  const agent = new Agent({
    id: 'busy-thread-agent',
    name: 'Busy Thread Agent',
    instructions: 'Test',
    model,
    memory: new MockMemory(),
    tools: { work },
  });
  new Mastra({ agents: { busyThreadAgent: agent }, logger: false });

  return { agent, prompts, releaseSecondStep };
}

describe('Agent signals: a signal sent to a thread whose turn is running', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  for (const method of ['generate', 'stream'] as const) {
    it(`joins a running ${method}() turn instead of starting a second run that cannot see it`, async () => {
      const { agent, prompts, releaseSecondStep } = createBusyAgent();
      const memory = { resource: thread.resourceId, thread: thread.threadId };

      let turn: Promise<unknown>;
      if (method === 'generate') {
        turn = agent.generate('MARKER-USER order 123', { memory, maxSteps: 3 });
      } else {
        const output = await agent.stream('MARKER-USER order 123', { memory, maxSteps: 3 });
        turn = output.consumeStream();
      }

      // The first step has finished and the second one is in flight.
      await waitForCondition(() => prompts.length >= 2, 2000);

      const result = agent.sendSignal(
        { type: 'user-message', contents: 'MARKER-SIGNAL' },
        { ...thread, ifActive: { behavior: 'deliver' }, ifIdle: { behavior: 'wake' } },
      );
      const accepted = await result.accepted;

      // The signal was handed to the running turn, not woken into a new run.
      expect(accepted.action).toBe('deliver');

      releaseSecondStep();
      await turn;
      await new Promise(resolve => setTimeout(resolve, 100));

      // Every model call sees the original user turn, so no second run started without it,
      // and the signal reached the model.
      expect(prompts.filter(prompt => !prompt.includes('MARKER-USER'))).toEqual([]);
      expect(prompts.some(prompt => prompt.includes('MARKER-SIGNAL'))).toBe(true);
    });
  }
});

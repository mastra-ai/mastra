import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import type { Processor } from '../processors';
import { InMemoryStore } from '../storage/mock';
import { createTool } from '../tools';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

/** Calls a tool on its first step, then answers, so one run makes two model calls. */
function makeToolCallingModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(
          calls === 1
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{}' },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 'text' },
                { type: 'text-delta', id: 'text', delta: 'ok' },
                { type: 'text-end', id: 'text' },
                { type: 'finish', finishReason: 'stop', usage },
              ],
        ),
      };
    },
  });
}

const lookupTool = createTool({
  id: 'lookup',
  description: 'Look something up',
  inputSchema: z.object({}),
  execute: async () => ({ found: true }),
});

function abortAtStep(minStep: number): Processor {
  return {
    id: 'step-guard',
    processInputStep: async ({ stepNumber, abort }) => {
      if (stepNumber >= minStep) abort('database is locked');
      return {};
    },
  };
}

async function createSession(processor: Processor) {
  const agent = new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: makeToolCallingModel(),
    tools: { lookup: lookupTool },
    inputProcessors: [processor],
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
  await controller.init();
  const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  await session.permissions.setForTool({ toolName: 'lookup', policy: 'allow' });
  return session;
}

const TIMED_OUT = Symbol('timed out');

function settleWithin<T>(promise: Promise<T>, ms = 5_000): Promise<T | typeof TIMED_OUT> {
  return Promise.race([promise, new Promise<typeof TIMED_OUT>(resolve => setTimeout(() => resolve(TIMED_OUT), ms))]);
}

describe('AgentController processor tripwire', () => {
  it.each([
    ['after a finished tool-call step', 1],
    ['on the first step', 0],
  ])('ends the run and surfaces the reason when an input processor trips %s', async (_label, minStep) => {
    const session = await createSession(abortAtStep(minStep));
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    expect(await settleWithin(session.sendMessage({ content: 'hello' }))).not.toBe(TIMED_OUT);

    const errorEvent = events.find((e): e is Extract<AgentControllerEvent, { type: 'error' }> => e.type === 'error');
    expect(errorEvent?.error.message).toContain('database is locked');
    expect(events.filter(e => e.type === 'agent_end').map(e => (e as { reason?: string }).reason)).toEqual(['error']);
    expect(session.run.isRunning()).toBe(false);
  });
});

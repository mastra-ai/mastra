/**
 * A run stopped by a person ends with `agent_end` saying so, so a host can tell
 * a deliberate Stop from an incidental abort (a server restart, a lost thread
 * lease, a failed run) instead of showing a bare "aborted".
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../agent/thread-stream-runtime';
import { InMemoryStore } from '../storage/mock';
import { createTool } from '../tools';
import { AgentController } from './agent-controller';
import { USER_STOP_ABORT_REASON } from './session';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

vi.setConfig({ testTimeout: 30_000 });

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

/** A session whose model keeps requesting a slow tool, so a run stays live. */
async function createTickingSession() {
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: `r${calls}`, modelId: 'mock', timestamp: new Date(0) },
          { type: 'tool-call' as const, toolCallId: `call-${calls}`, toolName: 'tick', input: '{}' },
          { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
        ]),
      };
    },
  });
  const ticks = { count: 0 };
  const tick = createTool({
    id: 'tick',
    description: 'Tick once',
    inputSchema: z.object({}),
    execute: async () => {
      ticks.count++;
      await new Promise(resolve => setTimeout(resolve, 20));
      return 'ticked';
    },
  });
  const agent = new Agent({
    id: 'stop-reason-agent',
    name: 'stop-reason-agent',
    instructions: 'tick',
    model,
    tools: { tick },
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'stop-reason-controller',
    storage: new InMemoryStore(),
    initialState: { yolo: true } as any,
    modes: [{ id: 'default', name: 'Default', default: true, agent, defaultModelId: 'mock-model' }],
  });
  await controller.init();
  const session = await controller.createSession({
    id: 'stop-reason-session',
    ownerId: 'owner',
    resourceId: 'stop-reason-user',
    threadId: 'stop-reason-thread',
  });
  return { session, ticks };
}

/** Start a run and wait until it is provably in flight. */
async function startRun(
  session: Awaited<ReturnType<typeof createTickingSession>>['session'],
  ticks: { count: number },
) {
  const before = ticks.count;
  void session.sendMessage({ content: 'keep ticking' }).catch(() => {});
  await vi.waitFor(() => expect(ticks.count).toBeGreaterThanOrEqual(before + 2), { timeout: 10_000 });
}

/** Await the terminal event for the current run. */
async function waitForAgentEnd(events: AgentControllerEvent[]) {
  await vi.waitFor(() => expect(events.some(event => event.type === 'agent_end')).toBe(true), { timeout: 10_000 });
  return events.filter(event => event.type === 'agent_end');
}

afterEach(() => {
  agentThreadStreamRuntime.resetForTests();
});

describe('a run stopped by a person', () => {
  it('ends with agent_end saying a person stopped it', async () => {
    const { session, ticks } = await createTickingSession();
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    await startRun(session, ticks);
    session.abort({ reason: USER_STOP_ABORT_REASON });

    expect(await waitForAgentEnd(events)).toEqual([
      { type: 'agent_end', reason: 'aborted', abortReason: USER_STOP_ABORT_REASON },
    ]);
  });

  it('leaves an abort with no stated reason unreported', async () => {
    const { session, ticks } = await createTickingSession();
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    await startRun(session, ticks);
    session.abort();

    expect(await waitForAgentEnd(events)).toEqual([{ type: 'agent_end', reason: 'aborted' }]);
  });

  it('does not carry a stop reason onto a later, unrelated abort', async () => {
    const { session, ticks } = await createTickingSession();
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    await startRun(session, ticks);
    session.abort({ reason: USER_STOP_ABORT_REASON });
    expect(await waitForAgentEnd(events)).toEqual([
      { type: 'agent_end', reason: 'aborted', abortReason: USER_STOP_ABORT_REASON },
    ]);

    // A fresh run aborted without a stated reason must not inherit the stop.
    events.length = 0;
    await startRun(session, ticks);
    session.abort();

    expect(await waitForAgentEnd(events)).toEqual([{ type: 'agent_end', reason: 'aborted' }]);
  });
});

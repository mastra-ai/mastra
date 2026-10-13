/**
 * Regression test for #26871 — a tool call that parks after its run was
 * aborted must still be resumable through the live Session subscription.
 *
 * The subscription consumer ignores trailing chunks of an aborted run by its
 * run id. A suspended tool call resumed through `respondToToolSuspension`
 * continues under that same run id, so before the fix every chunk of the
 * resumed run was dropped: no `agent_start`/`agent_end` reached the session,
 * `respondToToolSuspension()` never resolved and `run.isRunning()` stayed true.
 */
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { askUserTool } from '../../tools/builtin/ask-user';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

vi.setConfig({ testTimeout: 30_000 });

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

/** One model step that calls a slow tool and `ask_user` together. */
function slowToolAndAskUserStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-slow',
        toolName: 'slowTool',
        input: '{}',
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-ask',
        toolName: 'ask_user',
        input: JSON.stringify({ question: 'Your name?' }),
        providerExecuted: false,
      });
      controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage });
      controller.close();
    },
  });
}

function textStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Thanks, Ada.' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
      controller.close();
    },
  });
}

async function createHarness(id: string) {
  let releaseSlowTool!: () => void;
  const slowToolGate = new Promise<void>(resolve => {
    releaseSlowTool = resolve;
  });
  let signalSlowToolStarted!: () => void;
  const slowToolStarted = new Promise<void>(resolve => {
    signalSlowToolStarted = resolve;
  });

  const slowTool = createTool({
    id: 'slow-tool',
    description: 'A tool that takes a while.',
    inputSchema: z.object({}),
    execute: async () => {
      signalSlowToolStarted();
      await slowToolGate;
      return { ok: true };
    },
  });

  let callCount = 0;
  const agent = new Agent({
    id: `${id}-agent`,
    name: `${id} agent`,
    instructions: 'You ask the user questions.',
    model: new MastraLanguageModelV2Mock({
      doStream: async () => {
        callCount++;
        return { stream: callCount === 1 ? slowToolAndAskUserStream() : textStream() };
      },
    }),
    tools: { slowTool, ask_user: askUserTool },
  });

  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { [`${id}-agent`]: agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent(`${id}-agent`);

  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: `${id}-controller`,
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
    initialState: { yolo: true } as any,
  });
  await controller.init();
  const session = await controller.createSession({ id: `${id}-session`, ownerId: 'owner-1' });
  await session.thread.create();

  const events: AgentControllerEvent[] = [];
  session.subscribe((event: AgentControllerEvent) => {
    events.push(event);
  });

  return { session, agent: registeredAgent, events, releaseSlowTool, slowToolStarted, getCallCount: () => callCount };
}

/** Resolves to `'timeout'` when `promise` does not settle within `ms`. */
function settleWithin<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<'timeout'>(resolve => {
      timeout = setTimeout(() => resolve('timeout'), ms);
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

describe('resuming a tool call that parked after its run was aborted (#26871)', () => {
  it('Given a run aborted while a sibling tool call still parks, When the parked call is answered, Then the resumed run reaches the session and settles', async () => {
    const { session, agent, events, releaseSlowTool, slowToolStarted, getCallCount } =
      await createHarness('abort-then-resume');

    void session.sendMessage({ content: 'Ask my name' }).catch(() => {});
    await slowToolStarted;

    // Stop while the slow tool runs; `ask_user` parks after the abort.
    session.abort();
    releaseSlowTool();
    await vi.waitFor(() => expect(events).toContainEqual({ type: 'agent_end', reason: 'aborted' }));
    let runId: string | undefined;
    await vi.waitFor(async () => {
      const { runs } = await agent.listSuspendedRuns({});
      runId = runs.find(run => run.toolCalls.some(toolCall => toolCall.toolCallId === 'call-ask'))?.runId;
      expect(runId).toBeDefined();
    });

    // The prompt parked after the abort, so the host registers it from
    // `listSuspendedRuns()`, as it would after a reload.
    session.suspensions.register({
      toolCallId: 'call-ask',
      runId: runId!,
      toolName: 'ask_user',
      threadId: session.thread.requireId(),
      resourceId: session.identity.getResourceId(),
    });
    events.length = 0;

    const answered = await settleWithin(
      session.respondToToolSuspension({ toolCallId: 'call-ask', resumeData: 'Ada' }).then(() => 'answered' as const),
      5_000,
    );

    expect(answered).toBe('answered');
    expect(getCallCount()).toBe(2);
    expect(events.filter(event => event.type === 'agent_start')).toHaveLength(1);
    expect(events.filter(event => event.type === 'agent_end')).toEqual([{ type: 'agent_end', reason: 'complete' }]);
    expect(events.filter(event => event.type === 'error')).toEqual([]);
    expect(session.run.isRunning()).toBe(false);
  });
});

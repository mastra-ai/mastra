/**
 * Repro for the "sendStreamResume() could not find a suspended run" failure
 * reported when answering an ask_user question.
 *
 * Models the real-world failure: persisting the suspended workflow snapshot
 * throws (`RangeError: Invalid string length` from serializing an oversized
 * snapshot). The TUI has already rendered the question from the
 * `tool_suspended` event, so the user answers — but the run never reached a
 * valid persisted suspended state, so the resume lookup fails.
 */
import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { askUserTool } from '../../tools/builtin/ask-user';

import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

vi.setConfig({ testTimeout: 30_000 });

function createAskUserToolCallStream(input: string, toolCallId = 'call-1') {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({
        type: 'tool-call',
        toolCallId,
        toolName: 'ask_user',
        input,
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function createTextStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Thanks!' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

async function buildController(id: string) {
  const agent = new Agent({
    id: `agent-${id}`,
    name: `Agent ${id}`,
    instructions: 'You ask the user questions.',
    model: new MastraLanguageModelV2Mock({
      doStream: (() => {
        let callCount = 0;
        return async () => {
          callCount++;
          return {
            stream:
              callCount === 1
                ? createAskUserToolCallStream(JSON.stringify({ question: 'Your name?' }))
                : createTextStream(),
          };
        };
      })(),
    }),
    tools: { ask_user: askUserTool },
  });

  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { [`agent-${id}`]: agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent(`agent-${id}`);

  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: `controller-${id}`,
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
    initialState: { yolo: true } as any,
  });

  await controller.init();
  const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  await session.thread.create();
  return { controller, session, storage };
}

describe('AgentController: ask_user with suspended-snapshot persistence failure', () => {
  it('cancels the parked suspension so answering does not fail with "could not find a suspended run"', async () => {
    const { session, storage } = await buildController('snapfail');

    // Fail suspended-snapshot persistence the way an oversized snapshot does in
    // real storage adapters that JSON.stringify the snapshot.
    const workflowsStore = await storage.getStore('workflows');
    const realPersist = workflowsStore!.persistWorkflowSnapshot.bind(workflowsStore);
    vi.spyOn(workflowsStore!, 'persistWorkflowSnapshot').mockImplementation(async args => {
      if ((args.snapshot as any)?.status === 'suspended') {
        throw new RangeError('Invalid string length');
      }
      return realPersist(args);
    });

    const events: any[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.sendMessage({ content: 'Ask my name' });

    // The TUI-facing suspension event still fires — the user sees the question.
    const suspendEvent = events.find(e => e.type === 'tool_suspended');
    expect(suspendEvent).toBeDefined();

    // The run then dies on the failed snapshot persist. The primary error must
    // surface and the unresumable suspension must be retracted.
    await vi.waitFor(() => {
      expect(events.some(e => e.type === 'error' && e.error?.message === 'Invalid string length')).toBe(true);
      expect(events.some(e => e.type === 'tool_suspension_cancelled')).toBe(true);
    });

    const cancelEvent = events.find(e => e.type === 'tool_suspension_cancelled');
    expect(cancelEvent.toolCallId).toBe(suspendEvent.toolCallId);
    expect(cancelEvent.toolName).toBe('ask_user');
    expect(cancelEvent.reason).toBe('Invalid string length');

    // Both the resume bookkeeping and the UI-facing display state are cleared.
    expect(session.suspensions.hasPending()).toBe(false);
    expect(session.displayState.get().pendingSuspensions.size).toBe(0);

    events.length = 0;

    // A late answer (the user hit Enter anyway) is a no-op instead of failing
    // with the misleading "could not find a suspended run" error.
    await session.respondToToolSuspension({ toolCallId: suspendEvent.toolCallId, resumeData: 'Ada' });
    expect(events.some(e => e.type === 'error')).toBe(false);
  });
});

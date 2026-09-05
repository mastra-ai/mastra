import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

function modelStream(toolCall: boolean) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'response', modelId: 'mock', timestamp: new Date(0) });
      if (toolCall) {
        controller.enqueue({
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'findUser',
          input: '{"name":"Ada"}',
          providerExecuted: false,
        });
      } else {
        controller.enqueue({ type: 'text-start', id: 'text-1' });
        controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Done.' });
        controller.enqueue({ type: 'text-end', id: 'text-1' });
      }
      controller.enqueue({
        type: 'finish',
        finishReason: toolCall ? 'tool-calls' : 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      controller.close();
    },
  });
}

async function createHarness(id: string) {
  const toolStarted = deferred();
  const finishTool = deferred();
  const modelContinued = deferred();
  const finishModel = deferred();
  const approvalRequired = deferred();
  const execute = vi.fn(async () => {
    toolStarted.resolve();
    await finishTool.promise;
    return { email: 'ada@example.com' };
  });
  const findUser = createTool({
    id: 'find-user',
    description: 'Look up a user by name.',
    inputSchema: z.object({ name: z.string() }),
    requireApproval: true,
    execute,
  });
  let modelCalls = 0;
  const agent = new Agent({
    id: `${id}-agent`,
    name: 'Approval test agent',
    instructions: 'Look up the requested user.',
    model: new MastraLanguageModelV2Mock({
      doStream: async () => {
        modelCalls++;
        if (modelCalls > 1) {
          modelContinued.resolve();
          await finishModel.promise;
        }
        return { stream: modelStream(modelCalls === 1) };
      },
    }),
    tools: { findUser },
  });
  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { agent }, logger: false, storage });
  const controller = new AgentController({
    id: `${id}-controller`,
    storage,
    workspace: createMockWorkspace(),
    modes: [{ id: 'default', name: 'Default', default: true, agent: mastra.getAgent('agent') }],
  });
  await controller.init();
  const session = await controller.createSession({ id: `${id}-session`, ownerId: 'owner-1' });
  await session.thread.create();
  const snapshots: Array<{ pendingToolCallId: string | null; isRunning: boolean }> = [];
  const errors: unknown[] = [];
  session.subscribe(event => {
    if (event.type === 'tool_approval_required') approvalRequired.resolve();
    if (event.type === 'error') errors.push(event);
    if (event.type === 'display_state_changed') {
      snapshots.push({
        pendingToolCallId: event.displayState.pendingApproval?.toolCallId ?? null,
        isRunning: event.displayState.isRunning,
      });
    }
  });
  return {
    session,
    toolStarted,
    finishTool,
    modelContinued,
    finishModel,
    approvalRequired,
    execute,
    snapshots,
    errors,
  };
}

describe('AgentController approval display during a native run', () => {
  it.each(['approve', 'decline', 'new user message'] as const)(
    'clears the resolved prompt after %s before the run finishes',
    async decision => {
      const harness = await createHarness(`approval-${decision.replaceAll(' ', '-')}`);
      const { session, execute, snapshots } = harness;
      const turn = session.sendMessage({ content: 'Find Ada.' });
      try {
        await harness.approvalRequired.promise;
        expect(session.displayState.get().pendingApproval?.toolCallId).toBe('call-1');

        if (decision === 'new user message') {
          await session.sendSignal({ content: 'Skip that lookup.' }).accepted;
        } else {
          session.respondToToolApproval({ decision, toolCallId: 'call-1' });
        }

        expect(session.displayState.get().pendingApproval).toBeNull();
        expect(snapshots.at(-1)).toEqual({ pendingToolCallId: null, isRunning: true });

        if (decision === 'approve') {
          await harness.toolStarted.promise;
          expect(execute).toHaveBeenCalledTimes(1);
          expect(session.displayState.get().activeTools.get('call-1')?.status).toBe('running');
          expect(session.displayState.get().pendingApproval).toBeNull();
          harness.finishTool.resolve();
        }
        await harness.modelContinued.promise;
        expect(session.displayState.get().pendingApproval).toBeNull();
        expect(session.displayState.get().isRunning).toBe(true);
        expect(execute).toHaveBeenCalledTimes(decision === 'approve' ? 1 : 0);
      } finally {
        session.respondToToolApproval({ decision: 'decline' });
        harness.finishTool.resolve();
        harness.finishModel.resolve();
        await turn;
      }
      expect(session.displayState.get().pendingApproval).toBeNull();
      expect(session.displayState.get().isRunning).toBe(false);
      expect(harness.errors).toEqual([]);
    },
    30_000,
  );
});

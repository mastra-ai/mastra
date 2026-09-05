import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
// Exercise real persisted approval history without adding a Core -> Memory dependency cycle.
import { Memory } from '../../../../memory/src';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable';
import { Mastra } from '../../mastra';
import type { Processor } from '../../processors';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { Workspace } from '../../workspace';
import { AgentController } from '../agent-controller';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

type Ending = 'complete' | 'response abort' | 'step abort';

async function createHarness(ending: Ending, parallel = false, suspendFirstTool = false) {
  const reachedBoundary = deferred();
  const releaseBoundary = deferred();
  const firstEnd = deferred();
  const calls = { model: 0, tool: 0, abort: 0, results: [] as string[] };
  const approvals: string[] = [];
  const ends: Array<string | undefined> = [];
  const errors: unknown[] = [];
  const runIds: Array<string | null> = [];
  const model = new MastraLanguageModelV2Mock({
    doStream: async () => {
      const step = ++calls.model;
      if (step > 7) throw new Error('Unexpected model step after terminal completion');
      const toolCall = step < 5 || (step === 5 && ending !== 'complete') || step === 6;
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: `response-${step}`,
              modelId: 'mock',
              timestamp: new Date(0),
            });
            if (toolCall) {
              for (const suffix of parallel && step === 1 ? ['', '-parallel'] : ['']) {
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: `call-${step}${suffix}`,
                  toolName: 'localAction',
                  input: '{}',
                });
              }
            } else {
              controller.enqueue({ type: 'text-start', id: `text-${step}` });
              controller.enqueue({ type: 'text-delta', id: `text-${step}`, delta: 'Done.' });
              controller.enqueue({ type: 'text-end', id: `text-${step}` });
            }
            controller.enqueue({
              type: 'finish',
              finishReason: toolCall ? 'tool-calls' : 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
      };
    },
  });
  const processor = {
    id: 'terminal-test',
    processLLMResponse: async () => {
      if (calls.model === 5 && ending !== 'step abort') {
        reachedBoundary.resolve();
        await releaseBoundary.promise;
      }
    },
    processOutputStep: async args => {
      if (calls.model === 5 && ending === 'step abort') {
        reachedBoundary.resolve();
        await releaseBoundary.promise;
      }
      return args.messageList;
    },
    processOutputResult: async args => {
      calls.results.push(args.result?.finishReason ?? 'missing');
      return args.messageList;
    },
  } satisfies Processor;
  const storage = new InMemoryStore();
  const agent = createDurableAgent({
    agent: new Agent({
      id: 'terminal-test-agent',
      name: 'Terminal test',
      instructions: 'Call the local action.',
      model,
      memory: new Memory({ storage }),
      inputProcessors: [processor],
      outputProcessors: [processor],
      defaultOptions: {
        maxSteps: 1000,
        onAbort: () => {
          calls.abort++;
        },
      },
      tools: {
        localAction: createTool({
          id: 'localAction',
          description: 'Local test action',
          inputSchema: z.object({}),
          requireApproval: true,
          suspendSchema: z.object({ prompt: z.string() }),
          resumeSchema: z.object({ confirmed: z.boolean() }),
          execute: async (_input, context) => {
            if (suspendFirstTool && calls.tool === 0 && !context?.agent?.resumeData?.confirmed) {
              return context?.agent?.suspend({ prompt: 'Confirm the local action.' });
            }
            calls.tool++;
            return { ok: true };
          },
        }),
      },
    }),
  });
  const mastra = new Mastra({
    agents: { agent },
    storage,
    logger: false,
    workers: false,
    scheduler: { enabled: false },
    recovery: { durableAgents: 'off' },
  });
  await mastra.startWorkers();
  const workspace = new Workspace({ id: 'terminal-test-workspace', name: 'Test', skills: () => [] });
  const controller = new AgentController({
    id: 'terminal-test-controller',
    agent: mastra.getAgentById(agent.id),
    storage,
    workspace,
    defaultModeId: 'chat',
    modes: [{ id: 'chat', name: 'Chat', default: true }],
    disableBuiltinTools: [
      'ask_user',
      'submit_plan',
      'task_write',
      'task_update',
      'task_complete',
      'task_check',
      'subagent',
    ],
  });
  await controller.init();
  const session = await controller.createSession({ ownerId: 'owner', resourceId: 'resource', workspace });
  await session.thread.create({ title: 'Terminal test' });
  const unsubscribe = session.subscribe(event => {
    if (event.type === 'error') errors.push(event.error);
    if (event.type === 'agent_start') runIds.push(session.getCurrentRunId());
    if (event.type === 'agent_end') {
      ends.push(event.reason);
      firstEnd.resolve();
    }
    if (event.type === 'tool_approval_required') {
      approvals.push(event.toolCallId);
      if (calls.model < 5) session.respondToToolApproval({ decision: 'approve', toolCallId: event.toolCallId });
    }
  });
  return {
    session,
    storage,
    calls,
    approvals,
    ends,
    errors,
    runIds,
    reachedBoundary,
    releaseBoundary,
    firstEnd,
    async close() {
      releaseBoundary.resolve();
      session.abort();
      unsubscribe();
      controller.stopIntervals();
      await mastra.stopWorkers();
    },
  };
}

describe('durable Session terminal consumption with real Memory', () => {
  it('preserves an actual tool suspension and its same-run resume', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network is forbidden in this test'));
    const harness = await createHarness('complete', false, true);
    const { session, calls, approvals, errors } = harness;
    const parked = deferred();
    const suspendedCalls: string[] = [];
    const off = session.subscribe(event => {
      if (event.type === 'tool_suspended') {
        suspendedCalls.push(event.toolCallId);
        parked.resolve();
      }
    });
    const turn = session.sendMessage({ content: 'Run the local actions.' });
    let resumed: Promise<void> | undefined;
    try {
      await parked.promise;
      expect(suspendedCalls).toEqual(['call-1']);
      expect(calls.tool).toBe(0);
      resumed = session.respondToToolSuspension({ toolCallId: 'call-1', resumeData: { confirmed: true } });
      await vi.waitFor(
        () => expect({ model: calls.model, errors, suspendedCalls }).toMatchObject({ model: 5, errors: [] }),
        { timeout: 5_000 },
      );
      await harness.reachedBoundary.promise;
      harness.releaseBoundary.resolve();
      await vi.waitFor(() => expect(calls.results).toEqual(['stop']));
      await delay(100);
      expect(approvals).toEqual(['call-1', 'call-2', 'call-3', 'call-4']);
      expect(calls.tool).toBe(4);
      expect(calls.model).toBe(5);
      expect(session.approval.isArmed()).toBe(false);
      expect(session.displayState.get().pendingApproval).toBeNull();
      expect(session.displayState.get().isRunning).toBe(false);
      expect(errors).toEqual([]);
      expect(network).not.toHaveBeenCalled();
    } finally {
      off();
      await harness.close();
      void Promise.allSettled([turn, ...(resumed ? [resumed] : [])]);
      network.mockRestore();
    }
  }, 20_000);

  it.each([
    { ending: 'complete' as const, queued: false, parallel: false },
    { ending: 'complete' as const, queued: true, parallel: false },
    { ending: 'complete' as const, queued: false, parallel: true },
    { ending: 'response abort' as const, queued: false, parallel: false },
    { ending: 'response abort' as const, queued: true, parallel: false },
    { ending: 'step abort' as const, queued: false, parallel: false },
    { ending: 'step abort' as const, queued: true, parallel: false },
  ])(
    'does not replay resolved approvals after $ending (queued=$queued, parallel=$parallel)',
    async ({ ending, queued, parallel }) => {
      const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network is forbidden in this test'));
      const harness = await createHarness(ending, parallel);
      const { session, calls, approvals, ends, errors, runIds } = harness;
      const turns: Promise<void>[] = [];
      try {
        turns.push(session.sendMessage({ content: 'Run the local actions.' }));
        await vi.waitFor(
          () => expect({ model: calls.model, errors, approvals }).toMatchObject({ model: 5, errors: [] }),
          { timeout: 5_000 },
        );
        await harness.reachedBoundary.promise;
        const expectedApprovals = parallel
          ? ['call-1', 'call-1-parallel', 'call-2', 'call-3', 'call-4']
          : ['call-1', 'call-2', 'call-3', 'call-4'];
        expect(approvals).toEqual(expectedApprovals);
        if (queued) await session.followUp({ content: 'Run one more local action.' });
        if (ending !== 'complete') session.abort();
        harness.releaseBoundary.resolve();
        await harness.firstEnd.promise;

        if (!queued) {
          // Let queued native resume readers drain; a transient idle snapshot alone is insufficient.
          await delay(100);
          expect(approvals).toEqual(expectedApprovals);
          expect(session.approval.isArmed()).toBe(false);
          expect(session.displayState.get().pendingApproval).toBeNull();
          expect(session.displayState.get().isRunning).toBe(false);
          expect(calls.model).toBe(5);
          expect(calls.tool).toBe(expectedApprovals.length);
          turns.push(session.sendMessage({ content: 'Run one more local action.' }));
        }
        await vi.waitFor(() => expect(approvals).toEqual([...expectedApprovals, 'call-6']));
        expect(session.approval.isArmed()).toBe(true);
        expect(session.displayState.get().pendingApproval?.toolCallId).toBe('call-6');
        session.respondToToolApproval({ decision: 'approve', toolCallId: 'call-6' });
        await vi.waitFor(() => expect(calls.results).toEqual([ending === 'complete' ? 'stop' : 'abort', 'stop']));
        await delay(100);
        expect(ends).toEqual([ending === 'complete' ? 'complete' : 'aborted', 'complete']);
        expect(runIds).toHaveLength(2);
        expect(runIds[0]).not.toBe(runIds[1]);
        expect(session.approval.isArmed()).toBe(false);
        expect(session.displayState.get().pendingApproval).toBeNull();
        expect(session.displayState.get().isRunning).toBe(false);
        expect(approvals).toEqual([...expectedApprovals, 'call-6']);
        expect(calls.model).toBe(7);
        expect(calls.tool).toBe(expectedApprovals.length + 1);
        expect(calls.abort).toBe(ending === 'complete' ? 0 : 1);
        expect((await (await harness.storage.getStore('workflows'))!.listWorkflowRuns({})).runs).toEqual([]);
        expect(errors).toEqual([]);
        expect(network).not.toHaveBeenCalled();
      } finally {
        await harness.close();
        void Promise.allSettled(turns);
        network.mockRestore();
      }
    },
    20_000,
  );
});

import dns from 'node:dns';
import net from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { Memory } from '../../../../memory/src';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage/mock';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { submitPlanTool } from '../../tools/builtin/submit-plan';
import type { WorkflowRunState } from '../../workflows/types';
import { Workspace } from '../../workspace';
import { AgentController } from '../agent-controller';

afterEach(() => vi.restoreAllMocks());

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

function snapshotStatus(snapshot: string | WorkflowRunState | null | undefined) {
  return (typeof snapshot === 'string' ? (JSON.parse(snapshot) as WorkflowRunState) : snapshot)?.status;
}

// DurableAgent intentionally narrows the base stream/generate signatures.
// The controller accepts the native base class; keep the same checked object.
function requireNativeAgent(agent: unknown) {
  if (!(agent instanceof Agent)) throw new TypeError('Expected a native Agent');
  return agent;
}

it.each([
  'same-mode',
  'switched-mode',
  'shared-agent',
  'same-agent-id',
  'other-scopes',
  'immediate-stop',
  'immediate-stop-delayed',
  'missing-owner',
  'delayed-discovery',
  'navigate-during-discovery',
] as const)(
  'Stop cancels only its saved owning agent: %s',
  async scenario => {
    const switchFirst = scenario !== 'same-mode';
    const stopInEvent = scenario === 'immediate-stop' || scenario === 'immediate-stop-delayed';
    const delayDiscovery = scenario === 'delayed-discovery' || scenario === 'navigate-during-discovery';
    const calls = { plan: 0, build: 0, network: 0 };
    const denyNetwork = () => {
      calls.network++;
      throw new Error('No network is allowed');
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(denyNetwork);
    vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(denyNetwork);
    vi.spyOn(dns, 'lookup').mockImplementation(denyNetwork);
    const storage = new InMemoryStore();
    const planAgent = createDurableAgent({
      agent: new Agent<string, { submit_plan: typeof submitPlanTool }, any>({
        id: 'plan-agent',
        name: 'Plan',
        instructions: 'Submit a local plan.',
        model: new MastraLanguageModelV2Mock({
          doStream: async () => {
            const call = ++calls.plan;
            return {
              stream: new ReadableStream({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: `plan-${call}`,
                    toolName: 'submit_plan',
                    input: '{"path":"plan.md"}',
                  });
                  controller.enqueue({
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  });
                  controller.close();
                },
              }),
            };
          },
        }),
        memory: new Memory({ storage }),
        tools: { submit_plan: submitPlanTool },
      }),
    });
    const buildAgent = createDurableAgent({
      agent: new Agent<string, {}, any>({
        id: scenario === 'same-agent-id' ? 'plan-agent' : 'build-agent',
        name: 'Build',
        instructions: 'Do local work.',
        model: new MastraLanguageModelV2Mock({
          doStream: async () => {
            calls.build++;
            throw new Error('The build agent must not execute');
          },
        }),
        memory: new Memory({ storage }),
      }),
    });
    const workspace = new Workspace({ name: 'Local proof', skills: () => [] });
    const controller = new AgentController({
      id: 'mode-stop',
      storage,
      workspace,
      initialState: { yolo: true },
      modes: [
        { id: 'plan', name: 'Plan', default: true, transitionsTo: 'build', agent: requireNativeAgent(planAgent) },
        { id: 'build', name: 'Build', agent: requireNativeAgent(scenario === 'shared-agent' ? planAgent : buildAgent) },
      ],
    });
    const mastra = new Mastra({
      agents: { planAgent, buildAgent },
      agentControllers: { controller },
      storage,
      logger: false,
      workers: false,
      scheduler: { enabled: false },
      recovery: { durableAgents: 'off' },
    });
    try {
      await controller.init();
      expect(controller.getMastra()).toBe(mastra);
      expect(mastra.getAgentController('controller')).toBe(controller);
      expect(planAgent.getMastraInstance()).toBe(mastra);
      expect(buildAgent.getMastraInstance()).toBe(mastra);
      const session = await controller.createSession({
        id: 'target',
        ownerId: 'owner',
        resourceId: 'resource',
        workspace,
      });
      await session.thread.create();
      const planAbort = vi.spyOn(planAgent, 'abortRunStream');
      const planWait = vi.spyOn(planAgent, '__abortRunStreamAndWait');
      const buildAbort = vi.spyOn(buildAgent, 'abortRunStream');
      const buildWait = vi.spyOn(buildAgent, '__abortRunStreamAndWait');
      const releaseImmediateRead = deferred();
      if (scenario === 'immediate-stop-delayed') {
        const suspended = planAgent.listSuspendedRuns.bind(planAgent);
        const active = planAgent.listActiveRuns.bind(planAgent);
        vi.spyOn(planAgent, 'listSuspendedRuns').mockImplementation(async input => {
          await releaseImmediateRead.promise;
          return suspended(input);
        });
        vi.spyOn(planAgent, 'listActiveRuns').mockImplementation(async input => {
          await releaseImmediateRead.promise;
          return active(input);
        });
      }
      let immediateStop: Promise<void> | undefined;
      const errors: Error[] = [];
      session.subscribe(event => {
        if (event.type === 'error') errors.push(event.error);
        if (stopInEvent && event.type === 'tool_suspended') {
          if (scenario === 'immediate-stop-delayed') {
            session.abortRun();
            immediateStop = Promise.resolve();
          } else {
            immediateStop = session.mode.switch({ modeId: 'build' }).then(() => session.abortRun());
          }
        }
      });
      try {
        await session.sendMessage({ content: 'Create a plan.' });
        if (scenario === 'immediate-stop-delayed') {
          // Normal turn cleanup clears the live flag before saved cancellation finishes.
          expect(session.run.isAbortRequested()).toBe(false);
        }
      } finally {
        releaseImmediateRead.resolve();
      }
      await immediateStop;
      if (stopInEvent) expect(immediateStop).toBeDefined();
      if (!stopInEvent) expect(session.suspensions.hasPending()).toBe(true);
      const store = await storage.getStore('workflows');
      expect(store).toBeDefined();
      if (!stopInEvent)
        await vi.waitFor(async () => {
          expect((await store!.listWorkflowRuns({})).runs.map(row => snapshotStatus(row.snapshot))).toEqual([
            'suspended',
            'suspended',
          ]);
        });
      const targetIds = new Set((await store!.listWorkflowRuns({})).runs.map(row => row.runId));
      const threadId = session.thread.getId()!;
      if (scenario === 'other-scopes') {
        for (const resourceId of ['resource', 'another-resource']) {
          const other = await controller.createSession({
            scope: `other-${resourceId}`,
            ownerId: 'owner',
            resourceId,
            workspace,
          });
          expect(other).not.toBe(session);
          await other.thread.create();
          expect(other.thread.getId()).not.toBe(threadId);
          await other.sendMessage({ content: 'Keep this plan paused.' });
        }
        await vi.waitFor(async () => {
          expect(
            (await store!.listWorkflowRuns({})).runs.filter(row => snapshotStatus(row.snapshot) === 'suspended'),
          ).toHaveLength(6);
        });
      }
      if (switchFirst && !stopInEvent) await session.mode.switch({ modeId: 'build' });
      if (scenario === 'missing-owner') {
        // Exercise a read failure without changing native saved ownership.
        vi.spyOn(planAgent, 'listSuspendedRuns').mockResolvedValue({ runs: [], total: 0 });
      }
      const entered = deferred();
      const release = deferred();
      const close = vi.spyOn(storage, 'close');
      let nextThreadId: string | undefined;
      if (scenario === 'navigate-during-discovery') {
        const other = await controller.createSession({ scope: 'navigation-target', resourceId: 'resource', workspace });
        nextThreadId = (await other.thread.create()).id;
      }
      if (delayDiscovery) {
        const discover = planAgent.listSuspendedRuns.bind(planAgent);
        vi.spyOn(planAgent, 'listSuspendedRuns').mockImplementation(async input => {
          entered.resolve();
          await release.promise;
          return discover(input);
        });
      }
      if (!stopInEvent) session.abortRun();
      if (scenario === 'missing-owner') {
        await expect(mastra.shutdown()).rejects.toBeInstanceOf(AggregateError);
        expect(errors.some(error => error.message.includes('Could not find the owning agent'))).toBe(true);
      } else {
        if (delayDiscovery) await entered.promise;
        if (nextThreadId) {
          await session.thread.switch({ threadId: nextThreadId });
          expect(session.thread.getId()).not.toBe(threadId);
        }
        const shutdown = mastra.shutdown();
        if (delayDiscovery) {
          try {
            await Promise.resolve();
            expect(close).not.toHaveBeenCalled();
          } finally {
            release.resolve();
          }
        }
        await shutdown;
        expect(errors).toEqual([]);
      }
      const after = (await store!.listWorkflowRuns({})).runs;
      expect(after.filter(row => targetIds.has(row.runId)).map(row => snapshotStatus(row.snapshot))).toEqual(
        scenario === 'missing-owner' ? ['suspended', 'suspended'] : ['canceled', 'canceled'],
      );
      expect(after.filter(row => !targetIds.has(row.runId)).map(row => snapshotStatus(row.snapshot))).toEqual(
        scenario === 'other-scopes' ? Array(4).fill('suspended') : [],
      );
      expect(planAbort.mock.calls.length + planWait.mock.calls.length).toBe(scenario === 'missing-owner' ? 0 : 1);
      expect(buildAbort).not.toHaveBeenCalled();
      expect(buildWait).not.toHaveBeenCalled();
      expect(calls).toEqual({ plan: scenario === 'other-scopes' ? 3 : 1, build: 0, network: 0 });
    } finally {
      await mastra.shutdown().catch(error => {
        if (scenario !== 'missing-owner') throw error;
      });
    }
  },
  15000,
);

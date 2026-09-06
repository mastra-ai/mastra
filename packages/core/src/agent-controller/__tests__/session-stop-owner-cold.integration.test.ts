// Adapted from the independent public-package cold Stop regression.
import dns from 'node:dns';
import fs from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { LibSQLStore } from '../../../../../stores/libsql/src';
import { Memory } from '../../../../memory/src';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable';
import { Mastra } from '../../mastra';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { submitPlanTool } from '../../tools/builtin/submit-plan';
import type { WorkflowRunState } from '../../workflows/types';
import { Workspace } from '../../workspace';
import { AgentController } from '../agent-controller';

function response(call: number) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: `id-${call}`, modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: `plan-call-${call}`,
        toolName: 'submit_plan',
        input: '{"path":"plan.md"}',
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      controller.close();
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(['mode-plan', 'mode-build', 'single-agent', 'single-agent-navigation', 'single-agent-future'] as const)(
  'Cold reopened Session Stop keeps its captured target: %s',
  async scenario => {
    const switchFirst = scenario === 'mode-build';
    const singleAgent = scenario.startsWith('single-agent');
    const navigate = scenario === 'single-agent-navigation' || scenario === 'single-agent-future';
    const startFutureRun = scenario === 'single-agent-future';
    const directory = fs.mkdtempSync(path.join(tmpdir(), `mastra-cold-mode-stop-${scenario}-`));
    const url = pathToFileURL(path.join(directory, 'native.db')).href;
    const calls = { plan: 0, build: 0, network: 0 };
    const deny = () => {
      calls.network++;
      throw new Error('Unexpected network');
    };
    vi.stubGlobal('fetch', vi.fn(deny));
    vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(deny as never);
    vi.spyOn(dns, 'lookup').mockImplementation(deny as never);
    const receipt: Record<string, any> = {
      scope: 'native source cold Session Stop',
      scenario,
      switchFirst,
      directory,
      owners: [],
      events: [],
      calls,
    };

    async function createHost() {
      const storage = new LibSQLStore({ id: 'mode-stop-proof', url });
      await storage.init();
      const planAgent = createDurableAgent({
        agent: new Agent<string, { submit_plan: typeof submitPlanTool }, any>({
          id: 'plan-agent',
          name: 'Plan',
          instructions: 'Submit a local plan.',
          model: new MastraLanguageModelV2Mock({ doStream: async () => ({ stream: response(++calls.plan) }) }),
          memory: new Memory({ storage }),
          tools: { submit_plan: submitPlanTool },
        }),
      });
      const buildAgent = createDurableAgent({
        agent: new Agent<string, {}, any>({
          id: 'build-agent',
          name: 'Build',
          instructions: 'Do local work.',
          model: new MastraLanguageModelV2Mock({
            doStream: async () => {
              calls.build++;
              throw new Error('Build must not execute in this proof');
            },
          }),
          memory: new Memory({ storage }),
        }),
      });
      const workspace = new Workspace({ name: 'Cold mode Stop proof', skills: () => [] });
      const controller = new AgentController({
        id: 'mode-stop-controller',
        storage,
        workspace,
        initialState: { yolo: true },
        ...(singleAgent
          ? { agent: planAgent, modes: [{ id: 'web', name: 'Web', default: true }] }
          : {
              modes: [
                { id: 'plan', name: 'Plan', default: true, transitionsTo: 'build', agent: planAgent },
                { id: 'build', name: 'Build', agent: buildAgent },
              ],
            }),
      });
      const mastra = new Mastra({
        agents: singleAgent ? { planAgent } : { planAgent, buildAgent },
        agentControllers: { proof: controller },
        storage,
        logger: false,
        workers: false,
        scheduler: { enabled: false },
        recovery: { durableAgents: 'off' },
      });
      return { storage, planAgent, buildAgent, workspace, controller, mastra };
    }
    const owners = (host: Awaited<ReturnType<typeof createHost>>, stage: string) => {
      const checks = {
        controller: host.controller.getMastra() === host.mastra,
        registered: host.mastra.getAgentController('proof') === host.controller,
        plan: host.planAgent.getMastraInstance() === host.mastra,
        ...(singleAgent ? {} : { build: host.buildAgent.getMastraInstance() === host.mastra }),
        storage: host.controller.getMastra()?.getStorage() === host.mastra.getStorage(),
      };
      receipt.owners.push({ stage, ...checks });
      expect(Object.values(checks).every(Boolean)).toBe(true);
    };
    const rows = async (storage: LibSQLStore) =>
      (await (await storage.getStore('workflows'))!.listWorkflowRuns({})).runs.map(row => {
        const snapshot =
          typeof row.snapshot === 'string' ? (JSON.parse(row.snapshot) as WorkflowRunState) : row.snapshot;
        return {
          workflowName: row.workflowName,
          runId: row.runId,
          createdAt: row.createdAt,
          status: snapshot?.status,
          agentId: (snapshot?.context?.input as any)?.agentId,
          resourceId: row.resourceId,
        };
      });
    const events = (session: Awaited<ReturnType<AgentController['createSession']>>, phase: string) =>
      session.subscribe(event => {
        if (
          ['tool_suspended', 'tool_suspension_cancelled', 'agent_end', 'error', 'mode_changed'].includes(event.type)
        ) {
          receipt.events.push({
            phase,
            type: event.type,
            reason: (event as any).reason,
            toolCallId: (event as any).toolCallId,
            modeId: (event as any).modeId,
            error: (event as any).error?.message,
          });
        }
      });
    let host = await createHost();
    let unsubscribe = () => {};
    const discoveries: Array<{ mode: string; kind: string; spy: any }> = [];
    let planAbort: ReturnType<typeof vi.spyOn> | undefined;
    let buildAbort: ReturnType<typeof vi.spyOn> | undefined;
    let releaseRead = () => {};
    try {
      await host.controller.init();
      owners(host, 'writer');
      const warm = await host.controller.createSession({
        id: 'mode-stop-session',
        ownerId: 'owner',
        resourceId: 'resource',
        workspace: host.workspace,
      });
      await warm.thread.create();
      unsubscribe = events(warm, 'writer');
      await warm.sendMessage({ content: 'Create a plan.' });
      await vi.waitFor(
        async () => {
          receipt.beforeRows = await rows(host.storage);
          expect(receipt.beforeRows.filter((row: any) => row.status === 'suspended')).toHaveLength(2);
        },
        { timeout: 5000, interval: 20 },
      );
      if (switchFirst) await warm.mode.switch({ modeId: 'build' });
      receipt.savedMode = warm.mode.get();
      const threadId = warm.thread.getId()!;
      receipt.threadId = threadId;
      let emptyThreadId: string | undefined;
      if (singleAgent) {
        const empty = await host.controller.createSession({
          scope: 'empty-thread',
          ownerId: 'owner',
          resourceId: 'resource',
          workspace: host.workspace,
        });
        emptyThreadId = (await empty.thread.create()).id;
        receipt.emptyThreadId = emptyThreadId;
      }
      unsubscribe();
      await host.mastra.shutdown();

      const writer = host;
      host = await createHost();
      await host.controller.init();
      owners(host, 'reopened');
      expect(host.mastra).not.toBe(writer.mastra);
      expect(host.controller).not.toBe(writer.controller);
      expect(host.storage).not.toBe(writer.storage);
      expect(host.planAgent).not.toBe(writer.planAgent);
      expect(host.buildAgent).not.toBe(writer.buildAgent);
      const fresh = await host.controller.createSession({
        id: 'mode-stop-session',
        ownerId: 'owner',
        resourceId: 'resource',
        workspace: host.workspace,
      });
      expect(fresh).not.toBe(warm);
      unsubscribe = events(fresh, 'reopened');
      await fresh.thread.switch({ threadId });
      receipt.reopened = {
        mode: fresh.mode.get(),
        runId: fresh.getCurrentRunId(),
        pending: fresh.suspensions.hasPending(),
        agentId: host.controller.getCurrentAgent(fresh).id,
        resourceId: fresh.identity.getResourceId(),
        threadId: fresh.thread.getId(),
      };
      expect(receipt.reopened).toEqual({
        mode: singleAgent ? 'web' : switchFirst ? 'build' : 'plan',
        runId: null,
        pending: false,
        agentId: switchFirst ? 'build-agent' : 'plan-agent',
        resourceId: 'resource',
        threadId,
      });
      receipt.beforeStopRows = await rows(host.storage);
      expect(receipt.beforeStopRows.map((row: any) => row.status)).toEqual(['suspended', 'suspended']);

      const backingAgents = singleAgent
        ? ([['web', host.planAgent]] as const)
        : ([
            ['plan', host.planAgent],
            ['build', host.buildAgent],
          ] as const);
      const realReads = {
        listSuspendedRuns: host.planAgent.listSuspendedRuns.bind(host.planAgent),
        listActiveRuns: host.planAgent.listActiveRuns.bind(host.planAgent),
      };
      for (const [mode, agent] of backingAgents) {
        discoveries.push({ mode, kind: 'suspended', spy: vi.spyOn(agent, 'listSuspendedRuns') });
        discoveries.push({ mode, kind: 'active', spy: vi.spyOn(agent, 'listActiveRuns') });
      }
      planAbort = vi.spyOn(host.planAgent, 'abortRunStream');
      buildAbort = vi.spyOn(host.buildAgent, 'abortRunStream');
      let enteredResolve = () => {};
      const entered = new Promise<void>(resolve => {
        enteredResolve = resolve;
      });
      const held = new Promise<void>(resolve => {
        releaseRead = resolve;
      });
      if (singleAgent) {
        for (const method of ['listSuspendedRuns', 'listActiveRuns'] as const) {
          const spy = discoveries.find(
            item => item.kind === (method === 'listSuspendedRuns' ? 'suspended' : 'active'),
          )!.spy;
          spy.mockImplementation(async (input: Parameters<typeof host.planAgent.listSuspendedRuns>[0]) => {
            receipt.heldScope = input;
            enteredResolve();
            await held;
            return realReads[method](input);
          });
        }
      }
      owners(host, 'before-stop');
      fresh.abortRun();
      if (singleAgent) {
        await entered;
        expect(fresh.run.isAbortRequested()).toBe(true);
        expect(receipt.heldScope).toMatchObject({ resourceId: 'resource', threadId });
        expect(receipt.heldScope.toDate).toBeInstanceOf(Date);
        if (navigate) {
          await fresh.thread.switch({ threadId: emptyThreadId! });
          expect(fresh.thread.getId()).toBe(emptyThreadId);
        }
        if (startFutureRun) {
          await vi.waitFor(() => expect(Date.now()).toBeGreaterThan(receipt.heldScope.toDate.getTime()), {
            interval: 2,
          });
          const later = await host.controller.createSession({
            scope: 'future-run',
            ownerId: 'owner',
            resourceId: 'resource',
            workspace: host.workspace,
          });
          await later.thread.switch({ threadId });
          await later.sendMessage({ content: 'Create another plan after Stop.' });
          await vi.waitFor(
            async () => {
              const oldIds = new Set(receipt.beforeStopRows.map((row: any) => row.runId));
              receipt.futureRows = (await rows(host.storage)).filter(row => !oldIds.has(row.runId));
              expect(receipt.futureRows).toHaveLength(2);
              expect(receipt.futureRows.every((row: any) => row.status === 'suspended')).toBe(true);
            },
            { timeout: 5000, interval: 20 },
          );
          expect(
            receipt.futureRows.every((row: any) => row.createdAt.getTime() > receipt.heldScope.toDate.getTime()),
          ).toBe(true);
        }
        releaseRead();
      }
      await host.mastra.shutdown();
      const reader = new LibSQLStore({ id: 'readback', url });
      try {
        await reader.init();
        receipt.afterRows = await rows(reader);
        if (singleAgent) {
          const memory = new Memory({ storage: reader });
          const empty = await memory.recall({ threadId: emptyThreadId!, resourceId: 'resource' });
          expect(empty.messages).toHaveLength(0);
        }
      } finally {
        await reader.close();
      }
      const oldIds = new Set(receipt.beforeStopRows.map((row: any) => row.runId));
      expect(receipt.afterRows.filter((row: any) => oldIds.has(row.runId)).map((row: any) => row.status)).toEqual([
        'canceled',
        'canceled',
      ]);
      expect(receipt.afterRows.filter((row: any) => !oldIds.has(row.runId)).map((row: any) => row.status)).toEqual(
        startFutureRun ? ['suspended', 'suspended'] : [],
      );
      expect(calls).toEqual({ plan: startFutureRun ? 2 : 1, build: 0, network: 0 });
    } finally {
      releaseRead();
      await host.mastra.shutdown();
      unsubscribe();
      receipt.discovery = await Promise.all(
        discoveries.map(async ({ mode, kind, spy }) => ({
          mode,
          kind,
          inputs: spy.mock.calls,
          outputs: await Promise.all(
            spy.mock.results.map(async (result: any) => {
              if (result.type !== 'return') return { error: String(result.value) };
              try {
                const value = await result.value;
                return { runs: value.runs.map((run: any) => ({ runId: run.runId, agentId: run.agentId })) };
              } catch (error) {
                return { error: String(error) };
              }
            }),
          ),
        })),
      );
      receipt.planAbort = planAbort?.mock.calls;
      receipt.buildAbort = buildAbort?.mock.calls;
      receipt.finishedAt = new Date().toISOString();
      fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify(receipt, null, 2) + '\n');
    }
  },
  15000,
);

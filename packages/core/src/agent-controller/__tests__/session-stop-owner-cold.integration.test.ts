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

// DurableAgent intentionally narrows the base stream/generate signatures.
// The controller accepts the native base class; keep the same checked object.
function requireNativeAgent(agent: unknown) {
  if (!(agent instanceof Agent)) throw new TypeError('Expected a native Agent');
  return agent;
}

function describeError(error: unknown): unknown {
  if (!(error instanceof Error)) return String(error);
  return {
    message: error.message,
    id: (error as Error & { id?: string }).id,
    errors: error instanceof AggregateError ? error.errors.map(describeError) : undefined,
  };
}

it.each([
  'mode-plan',
  'mode-build',
  'single-agent',
  'single-agent-navigation',
  'single-agent-future',
  'single-agent-duplicate',
  'single-agent-save-delay',
  'single-agent-end-navigation',
  'single-agent-save-failure',
  'single-agent-approval',
  'single-agent-end-new-run',
  'single-agent-end-preparing-run',
] as const)(
  'Cold reopened Session Stop keeps its captured target: %s',
  async scenario => {
    const switchFirst = scenario === 'mode-build';
    const singleAgent = scenario.startsWith('single-agent');
    const navigate = scenario === 'single-agent-navigation' || scenario === 'single-agent-future';
    const startFutureRun = scenario === 'single-agent-future';
    const failSave = scenario === 'single-agent-save-failure';
    const approval = scenario === 'single-agent-approval';
    const preparingRun = scenario === 'single-agent-end-preparing-run';
    const newRunAtEnd = scenario === 'single-agent-end-new-run' || preparingRun;
    const holdEnd = scenario === 'single-agent-end-navigation' || newRunAtEnd;
    const directory = fs.mkdtempSync(path.join(tmpdir(), `mastra-cold-mode-stop-${scenario}-`));
    const url = pathToFileURL(path.join(directory, 'native.db')).href;
    const calls = { plan: 0, build: 0, network: 0 };
    let enterNewModel = () => {};
    let releaseNewModel = () => {};
    const newModelEntered = new Promise<void>(resolve => {
      enterNewModel = resolve;
    });
    const heldNewModel = new Promise<void>(resolve => {
      releaseNewModel = resolve;
    });
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
      terminalOutputs: [],
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
          model: new MastraLanguageModelV2Mock({
            doStream: async () => {
              const call = ++calls.plan;
              if (call === 2 && preparingRun) {
                enterNewModel();
                await heldNewModel;
              }
              return { stream: response(call) };
            },
          }),
          memory: new Memory({ storage, options: { generateTitle: approval } }),
          tools: { submit_plan: submitPlanTool },
          outputProcessors: [
            {
              id: 'cold-stop-terminal-observer',
              processOutputResult({ messageList, result }) {
                receipt.terminalOutputs.push({ finishReason: result.finishReason, usage: result.usage });
                return messageList;
              },
            },
          ],
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
        initialState: { yolo: !approval },
        ...(singleAgent
          ? { agent: requireNativeAgent(planAgent), modes: [{ id: 'web', name: 'Web', default: true }] }
          : {
              modes: [
                {
                  id: 'plan',
                  name: 'Plan',
                  default: true,
                  transitionsTo: 'build',
                  agent: requireNativeAgent(planAgent),
                },
                { id: 'build', name: 'Build', agent: requireNativeAgent(buildAgent) },
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
          [
            'tool_suspended',
            'tool_suspension_cancelled',
            'agent_end',
            'message_end',
            'display_state_changed',
            'error',
            'mode_changed',
          ].includes(event.type)
        ) {
          receipt.events.push({
            phase,
            type: event.type,
            reason: (event as any).reason,
            toolCallId: (event as any).toolCallId,
            modeId: (event as any).modeId,
            error: (event as any).error?.message,
            message: event.type === 'message_end' ? structuredClone(event.message) : undefined,
            displayState: event.type === 'display_state_changed' ? structuredClone(event.displayState) : undefined,
          });
        }
      });
    let host = await createHost();
    let unsubscribe = () => {};
    const discoveries: Array<{ mode: string; kind: string; spy: any }> = [];
    let planAbort: ReturnType<typeof vi.spyOn> | undefined;
    let buildAbort: ReturnType<typeof vi.spyOn> | undefined;
    let releaseRead = () => {};
    let releaseSave = () => {};
    let releaseEnd = () => {};
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
      const initialSend = warm.sendMessage({ content: 'Create a plan.' });
      if (approval) void initialSend.catch(() => {});
      else await initialSend;
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
      if (fresh.thread.getId() !== threadId) await fresh.thread.switch({ threadId });
      expect(fresh.thread.getId()).toBe(threadId);
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
      const realCancel = host.planAgent.__abortRunStreamAndWait.bind(host.planAgent);
      vi.spyOn(host.planAgent, '__abortRunStreamAndWait').mockImplementation(async runId => {
        const result = await realCancel(runId);
        receipt.cancelResult = result;
        receipt.cancelSession = {
          threadId: fresh.thread.getId(),
          runId: fresh.getCurrentRunId(),
          operationId: fresh.run.getOperationId(),
        };
        return result;
      });
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
      let saveEntered = Promise.resolve();
      if (scenario === 'single-agent-save-delay') {
        let enterSave = () => {};
        saveEntered = new Promise<void>(resolve => {
          enterSave = resolve;
        });
        const heldSave = new Promise<void>(resolve => {
          releaseSave = resolve;
        });
        const memory = (await host.planAgent.getMemory())!;
        const save = memory.saveMessages.bind(memory);
        vi.spyOn(memory, 'saveMessages').mockImplementation(async args => {
          enterSave();
          await heldSave;
          return save(args);
        });
      }
      let endEntered = Promise.resolve();
      if (failSave) {
        const memory = (await host.planAgent.getMemory())!;
        const memoryStore = (await memory.storage.getStore('memory'))!;
        vi.spyOn(memoryStore, 'saveMessages').mockRejectedValue(new Error('Simulated final save failure'));
      }
      if (holdEnd) {
        let enterEnd = () => {};
        endEntered = new Promise<void>(resolve => {
          enterEnd = resolve;
        });
        const heldEnd = new Promise<void>(resolve => {
          releaseEnd = resolve;
        });
        fresh.onBeforeAgentEnd(async event => {
          if (event.reason === 'aborted') {
            enterEnd();
            await heldEnd;
          }
        });
      }
      fresh.abort();
      if (scenario === 'single-agent-duplicate') {
        const duplicate = await host.controller.createSession({
          id: 'duplicate-stop-session',
          scope: 'duplicate-stop',
          ownerId: 'owner',
          resourceId: 'resource',
          workspace: host.workspace,
        });
        if (duplicate.thread.getId() !== threadId) await duplicate.thread.switch({ threadId });
        duplicate.abortRun();
      }
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
          if (later.thread.getId() !== threadId) await later.thread.switch({ threadId });
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
      if (scenario === 'single-agent-save-delay') {
        await saveEntered;
        expect(
          receipt.events.filter(
            (event: any) => event.phase === 'reopened' && ['message_end', 'agent_end'].includes(event.type),
          ),
        ).toEqual([]);
        releaseSave();
      }
      if (holdEnd) {
        await endEntered;
        expect(receipt.events.filter((event: any) => event.phase === 'reopened' && event.type === 'agent_end')).toEqual(
          [],
        );
        if (newRunAtEnd) {
          const newerSend = fresh.sendMessage({ content: 'Create a newer plan while the old end hook waits.' });
          if (preparingRun) {
            await newModelEntered;
            receipt.preparingRunId = fresh.getCurrentRunId();
            releaseEnd();
            await new Promise<void>(resolve => setImmediate(resolve));
            expect(structuredClone(fresh.displayState.get()).isRunning).toBe(true);
            expect(fresh.getCurrentRunId()).toBe(receipt.preparingRunId);
            expect(
              receipt.events.filter((event: any) => event.phase === 'reopened' && event.type === 'agent_end'),
            ).toEqual([]);
            releaseNewModel();
          }
          await newerSend;
          const oldIds = new Set(receipt.beforeStopRows.map((row: any) => row.runId));
          receipt.futureRows = (await rows(host.storage)).filter(row => !oldIds.has(row.runId));
          expect(receipt.futureRows).toHaveLength(2);
          expect(fresh.displayState.get().pendingSuspensions.size).toBe(1);
        } else {
          await fresh.thread.switch({ threadId: emptyThreadId! });
        }
        receipt.navigatedDisplay = structuredClone(fresh.displayState.get());
        releaseEnd();
      }
      if (failSave) {
        await vi.waitFor(
          () => {
            expect(
              receipt.events.filter((event: any) => event.phase === 'reopened' && event.type === 'error'),
            ).toHaveLength(1);
          },
          { timeout: 5000, interval: 20 },
        );
      } else if (!navigate && scenario !== 'single-agent-duplicate' && !holdEnd) {
        await vi.waitFor(
          () => {
            expect(
              receipt.events.filter((event: any) => event.phase === 'reopened' && event.type === 'message_end'),
            ).toHaveLength(1);
            expect(
              receipt.events.filter((event: any) => event.phase === 'reopened' && event.type === 'agent_end'),
            ).toHaveLength(1);
          },
          { timeout: 5000, interval: 20 },
        );
      }
      const shutdown = host.mastra.shutdown();
      if (failSave) {
        await expect(shutdown).rejects.toThrow('cancellation');
      } else if (scenario === 'single-agent-duplicate') {
        // Recovery admits one owner. The competing Session gets an explicit
        // conflict; it must not prepare a second stream or resurrect a row.
        await expect(shutdown).rejects.toMatchObject({
          errors: [
            expect.objectContaining({
              errors: [expect.objectContaining({ id: 'DURABLE_AGENT_RECOVER_ALREADY_IN_PROGRESS' })],
            }),
          ],
        });
      } else {
        await shutdown;
      }
      const reader = new LibSQLStore({ id: 'readback', url });
      try {
        await reader.init();
        receipt.afterRows = await rows(reader);
        const stoppedMessages = await new Memory({ storage: reader }).recall({ threadId, resourceId: 'resource' });
        receipt.stoppedMessages = stoppedMessages.messages;
        if (singleAgent) {
          const memory = new Memory({ storage: reader });
          const empty = await memory.recall({ threadId: emptyThreadId!, resourceId: 'resource' });
          expect(empty.messages).toHaveLength(0);
        }
      } finally {
        await reader.close();
      }
      const oldIds = new Set(receipt.beforeStopRows.map((row: any) => row.runId));
      expect(receipt.terminalOutputs).toEqual([
        { finishReason: 'abort', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]);
      if (!failSave) expect(receipt.events.filter((event: { type: string }) => event.type === 'error')).toEqual([]);
      const stoppedEvents = receipt.events.filter((event: any) => event.phase === 'reopened');
      const stoppedMessageEvents = stoppedEvents.filter((event: any) => event.type === 'message_end');
      if (failSave) {
        expect(stoppedMessageEvents).toEqual([]);
        expect(stoppedEvents.filter((event: any) => event.type === 'agent_end')).toEqual([]);
        expect(
          receipt.stoppedMessages.some((message: any) => message.content.metadata?.suspendedTools?.['plan-call-1']),
        ).toBe(true);
      } else if (!navigate && scenario !== 'single-agent-duplicate' && !holdEnd) {
        const originalAssistant = receipt.stoppedMessages.find((message: any) => message.role === 'assistant');
        expect(originalAssistant).toBeDefined();
        expect(stoppedMessageEvents.map((event: any) => event.message)).toEqual([originalAssistant]);
        expect(stoppedEvents.filter((event: any) => event.type === 'agent_end')).toMatchObject([{ reason: 'aborted' }]);
        const finalDisplay = stoppedEvents
          .filter((event: any) => event.type === 'display_state_changed')
          .at(-1)?.displayState;
        expect(finalDisplay).toMatchObject({ isRunning: false, pendingApproval: null });
        expect(finalDisplay.pendingSuspensions.size).toBe(0);
      } else if (holdEnd) {
        expect(stoppedMessageEvents).toHaveLength(newRunAtEnd ? 2 : 1);
        expect(
          stoppedEvents.filter((event: any) => event.type === 'agent_end').map((event: any) => event.reason),
        ).toEqual(newRunAtEnd ? ['suspended'] : []);
        expect(fresh.displayState.get()).toEqual(receipt.navigatedDisplay);
      } else if (navigate) {
        expect(stoppedMessageEvents).toEqual([]);
        expect(stoppedEvents.filter((event: any) => event.type === 'agent_end')).toEqual([]);
      } else {
        expect(stoppedMessageEvents.length).toBeLessThanOrEqual(1);
      }
      for (const message of failSave ? [] : receipt.stoppedMessages) {
        expect(message.content.metadata?.suspendedTools?.['plan-call-1']).toBeUndefined();
        expect(message.content.metadata?.pendingToolApprovals?.['plan-call-1']).toBeUndefined();
      }
      if (approval) {
        expect(
          receipt.stoppedMessages
            .flatMap((message: any) => message.content.parts)
            .filter((part: any) => part.type === 'tool-invocation')
            .map((part: any) => part.toolInvocation.state),
        ).toEqual(['output-denied']);
      }
      expect(receipt.afterRows.filter((row: any) => oldIds.has(row.runId))).toEqual([]);
      expect(receipt.afterRows.filter((row: any) => !oldIds.has(row.runId)).map((row: any) => row.status)).toEqual(
        startFutureRun || newRunAtEnd ? ['suspended', 'suspended'] : [],
      );
      expect(calls).toEqual({ plan: startFutureRun || newRunAtEnd ? 2 : 1, build: 0, network: 0 });
    } finally {
      releaseRead();
      releaseSave();
      releaseEnd();
      releaseNewModel();
      try {
        await host.mastra.shutdown();
      } catch (error) {
        receipt.shutdownError = describeError(error);
      }
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

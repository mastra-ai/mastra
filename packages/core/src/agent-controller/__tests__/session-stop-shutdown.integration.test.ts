import assert from 'node:assert/strict';
import dns from 'node:dns';
import { mkdtempSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { LibSQLStore } from '../../../../../stores/libsql/src';
import { Memory } from '../../../../memory/src';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable';
import { Mastra } from '../../mastra';
import { createWorkflow, createStep } from '../../workflows';
import { Workspace } from '../../workspace';
import { AgentController } from '../agent-controller';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
};
const bounded = <T>(promise: Promise<T>, label: string) =>
  Promise.race([
    promise,
    delay(5000).then(() => {
      throw new Error('Timed out: ' + label);
    }),
  ]);
afterEach(() => vi.restoreAllMocks());

it.each(['discovery', 'snapshot', 'write', 'discovery-error', 'write-error', 'late-stop'] as const)(
  'registered cold host drains Stop at %s',
  async boundary => {
    const directory = mkdtempSync(path.join(tmpdir(), 'mastra-cold-owner-'));
    const url = pathToFileURL(path.join(directory, 'native.db')).href;
    const calls = { model: 0, following: 0, network: 0 };
    const order: string[] = [];
    const identities: Array<Record<string, boolean | string>> = [];
    const errors: string[] = [];
    const failure = new Error('Controlled cancellation storage failure');
    const shouldFail = boundary.endsWith('-error');
    const denyNetwork = () => {
      calls.network++;
      throw new Error('External network is forbidden');
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(denyNetwork);
    vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(denyNetwork);
    vi.spyOn(dns, 'lookup').mockImplementation(denyNetwork);
    const approval = deferred(),
      parked = deferred(),
      ended = deferred(),
      readEntered = deferred(),
      allowRead = deferred(),
      closed = deferred();
    async function createHost() {
      const storage = new LibSQLStore({ id: 'stop-shutdown-proof', url });
      await storage.init();
      const workflow = createWorkflow({ id: 'research', inputSchema: z.object({}), outputSchema: z.object({}) })
        .then(
          createStep({
            id: 'park',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            suspendSchema: z.object({ prompt: z.string() }),
            resumeSchema: z.object({ confirmed: z.boolean() }),
            execute: async ({ suspend }) => suspend({ prompt: 'Wait for the local user.' }),
          }),
        )
        .then(
          createStep({
            id: 'following',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            execute: async () => {
              calls.following++;
              return {};
            },
          }),
        )
        .commit();
      const agent = createDurableAgent({
        agent: new Agent({
          id: 'stop-shutdown-parent',
          name: 'Local parent',
          instructions: 'Use the local workflow.',
          memory: new Memory({ storage }),
          workflows: { research: workflow },
          model: {
            specificationVersion: 'v2',
            provider: 'local-fixture',
            modelId: 'unpaid',
            supportedUrls: {},
            doGenerate: async () => {
              throw new Error('No nonstreaming generation expected');
            },
            doStream: async () => {
              calls.model++;
              assert.equal(calls.model, 1, 'No further model call is allowed');
              return {
                stream: new ReadableStream({
                  start(controller) {
                    controller.enqueue({ type: 'stream-start', warnings: [] });
                    controller.enqueue({
                      type: 'tool-call',
                      toolCallId: 'research-call',
                      toolName: 'workflow-research',
                      input: '{"inputData":{}}',
                    });
                    controller.enqueue({
                      type: 'finish',
                      finishReason: 'tool-calls',
                      usage: { inputTokens: 1, outputTokens: 1 },
                    });
                    controller.close();
                  },
                }),
              };
            },
          },
        }),
      });

      const workspace = new Workspace({ id: 'proof-workspace', name: 'Local', skills: () => [] });
      const controller = new AgentController({
        id: 'proof-controller',
        agent,
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
      const mastra = new Mastra({
        agents: { agent },
        workflows: { research: workflow },
        storage,
        logger: false,
        agentControllers: { proof: controller },
        workers: false,
        scheduler: { enabled: false },
        recovery: { durableAgents: 'off' },
      });
      return { storage, agent, controller, mastra, workspace };
    }
    const assertOwner = (host: Awaited<ReturnType<typeof createHost>>, stage: string) => {
      const row = {
        stage,
        controller: host.controller.getMastra() === host.mastra,
        registered: host.mastra.getAgentController('proof') === host.controller,
        agent: host.agent.getMastraInstance() === host.mastra,
        registryAgent: host.mastra.getAgentById(host.agent.id).getMastraInstance() === host.mastra,
        storage: host.controller.getMastra()?.getStorage() === host.mastra.getStorage(),
      };
      identities.push(row);
      for (const [key, value] of Object.entries(row)) if (key !== 'stage') expect(value, key + ' ' + stage).toBe(true);
    };
    let host = await createHost();
    let shutdown: Promise<void> | undefined;
    let removeEvents = () => {};
    let parentRunId: string | undefined;
    let restoredRunId: string | null | undefined;
    let closedBeforeRelease: boolean | undefined;
    let afterRows: unknown;
    try {
      assertOwner(host, 'writer-before-init');
      await host.controller.init();
      assertOwner(host, 'writer-after-init');
      const session = await host.controller.createSession({
        ownerId: 'owner',
        resourceId: 'resource',
        workspace: host.workspace,
      });
      await session.thread.create();
      removeEvents = session.subscribe(event => {
        if (event.type === 'tool_approval_required') approval.resolve();
        if (event.type === 'tool_suspended') parked.resolve();
        if (event.type === 'agent_end') ended.resolve();
        if (event.type === 'error') errors.push(String(event.error));
      });
      const turn = session.sendMessage({ content: 'Park the local workflow.' });
      await bounded(approval.promise, 'native approval');
      session.respondToToolApproval({ decision: 'approve', toolCallId: 'research-call' });
      await bounded(Promise.all([parked.promise, ended.promise, turn]), 'native parked turn');
      const threadId = session.thread.getId()!;
      const writerStore = await host.storage.getStore('workflows');
      assert(writerStore);
      const beforeRows = await writerStore.listWorkflowRuns({});
      const parent = beforeRows.runs.find(row => row.workflowName === 'durable-agentic-loop');
      assert(parent);
      parentRunId = parent.runId;
      expect(beforeRows.runs.filter(row => row.snapshot?.status === 'suspended')).toHaveLength(3);
      removeEvents();
      await bounded(host.mastra.shutdown(), 'writer normal shutdown');
      order.push('writer-shutdown-finished');

      const oldHost = host;
      host = await createHost();
      expect(host.mastra).not.toBe(oldHost.mastra);
      expect(host.agent).not.toBe(oldHost.agent);
      expect(host.storage).not.toBe(oldHost.storage);
      assertOwner(host, 'restored-before-init');
      await host.controller.init();
      assertOwner(host, 'restored-after-init');
      const fresh = await host.controller.createSession({
        ownerId: 'owner',
        resourceId: 'resource',
        workspace: host.workspace,
      });
      removeEvents = fresh.subscribe(event => {
        if (event.type === 'error') errors.push(String(event.error));
      });
      await fresh.thread.switch({ threadId });
      restoredRunId = fresh.getCurrentRunId();
      expect(restoredRunId).toBeNull();
      expect(host.controller.getCurrentAgent(fresh).getMastraInstance()).toBe(host.mastra);
      const store = await host.storage.getStore('workflows');
      assert(store);
      const restoredRows = await store.listWorkflowRuns({});
      expect(restoredRows.runs.filter(row => row.snapshot?.status === 'suspended')).toHaveLength(3);
      if (boundary === 'late-stop') {
        const currentAgent = host.controller.getCurrentAgent(fresh);
        const suspended = vi.spyOn(currentAgent, 'listSuspendedRuns');
        const active = vi.spyOn(currentAgent, 'listActiveRuns');
        await host.mastra.shutdown();
        fresh.abortRun();
        await delay(20);
        expect(suspended).not.toHaveBeenCalled();
        expect(active).not.toHaveBeenCalled();
        expect(errors).toContainEqual(expect.stringContaining('cancellation admission is closed'));
        expect(calls).toEqual({ model: 1, following: 0, network: 0 });
        return;
      }
      if (boundary === 'discovery-error') {
        const currentAgent = host.controller.getCurrentAgent(fresh);
        const active = currentAgent.listActiveRuns.bind(currentAgent);
        vi.spyOn(currentAgent, 'listSuspendedRuns').mockRejectedValueOnce(failure);
        vi.spyOn(currentAgent, 'listActiveRuns').mockImplementationOnce(async input => {
          readEntered.resolve();
          await allowRead.promise;
          return active(input);
        });
      } else if (boundary === 'discovery') {
        const currentAgent = host.controller.getCurrentAgent(fresh);
        const discover = currentAgent.listSuspendedRuns.bind(currentAgent);
        vi.spyOn(currentAgent, 'listSuspendedRuns').mockImplementationOnce(async input => {
          readEntered.resolve();
          await allowRead.promise;
          return discover(input);
        });
      } else if (boundary === 'snapshot') {
        const load = store.loadWorkflowSnapshot.bind(store);
        vi.spyOn(store, 'loadWorkflowSnapshot').mockImplementationOnce(async input => {
          readEntered.resolve();
          await allowRead.promise;
          return load(input);
        });
      } else {
        const update = store.updateWorkflowState.bind(store);
        vi.spyOn(store, 'updateWorkflowState').mockImplementationOnce(async input => {
          readEntered.resolve();
          await allowRead.promise;
          if (shouldFail) throw failure;
          return update(input);
        });
      }
      const close = host.storage.close.bind(host.storage);
      vi.spyOn(host.storage, 'close').mockImplementation(async () => {
        order.push('storage-close-start');
        await close();
        order.push('storage-close-finished');
        closed.resolve();
      });
      assertOwner(host, 'before-stop');
      fresh.abortRun();
      await bounded(readEntered.promise, 'Stop reaching real saved run read');
      assertOwner(host, 'before-shutdown');
      shutdown = host.mastra.shutdown().then(() => {
        order.push('shutdown-finished');
      });
      const completion = shouldFail ? expect(shutdown).rejects.toBeInstanceOf(AggregateError) : shutdown;
      closedBeforeRelease = await Promise.race([closed.promise.then(() => true), delay(150).then(() => false)]);
      order.push('release-storage-read');
      allowRead.resolve();
      await bounded(completion, 'shutdown after released read');
      expect(closedBeforeRelease).toBe(false);
      expect(calls).toEqual({ model: 1, following: 0, network: 0 });
      const reader = new LibSQLStore({ id: 'readback', url });
      try {
        await reader.init();
        const readback = await reader.getStore('workflows');
        assert(readback);
        afterRows = (await readback.listWorkflowRuns({})).runs.map(row => ({
          workflowName: row.workflowName,
          runId: row.runId,
          status: row.snapshot?.status,
        }));
        const pendingRows = (afterRows as Array<{ status?: string }>).filter(row =>
          ['running', 'pending', 'waiting', 'suspended'].includes(row.status ?? ''),
        );
        expect(pendingRows).toHaveLength(shouldFail ? 3 : 0);
        if (shouldFail) expect(errors.length).toBeGreaterThan(0);
      } finally {
        await reader.close();
      }
    } finally {
      allowRead.resolve();
      removeEvents();
      if (shutdown)
        await bounded(
          shutdown.catch(error => {
            errors.push(String(error));
          }),
          'cleanup shutdown',
        );
      else await host.mastra.shutdown();
      writeFileSync(
        path.join(directory, 'result.json'),
        JSON.stringify(
          {
            scope:
              'registered cold owner public Session abortRun and Mastra shutdown; real file LibSQL; real read hold',
            calls,
            order,
            identities,
            errors,
            parentRunId,
            restoredRunId,
            closedBeforeRelease,
            afterRows,
          },
          null,
          2,
        ),
      );
    }
  },
  15000,
);

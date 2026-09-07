// Real saved-run overlap: no fabricated rows or private cancellation calls.
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
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { submitPlanTool } from '../../tools/builtin/submit-plan';
import { Workspace } from '../../workspace';
import { AgentController } from '../agent-controller';

function nativeAgent(value: unknown) {
  if (!(value instanceof Agent)) throw new Error('Expected the same native Agent object');
  return value;
}
function errorInfo(value: unknown): unknown {
  if (value instanceof AggregateError)
    return { name: value.name, message: value.message, errors: value.errors.map(errorInfo) };
  if (value instanceof Error)
    return {
      name: value.name,
      message: value.message,
      id: 'id' in value ? value.id : undefined,
      cause: value.cause ? errorInfo(value.cause) : undefined,
    };
  return String(value);
}
function errorIds(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(errorIds);
  const record = value as Record<string, unknown>;
  return [
    ...(typeof record.id === 'string' ? [record.id] : []),
    ...Object.entries(record)
      .filter(([key]) => key !== 'id')
      .flatMap(([, child]) => errorIds(child)),
  ];
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('direct saved Stop retains lease loss without publishing a terminal error', async () => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'mastra-stop-restoration-lease-loss-'));
  const url = pathToFileURL(path.join(directory, 'native.db')).href;
  const calls = { model: 0, network: 0 };
  const deny = () => {
    calls.network++;
    throw new Error('Unexpected network');
  };
  vi.stubGlobal('fetch', vi.fn(deny));
  vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(deny as never);
  vi.spyOn(dns, 'lookup').mockImplementation(deny as never);
  const outputs: unknown[] = [];
  const terminalErrors: unknown[] = [];
  let holdMemory = false;
  let enteredMemory = () => {};
  const memoryEntered = new Promise<void>(resolve => {
    enteredMemory = resolve;
  });
  let releaseMemory = () => {};
  const memoryGate = new Promise<void>(resolve => {
    releaseMemory = resolve;
  });
  async function createHost() {
    const storage = new LibSQLStore({ id: 'stop-lease-loss', url });
    await storage.init();
    const memory = new Memory({ storage });
    const pubsub = new EventEmitterPubSub();
    const agent = createDurableAgent({
      agent: new Agent({
        id: 'stop-lease-agent',
        name: 'Stop lease agent',
        instructions: 'Submit the local plan.',
        model: new MastraLanguageModelV2Mock({
          doStream: async () => {
            calls.model++;
            if (calls.model !== 1) throw new Error('Stop must not invoke another model call');
            return {
              stream: new ReadableStream({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: 'lease-plan-call',
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
              }),
            };
          },
        }),
        memory: async () => {
          if (holdMemory) {
            enteredMemory();
            await memoryGate;
          }
          return memory;
        },
        tools: { submit_plan: submitPlanTool },
        outputProcessors: [
          {
            id: 'lease-output-observer',
            processOutputResult({ messageList, result }) {
              outputs.push({ finishReason: result.finishReason, usage: result.usage });
              return messageList;
            },
          },
        ],
      }),
    });
    const workspace = new Workspace({ name: 'Stop lease proof', skills: () => [] });
    const controller = new AgentController({
      id: 'stop-lease-controller',
      storage,
      workspace,
      initialState: { yolo: true },
      agent: nativeAgent(agent),
      modes: [{ id: 'web', name: 'Web', default: true }],
    });
    const mastra = new Mastra({
      agents: { agent },
      agentControllers: { proof: controller },
      storage,
      pubsub,
      logger: false,
      workers: false,
      scheduler: { enabled: false },
      recovery: { durableAgents: 'off' },
    });
    await controller.init();
    expect(controller.getMastra()).toBe(mastra);
    expect(mastra.getAgentController('proof')).toBe(controller);
    expect(agent.getMastraInstance()).toBe(mastra);
    return { storage, agent, controller, workspace, mastra, pubsub };
  }
  const hosts: Awaited<ReturnType<typeof createHost>>[] = [];
  const rows = async (storage: LibSQLStore) =>
    (await (await storage.getStore('workflows'))!.listWorkflowRuns({})).runs.map(row => {
      const snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
      return { workflowName: row.workflowName, runId: row.runId, status: snapshot?.status };
    });
  try {
    const writer = await createHost();
    hosts.push(writer);
    const sessionInput = { id: 'stop-lease-session', ownerId: 'owner', resourceId: 'resource' };
    const session = await writer.controller.createSession({ ...sessionInput, workspace: writer.workspace });
    const threadId = (await session.thread.create()).id;
    await session.sendMessage({ content: 'Create a plan.' });
    await vi.waitFor(async () => {
      const saved = await rows(writer.storage);
      expect(saved).toHaveLength(2);
      expect(saved.every(row => row.status === 'suspended')).toBe(true);
    });
    const beforeRows = await rows(writer.storage);
    const runId = beforeRows.find(row => row.workflowName === 'durable-agentic-loop')!.runId;
    await writer.mastra.shutdown();
    const fresh = await createHost();
    hosts.push(fresh);
    expect(fresh.mastra).not.toBe(writer.mastra);
    expect(fresh.agent).not.toBe(writer.agent);
    expect(fresh.storage).not.toBe(writer.storage);
    const reopened = await fresh.controller.createSession({ ...sessionInput, workspace: fresh.workspace });
    expect(reopened.thread.getId()).toBe(threadId);
    expect(reopened.getCurrentRunId()).toBe(null);
    expect(reopened.suspensions.hasPending()).toBe(false);
    const topic = `agent.stream.${runId}`;
    await fresh.agent.pubsub.subscribe(topic, async event => {
      if (event.type === 'error') terminalErrors.push(event);
    });
    const actualRenew = fresh.pubsub.renewLease.bind(fresh.pubsub);
    const renew = vi
      .spyOn(fresh.pubsub, 'renewLease')
      .mockImplementation(async (key, owner, ttlMs) =>
        key.startsWith('mastra:durable-agent-recovery:') ? false : actualRenew(key, owner, ttlMs),
      );
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    holdMemory = true;
    fresh.agent.abortRunStream(runId);
    await memoryEntered;
    // Use the same renewal interval as the existing native recovery fault tests.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(renew.mock.calls.filter(([key]) => key.startsWith('mastra:durable-agent-recovery:'))).toHaveLength(1);
    releaseMemory();
    const shutdown = await Promise.allSettled([fresh.mastra.shutdown()]);
    expect(shutdown[0]!.status).toBe('rejected');
    const outcome = shutdown[0]!;
    if (outcome.status !== 'rejected') throw new Error('Lease loss must reject cancellation');
    expect(errorIds(errorInfo(outcome.reason))).toEqual(['DURABLE_AGENT_RECOVER_LEASE_LOST']);
    const reader = new LibSQLStore({ id: 'stop-lease-readback', url });
    await reader.init();
    try {
      expect(await rows(reader)).toEqual(beforeRows);
    } finally {
      await reader.close();
    }
    expect(outputs).toEqual([]);
    expect(terminalErrors).toEqual([]);
    expect(calls).toEqual({ model: 1, network: 0 });
  } finally {
    releaseMemory();
    await Promise.allSettled(hosts.map(host => host.mastra.shutdown()));
  }
});

it.each(['session', 'agent'] as const)('concurrent saved Stop isolates the winning run: %s', async entrypoint => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), `mastra-stop-restoration-${entrypoint}-`));
  const url = pathToFileURL(path.join(directory, 'native.db')).href;
  const calls = { model: 0, network: 0 };
  const deny = () => {
    calls.network++;
    throw new Error('Unexpected network');
  };
  vi.stubGlobal('fetch', vi.fn(deny));
  vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(deny as never);
  vi.spyOn(dns, 'lookup').mockImplementation(deny as never);
  const receipt = {
    node: process.version,
    entrypoint,
    directory,
    calls,
    runTopicErrors: [] as unknown[],
    owners: [] as unknown[],
    events: [] as unknown[],
    outputs: [] as unknown[],
    heldReads: [] as Array<{ host: string; workflowName: string; runId: string; status: string; at: string }>,
    beforeRows: [] as unknown[],
    afterRows: [] as unknown[],
    messages: [] as unknown[],
    shutdowns: [] as unknown[],
    failure: undefined as unknown,
  };
  async function createHost(label: string) {
    const storage = new LibSQLStore({ id: 'two-host-stop-proof', url });
    await storage.init();
    const agent = createDurableAgent({
      agent: new Agent<string, { submit_plan: typeof submitPlanTool }, any>({
        id: 'shared-plan-agent',
        name: 'Shared plan agent',
        instructions: 'Submit the local plan.',
        model: new MastraLanguageModelV2Mock({
          doStream: async () => {
            const call = ++calls.model;
            if (call !== 1) throw new Error('Stop must not invoke another model call');
            return {
              stream: new ReadableStream({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  controller.enqueue({
                    type: 'response-metadata',
                    id: 'local-model-1',
                    modelId: 'mock',
                    timestamp: new Date(0),
                  });
                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: 'shared-plan-call',
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
              }),
            };
          },
        }),
        memory: new Memory({ storage }),
        tools: { submit_plan: submitPlanTool },
        outputProcessors: [
          {
            id: 'stop-observer',
            processOutputResult({ messageList, result }) {
              receipt.outputs.push({ host: label, finishReason: result.finishReason, usage: result.usage });
              return messageList;
            },
          },
        ],
      }),
    });
    const workspace = new Workspace({ name: 'Two-host Stop proof', skills: () => [] });
    const controller = new AgentController({
      id: 'shared-stop-controller',
      storage,
      workspace,
      initialState: { yolo: true },
      agent: nativeAgent(agent),
      modes: [{ id: 'web', name: 'Web', default: true }],
    });
    const mastra = new Mastra({
      agents: { agent },
      agentControllers: { proof: controller },
      storage,
      logger: false,
      workers: false,
      scheduler: { enabled: false },
      recovery: { durableAgents: 'off' },
    });
    await controller.init();
    const checks = {
      controller: controller.getMastra() === mastra,
      registered: mastra.getAgentController('proof') === controller,
      agent: agent.getMastraInstance() === mastra,
      storage: controller.getMastra()?.getStorage() === mastra.getStorage(),
    };
    receipt.owners.push({ host: label, ...checks });
    expect(Object.values(checks).every(Boolean)).toBe(true);
    return { label, storage, agent, workspace, controller, mastra };
  }
  type Host = Awaited<ReturnType<typeof createHost>>;
  const hosts: Host[] = [];
  const topicUnsubscribers: Array<() => Promise<void>> = [];
  const rowView = async (storage: LibSQLStore) => {
    const rows = (await (await storage.getStore('workflows'))!.listWorkflowRuns({})).runs;
    return rows.map(row => {
      const snap = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
      return { workflowName: row.workflowName, runId: row.runId, status: snap?.status, resourceId: row.resourceId };
    });
  };
  let release = () => {};
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  try {
    const writer = await createHost('writer');
    hosts.push(writer);
    const sessionInput = { id: 'shared-stop-session', ownerId: 'owner', resourceId: 'resource' };
    const warm = await writer.controller.createSession({ ...sessionInput, workspace: writer.workspace });
    const threadId = (await warm.thread.create()).id;
    await warm.sendMessage({ content: 'Create a plan.' });
    await vi.waitFor(
      async () => {
        receipt.beforeRows = await rowView(writer.storage);
        expect(receipt.beforeRows).toHaveLength(2);
        expect(receipt.beforeRows.every((row: any) => row.status === 'suspended')).toBe(true);
      },
      { timeout: 4000, interval: 20 },
    );
    const runId = (receipt.beforeRows as any[]).find(row => row.workflowName === 'durable-agentic-loop').runId;
    await writer.mastra.shutdown();
    const a = await createHost('host-a');
    hosts.push(a);
    const b = await createHost('host-b');
    hosts.push(b);
    for (const key of ['mastra', 'controller', 'agent', 'storage'] as const) expect(a[key]).not.toBe(b[key]);
    const sessions = await Promise.all(
      [a, b].map(async host => {
        const session = await host.controller.createSession({ ...sessionInput, workspace: host.workspace });
        expect(session.thread.getId()).toBe(threadId);
        expect(session.getCurrentRunId()).toBe(null);
        expect(session.suspensions.hasPending()).toBe(false);
        session.subscribe(event => {
          if (event.type === 'error' || event.type === 'agent_end')
            receipt.events.push({ host: host.label, type: event.type, error: errorInfo((event as any).error) });
        });
        const topic = 'agent.stream.' + runId;
        const observe = async (event: any) => {
          if (event.type === 'error')
            receipt.runTopicErrors.push({ host: host.label, type: event.type, data: event.data });
        };
        await host.agent.pubsub.subscribe(topic, observe);
        topicUnsubscribers.push(() => host.agent.pubsub.unsubscribe(topic, observe));
        const store = (await host.storage.getStore('workflows'))!;
        const actualRead = store.loadWorkflowSnapshot.bind(store);
        let heldOnce = false;
        vi.spyOn(store, 'loadWorkflowSnapshot').mockImplementation(async input => {
          const result = await actualRead(input);
          if (!heldOnce && input.workflowName === 'durable-agentic-loop' && input.runId === runId) {
            heldOnce = true;
            receipt.heldReads.push({
              host: host.label,
              workflowName: input.workflowName,
              runId,
              status: result?.status ?? 'missing',
              at: new Date().toISOString(),
            });
            await held;
          }
          return result;
        });
        return session;
      }),
    );
    if (entrypoint === 'session') {
      sessions[0]!.abort();
      sessions[1]!.abort();
    } else {
      a.agent.abortRunStream(runId);
      b.agent.abortRunStream(runId);
    }
    await vi.waitFor(() => expect(receipt.heldReads).toHaveLength(2), { timeout: 4000, interval: 10 });
    expect(receipt.heldReads.map(read => read.host).sort()).toEqual(['host-a', 'host-b']);
    expect(receipt.heldReads.every(read => read.runId === runId && read.status === 'suspended')).toBe(true);
    expect(receipt.outputs).toEqual([]);
    release();
    const shutdowns = await Promise.allSettled([a.mastra.shutdown(), b.mastra.shutdown()]);
    receipt.shutdowns = shutdowns.map((result, i) => ({
      host: i === 0 ? 'host-a' : 'host-b',
      status: result.status,
      ...(result.status === 'rejected' ? { error: errorInfo(result.reason) } : {}),
    }));
    const reader = new LibSQLStore({ id: 'two-host-readback', url });
    await reader.init();
    try {
      receipt.afterRows = await rowView(reader);
      receipt.messages = (await new Memory({ storage: reader }).recall({ threadId, resourceId: 'resource' })).messages;
    } finally {
      await reader.close();
    }
    expect(calls).toEqual({ model: 1, network: 0 });
    expect(receipt.runTopicErrors).toEqual([]);
    const rejected = receipt.shutdowns.filter((item: any) => item.status === 'rejected');
    const completed = receipt.shutdowns.filter((item: any) => item.status === 'fulfilled');
    expect(rejected).toHaveLength(1);
    expect(completed).toHaveLength(1);
    expect(errorIds(rejected)).toEqual(['DURABLE_AGENT_RECOVER_ALREADY_IN_PROGRESS']);
    const errors = receipt.events.filter((item: any) => item.type === 'error');
    if (entrypoint === 'session') {
      expect(errors).toHaveLength(1);
      expect(errorIds(errors)).toEqual(['DURABLE_AGENT_RECOVER_ALREADY_IN_PROGRESS']);
      expect((errors[0] as any).host).toBe((rejected[0] as any).host);
    } else {
      expect(errors).toEqual([]);
    }
    expect(receipt.outputs).toHaveLength(1);
    expect(receipt.outputs[0]).toMatchObject({
      finishReason: 'abort',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    });
    expect(receipt.afterRows).toEqual([]);
    for (const message of receipt.messages as any[]) {
      expect(message.content.metadata?.suspendedTools?.['shared-plan-call']).toBeUndefined();
      expect(message.content.metadata?.pendingToolApprovals?.['shared-plan-call']).toBeUndefined();
    }
  } catch (error) {
    receipt.failure = errorInfo(error);
    throw error;
  } finally {
    release();
    await Promise.allSettled(hosts.map(host => host.mastra.shutdown()));
    await Promise.allSettled(topicUnsubscribers.map(unsubscribe => unsubscribe()));
    fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify(receipt, null, 2) + '\n');
  }
});

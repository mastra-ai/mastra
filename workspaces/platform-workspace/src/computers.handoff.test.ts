import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryNotificationsStorage } from '@mastra/core/notifications';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { MastraCompositeStore } from '@mastra/core/storage';
import { WORKSPACE_TOOLS, Workspace, createWorkspaceTools } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComputerSandbox } from './computers.js';
import { PlatformComputers } from './computers.js';

const R = 'user-1';
const T = 'thread-1';
const scope = { resourceId: R, threadId: T };
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

type Step = { tools?: { toolName: string; input: unknown }[]; text?: string; before?: () => Promise<void> };

/** A streaming model that plays `steps` in order and records every prompt it was given. */
function scriptedModel(steps: Step[]) {
  const prompts: string[] = [];
  let i = 0;
  const model = {
    specificationVersion: 'v2' as const,
    provider: 'test',
    modelId: 'scripted',
    supportedUrls: {},
    doGenerate: async () => {
      throw new Error('not used');
    },
    doStream: async (options: { prompt: unknown }) => {
      prompts.push(JSON.stringify(options.prompt));
      const step = steps[i++] ?? { text: 'idle' };
      await step.before?.();
      const parts: unknown[] = step.tools
        ? [
            ...step.tools.map((c, n) => ({
              type: 'tool-call',
              toolCallId: `call_${i}_${n}`,
              toolName: c.toolName,
              input: JSON.stringify(c.input),
            })),
            { type: 'finish', finishReason: 'tool-calls', usage },
          ]
        : [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: step.text ?? 'ok' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage },
          ];
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const p of parts) controller.enqueue(p);
            controller.close();
          },
        }),
      };
    },
  };
  return { model, prompts };
}

function gate() {
  let enter!: () => void;
  let open!: () => void;
  const entered = new Promise<void>(r => (enter = r));
  const opened = new Promise<void>(r => (open = r));
  return { entered, enter, opened, open };
}

class Driver {
  actions: string[] = [];
  gates: Record<string, ReturnType<typeof gate>> = {};
  create = (): ComputerSandbox => {
    const d = this;
    const act = async (name: string) => {
      const g = d.gates[name];
      if (g) {
        delete d.gates[name];
        g.enter();
        await g.opened;
      }
      d.actions.push(name);
    };
    return {
      sandboxId: 'sbx-1',
      start: async () => {},
      destroy: async () => {},
      captureCheckpoint: async () => ({ status: 'captured' }) as any,
      executeCommand: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
      getPortAuthCookie: async () => null,
      computer: {
        screenshot: async () => {
          await act('screenshot');
          return { data: new Uint8Array([1]), mediaType: 'image/png' as const };
        },
        leftClick: async () => act('click'),
        rightClick: async () => act('rightClick'),
        doubleClick: async () => act('doubleClick'),
        moveMouse: async () => act('move'),
        drag: async () => act('drag'),
        scroll: async () => act('scroll'),
        type: async () => act('type'),
        press: async () => act('key'),
        getScreenSize: async () => ({ width: 1024, height: 640 }),
        getCursorPosition: async () => ({ x: 0, y: 0 }),
      } as any,
    };
  };
}

let driver: Driver;

beforeEach(() => {
  process.env.MASTRA_EXPERIMENTAL_COMPUTER = 'true';
  driver = new Driver();
});
afterEach(() => {
  delete process.env.MASTRA_EXPERIMENTAL_COMPUTER;
  vi.restoreAllMocks();
});

async function setup(steps: Step[], options: { notifications?: boolean; agentConfig?: Record<string, unknown> } = {}) {
  const computers = new PlatformComputers({ secret: 's', environmentId: 'e', createSandbox: driver.create });
  const { model, prompts } = scriptedModel(steps);
  const agent = new Agent({
    id: 'desk',
    name: 'desk',
    instructions: 'Use the computer.',
    model: model as any,
    memory: new MockMemory(),
    tools: {
      ...computers.tools(),
      ...(await createWorkspaceTools(new Workspace({ sandbox: computers.sandboxResolver(), computerTools: 'resolve' }))),
    },
    ...options.agentConfig,
  });
  const storage = new MastraCompositeStore({
    id: 'handoff',
    domains: { notifications: new InMemoryNotificationsStorage() },
  });
  const mastra = new Mastra({ agents: { desk: agent }, storage, computers, logger: false });
  if (options.notifications === false) {
    // Storage that has no notifications domain.
    vi.spyOn(mastra, 'getStorage').mockReturnValue({ getStore: async () => undefined } as any);
  }
  const sent: { input: any; target: any; result: any }[] = [];
  const original = agent.sendNotificationSignal.bind(agent);
  vi.spyOn(agent as any, 'sendNotificationSignal').mockImplementation(async (input: any, target: any) => {
    const result = await original(input, target);
    sent.push({ input, target, result });
    return result;
  });
  return { computers, agent, prompts, sent };
}

function rc() {
  const context = new RequestContext();
  context.set(MASTRA_RESOURCE_ID_KEY, R);
  context.set(MASTRA_THREAD_ID_KEY, T);
  return context;
}

async function runToEnd(agent: Agent) {
  const out = await agent.stream('please log in to the site', {
    maxSteps: 5,
    memory: { thread: T, resource: R },
    requestContext: rc(),
  });
  await out.consumeStream();
  return out;
}

/** Reads the subscribed thread stream until one run finishes. */
async function nextRun(iterator: AsyncIterator<any>) {
  const parts: any[] = [];
  let runId: string | undefined;
  while (true) {
    const next = await iterator.next();
    if (next.done) throw new Error('stream ended');
    parts.push(next.value);
    runId ??= next.value.runId;
    if (['finish', 'error', 'abort'].includes(next.value.type)) return { runId, parts };
  }
}

const computerIdOf = async (computers: PlatformComputers) => {
  const listed = await (computers.tools().mastra_workspace_computer_list as any).execute(
    {},
    { agent: { resourceId: R, threadId: T } },
  );
  return listed.computers[0].id as string;
};

describe('control handoff through a real agent', () => {
  it('hand back wakes the idle agent into a new run that continues on the computer', async () => {
    const { computers, agent, prompts, sent } = await setup([
      { tools: [{ toolName: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.CREATE, input: {} }] },
      { tools: [{ toolName: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.REQUEST_HUMAN, input: { reason: 'please log in' } }] },
      { text: 'Waiting for you to log in.' },
      { tools: [{ toolName: WORKSPACE_TOOLS.COMPUTER.SCREENSHOT, input: {} }] },
      { text: 'Logged in, continuing.' },
    ]);
    const first = await runToEnd(agent);
    const id = await computerIdOf(computers);
    await expect(computers.controlState(id, scope)).resolves.toEqual({ holder: 'human', reason: 'please log in', revision: 1 });

    const subscription = await agent.subscribeToThread({ threadId: T, resourceId: R });
    expect(subscription.activeRunId()).toBeNull();
    const woken = nextRun(subscription.stream[Symbol.asyncIterator]());

    await expect(computers.control(id, scope, { action: 'release', note: 'done' })).resolves.toEqual({
      holder: 'agent',
      revision: 2,
      notified: true,
    });
    const run = await woken;
    expect(run.runId).toBeDefined();
    expect(run.runId).not.toBe(first.runId);
    await expect(sent[0]!.result.accepted).resolves.toMatchObject({ action: 'wake', runId: run.runId });

    const signal = run.parts.find(p => p.type === 'data-signal');
    expect(signal?.data).toMatchObject({
      type: 'notification',
      contents: 'The user handed control back: done',
      attributes: { source: 'computer', kind: 'control-returned', priority: 'urgent', computerId: id },
    });
    expect(prompts[3]).toContain('The user handed control back: done');
    expect(driver.actions).toEqual(['screenshot']);
    subscription.unsubscribe();
  });

  it('a take while the agent is active is delivered into the running turn', async () => {
    const click = gate();
    driver.gates.click = click;
    const { computers, agent, prompts, sent } = await setup([
      { tools: [{ toolName: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.CREATE, input: {} }] },
      { tools: [{ toolName: WORKSPACE_TOOLS.COMPUTER.CLICK, input: { x: 1, y: 1 } }] },
      { tools: [{ toolName: WORKSPACE_TOOLS.COMPUTER.TYPE, input: { text: 'x' } }] },
      { text: 'Okay, the user has it.' },
    ]);
    const out = await agent.stream('go', { maxSteps: 6, memory: { thread: T, resource: R }, requestContext: rc() });
    const consumed = out.consumeStream();
    await click.entered;
    const id = await computerIdOf(computers);
    const taken = computers.control(id, scope, { action: 'take' });
    // The human's take answers while the agent's click is still in flight.
    await expect(taken).resolves.toEqual({ holder: 'human', revision: 1, notified: true });
    click.open();
    await expect(sent[0]!.result.accepted).resolves.toMatchObject({ action: 'deliver' });
    await consumed;

    const delivered = prompts.findIndex(p => p.includes('The user took control of the computer'));
    expect(delivered).toBeGreaterThan(1);
    expect(driver.actions).toEqual(['click']);
    const results = (await out.toolResults) as any[];
    const typed = results.find(r => (r.payload?.toolName ?? r.toolName) === WORKSPACE_TOOLS.COMPUTER.TYPE);
    expect(typed).toBeUndefined();
    await expect(computers.controlState(id, scope)).resolves.toMatchObject({ holder: 'human', revision: 1 });
    expect(sent[0]!.result.record).toMatchObject({ status: 'delivered' });
  });

  it('a hand back racing the end of the run is processed exactly once', async () => {
    const last = gate();
    const { computers, agent, prompts, sent } = await setup([
      { tools: [{ toolName: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.CREATE, input: {} }] },
      { tools: [{ toolName: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.REQUEST_HUMAN, input: { reason: 'r' } }] },
      {
        text: 'Waiting.',
        before: async () => {
          last.enter();
          await last.opened;
        },
      },
      { text: 'Continuing.' },
    ]);
    const subscription = await agent.subscribeToThread({ threadId: T, resourceId: R });
    const runs: string[] = [];
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const watch = (async () => {
      while (runs.length < 3) {
        const run = await nextRun(iterator).catch(() => undefined);
        if (!run) return;
        runs.push(run.runId!);
      }
    })();
    const out = await agent.stream('go', { maxSteps: 6, memory: { thread: T, resource: R }, requestContext: rc() });
    const consumed = out.consumeStream();
    await last.entered;
    const id = await computerIdOf(computers);
    const released = await computers.control(id, scope, { action: 'release' });
    last.open();
    await consumed;
    expect(released).toEqual({ holder: 'agent', revision: 2, notified: true });
    const accepted = await sent[0]!.result.accepted;
    expect(['wake', 'deliver']).toContain(accepted.action);
    await vi.waitFor(() => expect(prompts.filter(p => p.includes('The user handed control back')).length).toBe(1));
    await new Promise(r => setTimeout(r, 50));
    expect(prompts.filter(p => p.includes('The user handed control back'))).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(new Set(runs).size).toBeLessThanOrEqual(accepted.action === 'wake' ? 2 : 1);
    subscription.unsubscribe();
    await watch.catch(() => {});
  });

  it('always sends urgent with an explicit wake (high can map to a non-waking summary)', async () => {
    const { computers, agent, sent } = await setup([
      { tools: [{ toolName: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.CREATE, input: {} }] },
      { text: 'ready' },
      { text: 'woken' },
      { text: 'woken again' },
    ]);
    await runToEnd(agent);
    const id = await computerIdOf(computers);
    await computers.control(id, scope, { action: 'take' });
    await computers.control(id, scope, { action: 'release' });
    expect(sent).toHaveLength(2);
    for (const { input, target } of sent) {
      expect(input).toMatchObject({ source: 'computer', priority: 'urgent', attributes: { computerId: id } });
      expect(target).toMatchObject({
        resourceId: R,
        threadId: T,
        ifIdle: { behavior: 'wake', streamOptions: { memory: { thread: T, resource: R } } },
      });
    }
    expect(sent.map(s => s.input.kind)).toEqual(['control-taken', 'control-returned']);
  });

  it('reports not-delivered when a delivery policy persists computer notifications', async () => {
    const { computers, agent } = await setup(
      [{ tools: [{ toolName: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.CREATE, input: {} }] }, { text: 'ready' }],
      { agentConfig: { notifications: { deliveryPolicy: { sources: { computer: 'persist' } } } } },
    );
    await runToEnd(agent);
    const id = await computerIdOf(computers);
    await expect(computers.control(id, scope, { action: 'take' })).resolves.toEqual({
      holder: 'human',
      revision: 1,
      notified: false,
      reason: 'not-delivered',
    });
    await expect(computers.control(id, scope, { action: 'release' })).resolves.toMatchObject({
      holder: 'agent',
      notified: false,
    });
    await expect(computers.controlState(id, scope)).resolves.toEqual({ holder: 'agent', revision: 2 });
  });

  it('keeps the lease change without notifications storage', async () => {
    const { computers, agent } = await setup(
      [{ tools: [{ toolName: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.CREATE, input: {} }] }, { text: 'ready' }],
      { notifications: false },
    );
    await runToEnd(agent);
    const id = await computerIdOf(computers);
    await expect(computers.control(id, scope, { action: 'take' })).resolves.toEqual({
      holder: 'human',
      revision: 1,
      notified: false,
      reason: 'no-notifications-storage',
    });
  });

  it('reports no-agent when no agent has used the computer on this thread', async () => {
    const computers = new PlatformComputers({ secret: 's', environmentId: 'e', createSandbox: driver.create });
    await (computers.tools().mastra_workspace_computer_create as any).execute({}, { agent: { resourceId: R, threadId: T } });
    const id = await computerIdOf(computers);
    await expect(computers.control(id, scope, { action: 'take' })).resolves.toEqual({
      holder: 'human',
      revision: 1,
      notified: false,
      reason: 'no-agent',
    });
  });
});

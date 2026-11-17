import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import type { Session } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { askUserTool } from '@mastra/core/tools';
import { LocalSandbox, Workspace } from '@mastra/core/workspace';
import { createHonoServer } from '@mastra/deployer/server';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createSessionAsRowOwner } from '../integrations/subscription-session.js';
import { FactoryWorkspaceRegistry } from '../workspace.js';
import { createSessionActivityMiddleware, SessionUnloader } from './session-unloader.js';

vi.setConfig({ testTimeout: 30_000 });

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function replyStream(text: string, gate?: Promise<void>) {
  return new ReadableStream({
    async start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-text', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
      await gate;
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
      controller.close();
    },
  });
}

function askUserStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-ask', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-ask',
        toolName: 'ask_user',
        input: JSON.stringify({ question: 'Ship it?' }),
        providerExecuted: false,
      });
      controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage });
      controller.close();
    },
  });
}

/**
 * A real controller over real thread memory. The model answers by the last prompt message:
 * `HOLD` streams until `release()`, `ASK` parks on `ask_user`, anything else replies at once.
 */
async function mountController(workspace?: Workspace) {
  let release = () => {};
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  const model = new MastraLanguageModelV2Mock({
    doStream: async ({ prompt }) => {
      const last = prompt.at(-1);
      const text = last?.role === 'user' ? JSON.stringify(last.content) : '';
      if (text.includes('HOLD')) return { stream: replyStream('Working.', held) };
      if (text.includes('ASK')) return { stream: askUserStream() };
      return { stream: replyStream('Done.') };
    },
  });
  const store = new InMemoryStore();
  const agent = new Agent({
    id: 'coder',
    name: 'coder',
    instructions: 'Write code.',
    model,
    tools: { ask_user: askUserTool },
    memory: new MockMemory({ storage: store }),
  });
  const mastra = new Mastra({ agents: { coder: agent }, logger: false, storage: store });
  const controller = new AgentController({
    workspace: workspace ?? new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    id: 'code',
    storage: store,
    modes: [{ id: 'build', name: 'Build', default: true, agent: mastra.getAgent('coder') }],
    // No approval prompt first, so `ask_user` parks on its question.
    initialState: { yolo: true } as never,
  });
  await controller.init();
  return { controller, store, release };
}

type Mounted = Awaited<ReturnType<typeof mountController>>;

/** A session that has had one finished turn, so its thread and messages are in storage. */
async function sessionWithHistory(controller: AgentController<any>, id: string): Promise<Session<any>> {
  const session = await controller.createSession({ id, resourceId: 'factory-project-1', ownerId: 'user-1' });
  await session.thread.create({ id });
  await session.sendMessage({ content: `Hello from ${id}.` });
  return session;
}

function clockedUnloader(mounted: Mounted, options: { idleMs?: number; registry?: FactoryWorkspaceRegistry } = {}) {
  let now = 0;
  const registry = options.registry ?? new FactoryWorkspaceRegistry();
  const unloader = new SessionUnloader({
    controller: mounted.controller,
    invalidateSession: sessionId => registry.invalidateSession(sessionId),
    idleMs: options.idleMs ?? 60_000,
    now: () => now,
    warn: () => {},
  });
  onTestFinished(() => unloader.stop());
  return {
    unloader,
    registry,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

const loaded = async (controller: AgentController<any>, id: string) => (await controller.getSession(id)) !== undefined;

describe('SessionUnloader on a real controller', () => {
  it('unloads a session idle past the timeout and keeps one used since', async () => {
    const mounted = await mountController();
    const { unloader, advance } = clockedUnloader(mounted);
    await sessionWithHistory(mounted.controller, 'idle');
    await sessionWithHistory(mounted.controller, 'recent');

    advance(45_000);
    unloader.touch('recent');
    advance(20_000);

    expect(await unloader.sweep()).toBe(1);
    expect(await loaded(mounted.controller, 'idle')).toBe(false);
    expect(await loaded(mounted.controller, 'recent')).toBe(true);
    expect(unloader.isLoaded('idle')).toBe(false);
  });

  it('keeps a session running a turn, then unloads it once it has been idle long enough', async () => {
    const mounted = await mountController();
    const { unloader, advance } = clockedUnloader(mounted);
    const session = await mounted.controller.createSession({ id: 'busy', resourceId: 'p', ownerId: 'user-1' });
    await session.thread.create({ id: 'busy' });
    const turn = session.sendMessage({ content: 'HOLD until told.' });
    await vi.waitFor(() => expect(session.run.isRunning()).toBe(true));

    advance(120_000);
    expect(await unloader.sweep()).toBe(0);
    expect(await loaded(mounted.controller, 'busy')).toBe(true);

    mounted.release();
    await turn;
    // The idle clock restarted when the sweep found it busy, not when it was created.
    advance(30_000);
    expect(await unloader.sweep()).toBe(0);
    advance(30_000);
    expect(await unloader.sweep()).toBe(1);
    expect(await loaded(mounted.controller, 'busy')).toBe(false);
  });

  it('keeps a session parked on ask_user however long it waits, and unloads it after it is answered', async () => {
    const mounted = await mountController();
    const { unloader, advance } = clockedUnloader(mounted);
    const session = await mounted.controller.createSession({ id: 'parked', resourceId: 'p', ownerId: 'user-1' });
    await session.thread.create({ id: 'parked' });
    await session.sendMessage({ content: 'ASK before shipping.' });
    await vi.waitFor(() => expect(session.suspensions.hasPending()).toBe(true));
    expect(session.run.isRunning()).toBe(false);

    advance(24 * 60 * 60_000);
    expect(await unloader.sweep()).toBe(0);
    expect(await mounted.controller.getSession('parked')).toBe(session);

    await session.respondToToolSuspension({ toolCallId: 'call-ask', resumeData: 'yes' });
    await vi.waitFor(() => expect(session.suspensions.hasPending() || session.run.isRunning()).toBe(false));
    advance(60_000);
    expect(await unloader.sweep()).toBe(1);
    expect(await loaded(mounted.controller, 'parked')).toBe(false);
  });

  it('keeps the thread and messages, drops Factory caches, and comes back on the next run as the row owner', async () => {
    const mounted = await mountController();
    const registry = new FactoryWorkspaceRegistry();
    const { unloader, advance } = clockedUnloader(mounted, { registry });
    const before = await sessionWithHistory(mounted.controller, 'card-session');
    const workspaceDropped = vi.fn();
    await registry.register('card-session', 'mfw-repo-row-1', registry.generation('card-session'), workspaceDropped);
    const history = await before.thread.listMessages({ threadId: 'card-session' });
    expect(history.length).toBeGreaterThanOrEqual(2);

    advance(60_000);
    expect(await unloader.sweep()).toBe(1);
    expect(workspaceDropped).toHaveBeenCalledOnce();
    expect(registry.generation('card-session')).toBe(1);
    expect(await mounted.controller.queryThreadById({ threadId: 'card-session' })).toMatchObject({
      resourceId: 'factory-project-1',
    });

    // The deferred-wake path: brought back online as the row's owner, on its own thread.
    const after = await createSessionAsRowOwner(mounted.controller, {
      sessionId: 'card-session',
      ownerResourceId: 'factory-project-1',
      row: { userId: 'user-1', orgId: 'org-1' } as never,
      tags: { factoryProjectId: 'factory-project-1' },
      threadId: 'card-session',
    });
    expect(after).not.toBe(before);
    expect(unloader.isLoaded('card-session')).toBe(true);
    expect(after.thread.getId()).toBe('card-session');
    expect(await after.thread.listMessages({ threadId: 'card-session' })).toEqual(history);

    await after.sendMessage({ content: 'Carry on.' });
    const messages = await after.thread.listMessages({ threadId: 'card-session' });
    expect(messages.slice(0, history.length)).toEqual(history);
    expect(messages.length).toBeGreaterThan(history.length);
  });

  // The reloaded session gets a new sandbox handle that no longer tracks the process, so
  // the agent could neither read its output nor stop it.
  it('keeps an idle session whose sandbox still runs a background process', async () => {
    const sandbox = new LocalSandbox();
    const mounted = await mountController(new Workspace({ name: 'sandboxed-workspace', sandbox }));
    const { unloader, advance } = clockedUnloader(mounted);
    await sessionWithHistory(mounted.controller, 'dev-server');
    const server = await sandbox.processes.spawn('sleep 30');
    onTestFinished(async () => {
      await server.kill();
    });

    advance(61_000);
    expect(await unloader.sweep()).toBe(0);
    expect(await loaded(mounted.controller, 'dev-server')).toBe(true);

    await server.kill();
    await server.wait();
    advance(61_000);
    expect(await unloader.sweep()).toBe(1);
    expect(await loaded(mounted.controller, 'dev-server')).toBe(false);
  });

  it('keeps an idle session when its running sandbox cannot list its processes', async () => {
    const sandbox = new LocalSandbox();
    const mounted = await mountController(new Workspace({ name: 'unlistable-workspace', sandbox }));
    const { unloader, advance } = clockedUnloader(mounted);
    await sessionWithHistory(mounted.controller, 'unlistable');
    const server = await sandbox.processes.spawn('sleep 30');
    onTestFinished(async () => {
      await server.kill();
    });
    const list = vi.spyOn(sandbox.processes, 'list').mockRejectedValue(new Error('provider unavailable'));

    advance(61_000);
    expect(await unloader.sweep()).toBe(0);
    expect(await loaded(mounted.controller, 'unlistable')).toBe(true);

    list.mockRestore();
    await server.kill();
    await server.wait();
    advance(61_000);
    expect(await unloader.sweep()).toBe(1);
  });

  it('unloads a released session at once when idle, and on the first sweep after its work ends when busy', async () => {
    const mounted = await mountController();
    const { unloader } = clockedUnloader(mounted, { idleMs: 0 });
    await sessionWithHistory(mounted.controller, 'released-idle');
    const busy = await mounted.controller.createSession({ id: 'released-busy', resourceId: 'p', ownerId: 'user-1' });
    await busy.thread.create({ id: 'released-busy' });
    const turn = busy.sendMessage({ content: 'HOLD for a moment.' });
    await vi.waitFor(() => expect(busy.run.isRunning()).toBe(true));

    expect(await unloader.unloadReleased('released-idle')).toBe('unloaded');
    expect(await unloader.unloadReleased('released-busy')).toBe('deferred');
    expect(await unloader.unloadReleased('never-loaded')).toBe('not-loaded');
    expect(await loaded(mounted.controller, 'released-idle')).toBe(false);
    expect(await loaded(mounted.controller, 'released-busy')).toBe(true);

    // With the idle timeout off, only the release marks it for unloading.
    expect(await unloader.sweep()).toBe(0);
    mounted.release();
    await turn;
    expect(await unloader.sweep()).toBe(1);
    expect(await loaded(mounted.controller, 'released-busy')).toBe(false);
  });

  it('forgets a release once the session starts a new run', async () => {
    const mounted = await mountController();
    const { unloader } = clockedUnloader(mounted, { idleMs: 0 });
    const session = await mounted.controller.createSession({ id: 'reused', resourceId: 'p', ownerId: 'user-1' });
    await session.thread.create({ id: 'reused' });
    const watching = unloader.watch('reused');

    expect(await unloader.unloadReleased('reused')).toBe('deferred');
    await session.sendMessage({ content: 'Back to work.' });
    watching();

    expect(await unloader.sweep()).toBe(0);
    expect(await loaded(mounted.controller, 'reused')).toBe(true);
  });

  it('forgets a release when a run starts while the unload is still settling', async () => {
    const mounted = await mountController();
    let tick = 0;
    let session: Session<any> | undefined;
    let settled = false;
    const unloader = new SessionUnloader({
      controller: mounted.controller,
      idleMs: 0,
      now: () => ++tick,
      warn: () => {},
      // The session is picked up again while the unload waits for its writes.
      settle: async () => {
        if (settled) return;
        settled = true;
        await session!.sendMessage({ content: 'Back to work.' });
      },
    });
    onTestFinished(() => unloader.stop());
    session = await mounted.controller.createSession({ id: 'raced', resourceId: 'p', ownerId: 'user-1' });
    await session.thread.create({ id: 'raced' });

    expect(await unloader.unloadReleased('raced')).toBe('deferred');

    expect(await unloader.sweep()).toBe(0);
    expect(await loaded(mounted.controller, 'raced')).toBe(true);
  });

  it('sweeps on its own timer once started', async () => {
    const mounted = await mountController();
    const unloader = new SessionUnloader({ controller: mounted.controller, idleMs: 20, sweepIntervalMs: 10 });
    onTestFinished(() => unloader.stop());
    await sessionWithHistory(mounted.controller, 'timed');
    unloader.start();

    await vi.waitFor(async () => expect(await loaded(mounted.controller, 'timed')).toBe(false));
  });

  it('unloads a busy released session on its timer once its work ends, with the idle timeout off', async () => {
    const mounted = await mountController();
    const unloader = new SessionUnloader({ controller: mounted.controller, idleMs: 0, sweepIntervalMs: 10 });
    onTestFinished(() => unloader.stop());
    await sessionWithHistory(mounted.controller, 'kept');
    const busy = await mounted.controller.createSession({ id: 'released', resourceId: 'p', ownerId: 'user-1' });
    await busy.thread.create({ id: 'released' });
    const turn = busy.sendMessage({ content: 'HOLD for a moment.' });
    await vi.waitFor(() => expect(busy.run.isRunning()).toBe(true));
    expect(await unloader.unloadReleased('released')).toBe('deferred');
    unloader.start();

    mounted.release();
    await turn;
    await vi.waitFor(async () => expect(await loaded(mounted.controller, 'released')).toBe(false));
    expect(await loaded(mounted.controller, 'kept')).toBe(true);
  });

  it('rejects idle settings that would unload sessions in use or spin the sweep', async () => {
    const mounted = await mountController();
    for (const options of [{ idleMs: -1 }, { idleMs: Number.NaN }, { sweepIntervalMs: 0 }, { sweepIntervalMs: -5 }]) {
      expect(() => new SessionUnloader({ controller: mounted.controller, ...options })).toThrow(/idleSessionUnload/);
    }
  });
});

describe('a browser tab following a session, through the real server', () => {
  async function serve() {
    const mounted = await mountController();
    const clock = clockedUnloader(mounted);
    const mastra = new Mastra({
      logger: false,
      agentControllers: { code: mounted.controller },
      server: { middleware: [createSessionActivityMiddleware(() => clock.unloader)] },
    });
    const app = await createHonoServer(mastra, { tools: {} });
    return { ...mounted, ...clock, app };
  }

  async function openStream(app: Awaited<ReturnType<typeof serve>>['app'], sessionId: string) {
    const response = await app.request(`http://localhost/api/agent-controller/code/sessions/${sessionId}/stream`);
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let received = '';
    while (!received.includes('display_state_changed')) {
      const { done, value } = await reader.read();
      if (done) throw new Error(`stream ended before the display state: ${received}`);
      received += decoder.decode(value);
    }
    return reader;
  }

  it('keeps a followed session loaded until the tab closes its stream', async () => {
    const { app, controller, unloader, advance } = await serve();
    await sessionWithHistory(controller, 'followed');
    const reader = await openStream(app, 'followed');

    advance(10 * 60_000);
    expect(await unloader.sweep()).toBe(0);
    expect(await loaded(controller, 'followed')).toBe(true);

    await reader.cancel();
    advance(60_000);
    expect(await unloader.sweep()).toBe(1);
    expect(await loaded(controller, 'followed')).toBe(false);
  });

  it('loads an unloaded session again when its tab reopens, with its conversation', async () => {
    const { app, controller, unloader, advance } = await serve();
    const before = await sessionWithHistory(controller, 'reopened');
    const history = await before.thread.listMessages({ threadId: 'reopened' });
    advance(60_000);
    expect(await unloader.sweep()).toBe(1);

    const reader = await openStream(app, 'reopened');
    onTestFinished(() => reader.cancel());

    const after = await controller.getSession('reopened');
    expect(after).toBeDefined();
    expect(after).not.toBe(before);
    expect(after!.thread.getId()).toBe('reopened');
    expect(await after!.thread.listMessages({ threadId: 'reopened' })).toEqual(history);
    // The reopened tab now holds it.
    advance(10 * 60_000);
    expect(await unloader.sweep()).toBe(0);
  });

  it('counts any request addressing the session as activity', async () => {
    const { app, controller, unloader, advance } = await serve();
    await sessionWithHistory(controller, 'polled');

    advance(50_000);
    const response = await app.request('http://localhost/api/agent-controller/code/sessions/polled');
    expect(response.status).toBe(200);
    advance(50_000);

    expect(await unloader.sweep()).toBe(0);
    advance(10_000);
    expect(await unloader.sweep()).toBe(1);
  });
});

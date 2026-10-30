/**
 * #26870: answering a parked tool call arms the session run before the resumed
 * run starts. When the answer fails before that run starts, the session must go
 * back to idle (instead of reporting running with no run id), keep the tool
 * call parked, and still accept a retry and new messages.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../../agent';
import { agentThreadStreamRuntime } from '../../agent/thread-stream-runtime';
import { anyToolResult, useLoopScenarioAimock } from '../../loop/test-utils/aimock/aimock-scenario';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

const ids = { id: 'answer-session', ownerId: 'owner', resourceId: 'answer-user', threadId: 'answer-thread' };

const getMock = useLoopScenarioAimock();

/** Calls `toolName` until a tool result is in the conversation, then answers. */
function model(toolName: string) {
  const llm = getMock();
  llm.on({ endpoint: 'chat', predicate: anyToolResult }, { content: 'done' });
  llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call-1', name: toolName, arguments: { q: 'x' } }] });
  return createOpenAI({ apiKey: 'aimock', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })('gpt-4o-mini');
}

type Stores = { storage: InMemoryStore; memoryStorage: InMemoryStore; executed: string[] };

function stores(): Stores {
  return { storage: new InMemoryStore(), memoryStorage: new InMemoryStore(), executed: [] };
}

async function boot({ storage, memoryStorage, executed }: Stores) {
  const confirm = createTool({
    id: 'confirm',
    description: 'asks the user to confirm',
    inputSchema: z.object({ q: z.string() }),
    execute: async (input, context) => {
      if (context?.agent?.resumeData) {
        executed.push('confirm');
        return { confirmed: true };
      }
      await context?.agent?.suspend?.({ q: input.q });
      return { confirmed: false };
    },
  });
  const lookup = createTool({
    id: 'lookup',
    description: 'look something up',
    inputSchema: z.object({ q: z.string() }),
    requireApproval: true,
    execute: async () => {
      executed.push('lookup');
      return { found: true };
    },
  });
  return { executed, tools: { confirm, lookup }, storage, memoryStorage };
}

async function createSession(toolName: 'confirm' | 'lookup', shared: Stores = stores()) {
  // The suspending tool resumes without an approval re-check; the gated one parks for approval.
  const yolo = toolName === 'confirm';
  const env = await boot(shared);
  const agent = new Agent({
    id: 'answer-agent',
    name: 'answer-agent',
    instructions: 'test',
    model: model(toolName),
    tools: { [toolName]: env.tools[toolName] },
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'answer-controller',
    storage: env.storage,
    memory: new MockMemory({ storage: env.memoryStorage }),
    modes: [{ id: 'default', name: 'Default', default: true, agent, defaultModelId: 'mock-model' }],
    initialState: { yolo } as any,
  });
  await controller.init();
  const session = await controller.createSession(ids);
  await controller.getMastra()?.startWorkers();
  const events: AgentControllerEvent[] = [];
  session.subscribe(event => events.push(event));
  return { ...env, session, events };
}

afterEach(() => {
  vi.restoreAllMocks();
  agentThreadStreamRuntime.resetForTests();
});

describe('tool answer that fails before its run starts', () => {
  async function suspended() {
    const env = await createSession('confirm');
    await env.session.sendMessage({ content: 'confirm it' });
    expect(env.events.find(event => event.type === 'agent_end')).toMatchObject({ reason: 'suspended' });
    expect(env.session.run.isRunning()).toBe(false);
    env.events.length = 0;
    return env;
  }

  it('leaves the session idle with the suspension still parked, and the retry resumes it', async () => {
    const env = await suspended();
    const agent = env.session.machinery.getAgent();
    vi.spyOn(agent, 'sendStreamResume').mockRejectedValueOnce(new Error('resume dispatch failed'));

    await env.session.respondToToolSuspension({ resumeData: { ok: true } });

    expect(env.events.flatMap(event => (event.type === 'error' ? [event.error.message] : []))).toContain(
      'resume dispatch failed',
    );
    expect(env.session.run.isRunning()).toBe(false);
    expect(env.session.run.getRunId()).toBeNull();
    expect(env.session.displayState.get().pendingSuspensions.size).toBe(1);
    expect(env.events.some(event => event.type === 'agent_end')).toBe(false);
    expect(env.executed).toEqual([]);

    env.events.length = 0;
    await env.session.respondToToolSuspension({ resumeData: { ok: true } });

    expect(env.executed).toEqual(['confirm']);
    expect(env.events.find(event => event.type === 'agent_end')).toMatchObject({ reason: 'complete' });
    expect(env.session.run.isRunning()).toBe(false);
    expect(env.session.displayState.get().pendingSuspensions.size).toBe(0);
  }, 30_000);

  it('keeps the run when someone else armed it while the resume was failing', async () => {
    const env = await suspended();
    let joinedSignal: AbortSignal | undefined;
    vi.spyOn(env.session.machinery.getAgent(), 'sendStreamResume').mockImplementationOnce(async () => {
      // A message or the subscription joining the run arms it again.
      joinedSignal = env.session.run.ensureAbortController().signal;
      throw new Error('resume failed');
    });

    await env.session.respondToToolSuspension({ resumeData: { ok: true } });

    expect(joinedSignal).toBeDefined();
    expect(env.session.run.isRunning()).toBe(true);
    expect(env.session.run.getAbortSignal()).toBe(joinedSignal);
    env.session.run.reset();
  }, 30_000);

  it('keeps the run when the resume rejects after the session saw its run start', async () => {
    const env = await suspended();
    const agent = env.session.machinery.getAgent();
    const realResume = agent.sendStreamResume.bind(agent);
    let startedRunId: string | null = null;
    const started = new Promise<void>(resolve =>
      env.session.subscribe(event => {
        if (event.type !== 'agent_start') return;
        startedRunId = env.session.run.getRunId();
        resolve();
      }),
    );
    vi.spyOn(agent, 'sendStreamResume').mockImplementationOnce(async (...args: any[]) => {
      await (realResume as any)(...args);
      // The thread subscription arms the run when its first chunk arrives.
      await started;
      throw new Error('resume rejected late');
    });

    await env.session.respondToToolSuspension({ resumeData: { ok: true } });

    expect(startedRunId).not.toBeNull();
    if (!env.events.some(event => event.type === 'agent_end')) {
      expect(env.session.run.isRunning()).toBe(true);
      expect(env.session.run.getRunId()).toBe(startedRunId);
    }
    await vi.waitFor(() =>
      expect(env.events.find(event => event.type === 'agent_end')).toMatchObject({ reason: 'complete' }),
    );
    expect(env.executed).toEqual(['confirm']);
    expect(env.session.run.isRunning()).toBe(false);
  }, 30_000);

  it('re-arms from the subscription when the resume rejects after the run started but before the session saw it', async () => {
    // Hold the session's thread subscription (the first one opened) so the
    // server-side run can start before the subscription arms the session run.
    let hold = false;
    let markHeld!: () => void;
    const held = new Promise<void>(resolve => (markHeld = resolve));
    let release!: () => void;
    const released = new Promise<void>(resolve => (release = resolve));
    const subscribe = Agent.prototype.subscribeToThread;
    let gated = false;
    vi.spyOn(Agent.prototype, 'subscribeToThread').mockImplementation(async function (this: Agent, input: any) {
      const subscription: any = await subscribe.call(this, input);
      if (gated) return subscription;
      gated = true;
      const source = subscription.stream;
      const stream = (async function* () {
        for await (const chunk of source) {
          if (hold) {
            markHeld();
            await released;
          }
          yield chunk;
        }
      })();
      return new Proxy(subscription, {
        get: (target, prop) => {
          if (prop === 'stream') return stream;
          const value = Reflect.get(target, prop, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    });

    const env = await createSession('confirm');
    const agent = env.session.machinery.getAgent();
    await env.session.sendMessage({ content: 'confirm it' });
    expect(env.events.find(event => event.type === 'agent_end')).toMatchObject({ reason: 'suspended' });
    env.events.length = 0;

    const realResume = agent.sendStreamResume.bind(agent);
    hold = true;
    vi.spyOn(agent, 'sendStreamResume').mockImplementationOnce(async (...args: any[]) => {
      await (realResume as any)(...args);
      // The resumed run is streaming, but the session subscription has not armed it yet.
      await held;
      throw new Error('resume rejected after the run started');
    });

    await env.session.respondToToolSuspension({ resumeData: { ok: true } });

    expect(env.events.some(event => event.type === 'agent_start')).toBe(false);
    expect(env.session.run.isRunning()).toBe(false);

    let started: { runId: string | null; running: boolean } | undefined;
    env.session.subscribe(event => {
      if (event.type === 'agent_start') {
        started = { runId: env.session.run.getRunId(), running: env.session.run.isRunning() };
      }
    });
    hold = false;
    release();

    await vi.waitFor(() =>
      expect(env.events.find(event => event.type === 'agent_end')).toMatchObject({ reason: 'complete' }),
    );
    // The subscription armed the session for the resumed run once it saw it.
    expect(started?.running).toBe(true);
    expect(started?.runId).toEqual(expect.any(String));
    expect(env.executed).toEqual(['confirm']);
    expect(env.session.run.isRunning()).toBe(false);
    expect(env.session.run.getRunId()).toBeNull();
    expect(env.session.displayState.get().pendingSuspensions.size).toBe(0);
  }, 30_000);

  it('leaves the session idle when two answers in flight together both fail', async () => {
    const env = await suspended();
    const resume = vi.spyOn(env.session.machinery.getAgent(), 'sendStreamResume');
    let failBoth!: () => void;
    const bothArmed = new Promise<void>(resolve => (failBoth = resolve));
    let calls = 0;
    resume.mockImplementation(async () => {
      // Hold the first answer until the second has armed the run too.
      if (++calls === 2) failBoth();
      await bothArmed;
      throw new Error('resume failed');
    });

    await Promise.all([
      env.session.respondToToolSuspension({ resumeData: { ok: true } }),
      env.session.respondToToolSuspension({ resumeData: { ok: true } }),
    ]);

    expect(resume).toHaveBeenCalledTimes(2);
    expect(env.session.run.isRunning()).toBe(false);
    expect(env.session.run.getRunId()).toBeNull();
    expect(env.session.displayState.get().pendingSuspensions.size).toBe(1);

    resume.mockRestore();
    await env.session.respondToToolSuspension({ resumeData: { ok: true } });
    expect(env.executed).toEqual(['confirm']);
    expect(env.session.run.isRunning()).toBe(false);
  }, 30_000);

  it('keeps a run that was already armed when the answer fails', async () => {
    const env = await suspended();
    const liveSignal = env.session.run.ensureAbortController().signal;
    vi.spyOn(env.session.machinery.getAgent(), 'sendStreamResume').mockRejectedValueOnce(new Error('resume failed'));

    await env.session.respondToToolSuspension({ resumeData: { ok: true } });

    expect(env.session.run.isRunning()).toBe(true);
    expect(env.session.run.getAbortSignal()).toBe(liveSignal);
    env.session.run.reset();
  }, 30_000);
});

describe('persisted tool approval that fails before its run starts', () => {
  // Park an approval, then answer it from a fresh runtime with no gate armed.
  async function parkedApproval() {
    const shared = stores();
    const first = await createSession('lookup', shared);
    void first.session.sendMessage({ content: 'use the tool' }).catch(() => {});
    await vi.waitFor(() => expect(first.events.some(event => event.type === 'tool_approval_required')).toBe(true), {
      timeout: 10_000,
    });
    agentThreadStreamRuntime.resetForTests();

    const env = await createSession('lookup', shared);
    const agent = env.session.machinery.getAgent();
    const suspendedRuns = async () =>
      (await agent.listSuspendedRuns({ threadId: ids.threadId, resourceId: ids.resourceId })).runs;
    await vi.waitFor(async () => expect(await suspendedRuns()).toHaveLength(1));
    return { env, agent, suspendedRuns };
  }

  it.each([true, false])(
    'leaves the session idle (approved: %s) and the retry settles the call',
    async approved => {
      const { env, agent, suspendedRuns } = await parkedApproval();
      vi.spyOn(agent, 'sendToolApproval').mockRejectedValueOnce(new Error('dispatch failed'));

      await expect(env.session.respondToPersistedToolApproval({ toolCallId: 'call-1', approved })).rejects.toThrow(
        'dispatch failed',
      );

      expect(env.session.run.isRunning()).toBe(false);
      expect(env.session.run.getRunId()).toBeNull();
      expect(await suspendedRuns()).toHaveLength(1);

      await env.session.respondToPersistedToolApproval({ toolCallId: 'call-1', approved });
      if (approved) await vi.waitFor(() => expect(env.executed).toEqual(['lookup']));
      await vi.waitFor(async () => expect(await suspendedRuns()).toEqual([]));
      expect(env.executed).toEqual(approved ? ['lookup'] : []);
    },
    30_000,
  );

  it('leaves the session idle when two approvals in flight together both fail', async () => {
    const { env, agent, suspendedRuns } = await parkedApproval();
    let failBoth!: () => void;
    const bothArmed = new Promise<void>(resolve => (failBoth = resolve));
    let calls = 0;
    const approve = vi.spyOn(agent, 'sendToolApproval').mockImplementation(async () => {
      // Hold the first approval until the second has armed the run too.
      if (++calls === 2) failBoth();
      await bothArmed;
      throw new Error('dispatch failed');
    });

    const answers = await Promise.allSettled([
      env.session.respondToPersistedToolApproval({ toolCallId: 'call-1', approved: true }),
      env.session.respondToPersistedToolApproval({ toolCallId: 'call-1', approved: true }),
    ]);

    expect(answers.map(answer => answer.status)).toEqual(['rejected', 'rejected']);
    expect(approve).toHaveBeenCalledTimes(2);
    expect(env.session.run.isRunning()).toBe(false);
    expect(env.session.run.getRunId()).toBeNull();
    expect(await suspendedRuns()).toHaveLength(1);

    approve.mockRestore();
    await env.session.respondToPersistedToolApproval({ toolCallId: 'call-1', approved: true });
    await vi.waitFor(() => expect(env.executed).toEqual(['lookup']));
    await vi.waitFor(async () => expect(await suspendedRuns()).toEqual([]));
  }, 30_000);

  it.each(['before', 'after'] as const)(
    'keeps the run when one of two approvals in flight dispatches and the other fails %s it',
    async order => {
      const { env, agent } = await parkedApproval();
      let bothArmed!: () => void;
      const armed = new Promise<void>(resolve => (bothArmed = resolve));
      let markDispatched!: () => void;
      const dispatched = new Promise<void>(resolve => (markDispatched = resolve));
      let markFailed!: () => void;
      const failed = new Promise<void>(resolve => (markFailed = resolve));
      // A macrotask lets the other answer's settle bookkeeping run first.
      const settled = (promise: Promise<void>) => promise.then(() => new Promise(resolve => setTimeout(resolve, 0)));
      let calls = 0;
      const approve = vi.spyOn(agent, 'sendToolApproval').mockImplementation(async () => {
        const call = ++calls;
        if (call === 2) bothArmed();
        await armed;
        if (call === 1) {
          if (order === 'after') await settled(dispatched);
          markFailed();
          throw new Error('dispatch failed');
        }
        // Dispatched, but the subscription has not armed the run yet.
        if (order === 'before') await settled(failed);
        markDispatched();
        return undefined as any;
      });

      const answers = await Promise.allSettled([
        env.session.respondToPersistedToolApproval({ toolCallId: 'call-1', approved: true }),
        env.session.respondToPersistedToolApproval({ toolCallId: 'call-1', approved: true }),
      ]);

      expect(answers.map(answer => answer.status)).toEqual(['rejected', 'fulfilled']);
      expect(approve).toHaveBeenCalledTimes(2);
      expect(env.session.run.isRunning()).toBe(true);
      env.session.run.reset();
    },
    30_000,
  );
});

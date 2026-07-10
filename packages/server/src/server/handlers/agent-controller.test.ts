import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import {
  LIST_AGENT_CONTROLLERS_ROUTE,
  CREATE_AGENT_CONTROLLER_SESSION_ROUTE,
  SEND_AGENT_CONTROLLER_MESSAGE_ROUTE,
  ABORT_AGENT_CONTROLLER_SESSION_ROUTE,
  STREAM_AGENT_CONTROLLER_SESSION_ROUTE,
  GET_AGENT_CONTROLLER_SESSION_STATE_ROUTE,
  LIST_AGENT_CONTROLLER_MODES_ROUTE,
  LIST_AGENT_CONTROLLER_THREADS_ROUTE,
  SWITCH_AGENT_CONTROLLER_MODE_ROUTE,
  DELETE_AGENT_CONTROLLER_THREAD_ROUTE,
  RENAME_AGENT_CONTROLLER_THREAD_ROUTE,
  LIST_AGENT_CONTROLLER_THREAD_MESSAGES_ROUTE,
  SWITCH_AGENT_CONTROLLER_THREAD_ROUTE,
  STEER_AGENT_CONTROLLER_SESSION_ROUTE,
  FOLLOW_UP_AGENT_CONTROLLER_SESSION_ROUTE,
  AGENT_CONTROLLER_TOOL_APPROVAL_ROUTE,
  AGENT_CONTROLLER_TOOL_SUSPENSION_ROUTE,
} from './agent-controller';

function makeAgent(id = 'test-agent') {
  return new Agent({ id, name: id, instructions: 'test', model: {} as any });
}

function makeMastra() {
  const controller = new AgentController({
    id: 'code',
    storage: new InMemoryStore(),
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    modes: [
      { id: 'build', name: 'Build', default: true, agent: makeAgent() },
      { id: 'plan', name: 'Plan', agent: makeAgent() },
    ],
  });
  const mastra = new Mastra({ agentControllers: { code: controller }, storage: new InMemoryStore() });
  return { mastra, controller };
}

describe('agent-controller routes', () => {
  let mastra: Mastra;

  beforeEach(() => {
    ({ mastra } = makeMastra());
  });

  describe('LIST_AGENT_CONTROLLERS_ROUTE', () => {
    it('lists registered agent controllers by id', async () => {
      const res = await LIST_AGENT_CONTROLLERS_ROUTE.handler({ mastra } as any);
      expect(res).toEqual({ agentControllers: [{ id: 'code' }] });
    });

    it('returns an empty list when none registered', async () => {
      const empty = new Mastra({ storage: new InMemoryStore() });
      const res = await LIST_AGENT_CONTROLLERS_ROUTE.handler({ mastra: empty } as any);
      expect(res).toEqual({ agentControllers: [] });
    });
  });

  describe('CREATE_AGENT_CONTROLLER_SESSION_ROUTE', () => {
    it('creates a session and returns its resourceId and threadId', async () => {
      const res = (await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
      } as any)) as { controllerId: string; resourceId: string; threadId?: string };

      expect(res.controllerId).toBe('code');
      expect(res.resourceId).toBe('user-1');
      expect(typeof res.threadId).toBe('string');
    });

    it('is get-or-create: same resourceId resumes the same thread', async () => {
      const first = (await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
      } as any)) as { threadId?: string };
      const second = (await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
      } as any)) as { threadId?: string };

      expect(second.threadId).toBe(first.threadId);
    });

    it('404s for an unknown agent controller id', async () => {
      await expect(
        CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({ mastra, controllerId: 'nope', resourceId: 'user-1' } as any),
      ).rejects.toBeInstanceOf(HTTPException);
    });
  });

  describe('ABORT_AGENT_CONTROLLER_SESSION_ROUTE', () => {
    it('acks an abort on an idle session', async () => {
      const res = await ABORT_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
      } as any);
      expect(res).toEqual({ ok: true });
    });
  });

  describe('SWITCH_AGENT_CONTROLLER_THREAD_ROUTE', () => {
    it('does not interrupt the session when the requested thread is already active', async () => {
      const controller = mastra.getAgentController('code');
      if (!controller) throw new Error('Expected the code agent controller');
      await controller.init();
      const session = await controller.createSession({ resourceId: 'user-1', id: 'user-1', ownerId: controller.id });
      const threadId = session.thread.requireId();
      const switchThread = vi.spyOn(session.thread, 'switch');

      const response = await SWITCH_AGENT_CONTROLLER_THREAD_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
        threadId,
      });

      expect(response).toEqual({ ok: true });
      expect(switchThread).not.toHaveBeenCalled();
    });
  });

  describe('SEND_AGENT_CONTROLLER_MESSAGE_ROUTE', () => {
    it('acks a send (reply streams over SSE, not this response)', async () => {
      const res = await SEND_AGENT_CONTROLLER_MESSAGE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
        message: 'hello',
      } as any);
      expect(res).toEqual({ ok: true });
    });
  });

  describe('requestContext forwarding', () => {
    // Identity injected by `server.middleware` arrives on the handler as
    // `requestContext`; the session-write routes must thread it through to the
    // session methods (which pass it to the run engine) or dynamic
    // instructions/tools see an empty context (see mastra-ai/mastra#18916).
    async function getRouteSession(resourceId: string) {
      const controller = mastra.getAgentController('code')!;
      await controller.init();
      // Same get-or-create call the route handlers make, so this returns the
      // exact session instance the handler will operate on.
      return controller.createSession({ resourceId, id: resourceId, ownerId: controller.id });
    }

    function makeRequestContext() {
      const requestContext = new RequestContext();
      requestContext.set('tenantId', 'acme');
      return requestContext;
    }

    it('forwards requestContext to session.sendMessage', async () => {
      const session = await getRouteSession('user-rc');
      const spy = vi.spyOn(session, 'sendMessage').mockResolvedValue(undefined);
      const requestContext = makeRequestContext();

      await SEND_AGENT_CONTROLLER_MESSAGE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-rc',
        message: 'hello',
        requestContext,
      } as any);

      expect(spy).toHaveBeenCalledWith({ content: 'hello', requestContext });
    });

    it('forwards requestContext to session.steer', async () => {
      const session = await getRouteSession('user-rc');
      const spy = vi.spyOn(session, 'steer').mockResolvedValue(undefined);
      const requestContext = makeRequestContext();

      await STEER_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-rc',
        message: 'change course',
        requestContext,
      } as any);

      expect(spy).toHaveBeenCalledWith({ content: 'change course', requestContext });
    });

    it('forwards requestContext to session.followUp', async () => {
      const session = await getRouteSession('user-rc');
      const spy = vi.spyOn(session, 'followUp').mockResolvedValue(undefined);
      const requestContext = makeRequestContext();

      await FOLLOW_UP_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-rc',
        message: 'and another thing',
        requestContext,
      } as any);

      expect(spy).toHaveBeenCalledWith({ content: 'and another thing', requestContext });
    });

    it('forwards requestContext to session.respondToToolApproval', async () => {
      const session = await getRouteSession('user-rc');
      const spy = vi.spyOn(session, 'respondToToolApproval').mockReturnValue(undefined);
      const requestContext = makeRequestContext();

      await AGENT_CONTROLLER_TOOL_APPROVAL_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-rc',
        toolCallId: 'call-1',
        approved: true,
        requestContext,
      } as any);

      expect(spy).toHaveBeenCalledWith({ toolCallId: 'call-1', decision: 'approve', requestContext });
    });

    it('forwards requestContext to session.respondToToolSuspension', async () => {
      const session = await getRouteSession('user-rc');
      const spy = vi.spyOn(session, 'respondToToolSuspension').mockResolvedValue(undefined);
      const requestContext = makeRequestContext();

      await AGENT_CONTROLLER_TOOL_SUSPENSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-rc',
        toolCallId: 'call-2',
        resumeData: 'Yes',
        requestContext,
      } as any);

      expect(spy).toHaveBeenCalledWith({ toolCallId: 'call-2', resumeData: 'Yes', requestContext });
    });
  });

  describe('STREAM_AGENT_CONTROLLER_SESSION_ROUTE', () => {
    it('delivers session events to the SSE stream', async () => {
      const stream = (await STREAM_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
        abortSignal: new AbortController().signal,
      } as any)) as ReadableStream<unknown>;

      const reader = stream.getReader();

      // Emit an event on the session the route subscribed to.
      const controller = mastra.getAgentController('code')!;
      await controller.init();
      const session = await controller.createSession({ resourceId: 'user-1', id: 'user-1', ownerId: 'code' });
      // Any emit fans out a synthetic display_state_changed to subscribers.
      session.emit({ type: 'agent_start' } as any);

      // The route enqueues raw event objects (the server adapter is responsible
      // for SSE framing). Read past any `:`-prefixed heartbeat comments and
      // workspace lifecycle events until we see our event object.
      let received: any;
      for (let i = 0; i < 10 && received === undefined; i++) {
        const { value } = await reader.read();
        if (value && typeof value === 'object' && (value as any).type === 'agent_start') received = value;
      }
      await reader.cancel();

      expect(received).toBeDefined();
      expect(received.type).toBe('agent_start');
    });
  });

  describe('LIST_AGENT_CONTROLLER_MODES_ROUTE', () => {
    it('lists the agent controller modes', async () => {
      const res = await LIST_AGENT_CONTROLLER_MODES_ROUTE.handler({ mastra, controllerId: 'code' } as any);
      expect(res).toEqual({
        modes: [
          { id: 'build', name: 'Build' },
          { id: 'plan', name: 'Plan' },
        ],
      });
    });
  });

  describe('GET_AGENT_CONTROLLER_SESSION_STATE_ROUTE', () => {
    it('returns the current mode, model, and thread', async () => {
      const res = (await GET_AGENT_CONTROLLER_SESSION_STATE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
      } as any)) as { modeId: string; threadId?: string };
      expect(res.modeId).toBe('build');
      expect(typeof res.threadId).toBe('string');
    });
  });

  describe('SWITCH_AGENT_CONTROLLER_MODE_ROUTE', () => {
    it('switches the active mode', async () => {
      const ack = await SWITCH_AGENT_CONTROLLER_MODE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
        modeId: 'plan',
      } as any);
      expect(ack).toEqual({ ok: true });

      const state = (await GET_AGENT_CONTROLLER_SESSION_STATE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
      } as any)) as { modeId: string };
      expect(state.modeId).toBe('plan');
    });
  });

  describe('LIST_AGENT_CONTROLLER_THREADS_ROUTE', () => {
    it('lists the session threads (at least the auto-created one)', async () => {
      await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
      } as any);
      const res = (await LIST_AGENT_CONTROLLER_THREADS_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
      } as any)) as { threads: { id: string }[] };
      expect(Array.isArray(res.threads)).toBe(true);
      expect(res.threads.length).toBeGreaterThanOrEqual(1);
    });

    it('caps the result to `limit`, newest first', async () => {
      await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-limit',
      } as any);
      // Create a few more threads so there's something to page.
      const session = await mastra
        .getAgentController('code')!
        .createSession({ resourceId: 'user-limit', id: 'user-limit', ownerId: 'code' });
      for (let i = 0; i < 4; i++) await session.thread.create({ title: `t${i}` });

      const res = (await LIST_AGENT_CONTROLLER_THREADS_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-limit',
        limit: 2,
      } as any)) as { threads: { id: string; updatedAt?: string }[] };

      expect(res.threads.length).toBe(2);
      // Newest first: the returned slice is non-increasing by updatedAt.
      // Require real timestamps so the ordering check can't pass vacuously.
      expect(res.threads.every(t => typeof t.updatedAt === 'string' && !Number.isNaN(Date.parse(t.updatedAt)))).toBe(
        true,
      );
      const times = res.threads.map(t => Date.parse(t.updatedAt!));
      expect(times[0]).toBeGreaterThanOrEqual(times[1]!);
    });

    it('scopes the result to `tags` so worktrees sharing a resourceId stay isolated', async () => {
      // One resourceId can be shared across git worktrees of the same repo (the
      // id derives from the git URL). Threads are stamped with the session's
      // scoping tags at creation, and the list must filter on every tag.
      await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-wt',
      } as any);
      const session = await mastra.getAgentController('code')!.createSession({ resourceId: 'user-wt' });

      await session.state.set({ projectPath: '/repo/worktree-a' } as any);
      await session.thread.create({ title: 'a1' });
      await session.thread.create({ title: 'a2' });
      await session.state.set({ projectPath: '/repo/worktree-b' } as any);
      await session.thread.create({ title: 'b1' });

      const onlyA = (await LIST_AGENT_CONTROLLER_THREADS_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-wt',
        tags: { projectPath: '/repo/worktree-a' },
      } as any)) as { threads: { title?: string; tags?: Record<string, string> }[] };
      expect(onlyA.threads.map(t => t.title).sort()).toEqual(['a1', 'a2']);
      expect(onlyA.threads.every(t => t.tags?.projectPath === '/repo/worktree-a')).toBe(true);

      const onlyB = (await LIST_AGENT_CONTROLLER_THREADS_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-wt',
        tags: { projectPath: '/repo/worktree-b' },
      } as any)) as { threads: { title?: string }[] };
      expect(onlyB.threads.map(t => t.title)).toEqual(['b1']);

      // Without tags, every thread for the resource is returned (including the
      // untagged auto-created startup thread).
      const all = (await LIST_AGENT_CONTROLLER_THREADS_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-wt',
      } as any)) as { threads: unknown[] };
      expect(all.threads.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('cross-resource thread access is rejected', () => {
    // A handler is authorized for the resourceId in its URL path, but the
    // threadId path param is otherwise unscoped. These routes must not let a
    // session act on a thread owned by a different resourceId.
    async function setupTwoSessions() {
      const victim = (await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'victim',
      } as any)) as { threadId?: string };
      await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'attacker',
      } as any);
      return { victimThreadId: victim.threadId! };
    }

    it('DELETE rejects a thread owned by another resource', async () => {
      const { victimThreadId } = await setupTwoSessions();
      await expect(
        DELETE_AGENT_CONTROLLER_THREAD_ROUTE.handler({
          mastra,
          controllerId: 'code',
          resourceId: 'attacker',
          threadId: victimThreadId,
        } as any),
      ).rejects.toThrow('Thread not found');

      // The victim's thread is untouched.
      const victimThreads = (await LIST_AGENT_CONTROLLER_THREADS_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'victim',
      } as any)) as { threads: { id: string }[] };
      expect(victimThreads.threads.some(t => t.id === victimThreadId)).toBe(true);
    });

    it('RENAME rejects a thread owned by another resource', async () => {
      const { victimThreadId } = await setupTwoSessions();
      await expect(
        RENAME_AGENT_CONTROLLER_THREAD_ROUTE.handler({
          mastra,
          controllerId: 'code',
          resourceId: 'attacker',
          threadId: victimThreadId,
          title: 'pwned',
        } as any),
      ).rejects.toThrow('Thread not found');
    });

    it('LIST messages rejects a thread owned by another resource', async () => {
      const { victimThreadId } = await setupTwoSessions();
      await expect(
        LIST_AGENT_CONTROLLER_THREAD_MESSAGES_ROUTE.handler({
          mastra,
          controllerId: 'code',
          resourceId: 'attacker',
          threadId: victimThreadId,
        } as any),
      ).rejects.toThrow('Thread not found');
    });

    it('SWITCH rejects a thread owned by another resource', async () => {
      const { victimThreadId } = await setupTwoSessions();
      await expect(
        SWITCH_AGENT_CONTROLLER_THREAD_ROUTE.handler({
          mastra,
          controllerId: 'code',
          resourceId: 'attacker',
          threadId: victimThreadId,
        } as any),
      ).rejects.toThrow('Thread not found');
    });
  });
});

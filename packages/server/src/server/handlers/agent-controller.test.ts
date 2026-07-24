import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MASTRA_USER_KEY } from '../constants';
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
  const storage = new InMemoryStore();
  const controller = new AgentController({
    id: 'code',
    storage,
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    modes: [
      { id: 'build', name: 'Build', default: true, agent: makeAgent() },
      { id: 'plan', name: 'Plan', agent: makeAgent() },
    ],
  });
  const mastra = new Mastra({ agentControllers: { code: controller }, storage });
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

    it('binds the session to an exact thread id when requested', async () => {
      const res = (await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
        threadId: 'factory-session-1',
      } as any)) as { resourceId: string; threadId?: string };

      expect(res.resourceId).toBe('user-1');
      expect(res.threadId).toBe('factory-session-1');
    });

    it('404s for an unknown agent controller id', async () => {
      await expect(
        CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({ mastra, controllerId: 'nope', resourceId: 'user-1' } as any),
      ).rejects.toBeInstanceOf(HTTPException);
    });
  });

  describe('scoped sessions (sessionScope)', () => {
    // One resourceId can be shared across git worktrees; a `sessionScope`
    // addresses an independent session per scope so parallel worktrees don't
    // collide on one run loop / thread binding.
    it('creates independent sessions for the same resourceId under different scopes', async () => {
      const a = (await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-wt',
        sessionScope: '/repo/worktree-a',
        tags: { projectPath: '/repo/worktree-a' },
      } as any)) as { threadId?: string };
      const b = (await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-wt',
        sessionScope: '/repo/worktree-b',
        tags: { projectPath: '/repo/worktree-b' },
      } as any)) as { threadId?: string };

      expect(a.threadId).toBeDefined();
      expect(b.threadId).toBeDefined();
      expect(b.threadId).not.toBe(a.threadId);

      // Get-or-create still holds within one scope.
      const aAgain = (await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-wt',
        sessionScope: '/repo/worktree-a',
        tags: { projectPath: '/repo/worktree-a' },
      } as any)) as { threadId?: string };
      expect(aAgain.threadId).toBe(a.threadId);
    });

    it('routes with a sessionScope address the scoped session, not the unscoped one', async () => {
      await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-wt',
      } as any);
      await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-wt',
        sessionScope: '/repo/worktree-a',
        tags: { projectPath: '/repo/worktree-a' },
      } as any);

      // Switch the scoped session's mode; the unscoped session must not move.
      await SWITCH_AGENT_CONTROLLER_MODE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-wt',
        sessionScope: '/repo/worktree-a',
        modeId: 'plan',
      } as any);

      const scoped = (await GET_AGENT_CONTROLLER_SESSION_STATE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-wt',
        sessionScope: '/repo/worktree-a',
      } as any)) as { modeId: string };
      const unscoped = (await GET_AGENT_CONTROLLER_SESSION_STATE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-wt',
      } as any)) as { modeId: string };

      expect(scoped.modeId).toBe('plan');
      expect(unscoped.modeId).toBe('build');
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

    it('uses authenticated identity instead of caller-supplied message attribution', async () => {
      const session = await getRouteSession('user-attributed');
      const sendSpy = vi.spyOn(session, 'sendMessage').mockResolvedValue(undefined);
      const steerSpy = vi.spyOn(session, 'steer').mockResolvedValue(undefined);
      const followUpSpy = vi.spyOn(session, 'followUp').mockResolvedValue(undefined);
      const requestContext = makeRequestContext();
      requestContext.set(MASTRA_USER_KEY, { id: 'user-1', name: 'Ada Lovelace' });
      const spoofed = { userId: 'other', name: 'Other User', source: 'web' };

      await SEND_AGENT_CONTROLLER_MESSAGE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-attributed',
        message: 'hello',
        attributes: spoofed,
        requestContext,
      } as any);
      await STEER_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-attributed',
        message: 'focus',
        attributes: spoofed,
        requestContext,
      } as any);
      await FOLLOW_UP_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-attributed',
        message: 'later',
        attributes: spoofed,
        requestContext,
      } as any);

      const attributes = { source: 'web', userId: 'user-1', name: 'Ada Lovelace' };
      expect(sendSpy).toHaveBeenCalledWith({ content: 'hello', attributes, requestContext });
      expect(steerSpy).toHaveBeenCalledWith({ content: 'focus', attributes, requestContext });
      expect(followUpSpy).toHaveBeenCalledWith({ content: 'later', attributes, requestContext });
    });

    it('removes caller-supplied identity when no authenticated identity exists', async () => {
      const session = await getRouteSession('local-unattributed');
      const spy = vi.spyOn(session, 'sendMessage').mockResolvedValue(undefined);
      const requestContext = makeRequestContext();

      await SEND_AGENT_CONTROLLER_MESSAGE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'local-unattributed',
        message: 'hello',
        attributes: { userId: 'other', name: 'Other User', source: 'web' },
        requestContext,
      } as any);

      expect(spy).toHaveBeenCalledWith({ content: 'hello', attributes: { source: 'web' }, requestContext });
    });

    it('forwards files to session.sendMessage', async () => {
      const session = await getRouteSession('user-rc');
      const spy = vi.spyOn(session, 'sendMessage').mockResolvedValue(undefined);
      const files = [{ data: 'aGVsbG8=', mediaType: 'image/png', filename: 'shot.png' }];

      await SEND_AGENT_CONTROLLER_MESSAGE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-rc',
        message: 'see attached',
        files,
      } as any);

      expect(spy).toHaveBeenCalledWith({ content: 'see attached', files, requestContext: undefined });
    });

    it('rejects oversized file attachments in the body schema', () => {
      const schema = SEND_AGENT_CONTROLLER_MESSAGE_ROUTE.bodySchema!;

      const okFile = { data: 'aGVsbG8=', mediaType: 'image/png' };
      expect(schema.safeParse({ message: 'hi', files: [okFile] }).success).toBe(true);

      // Single file over the 14MB base64 cap (10MB binary).
      const oversized = { data: 'a'.repeat(14 * 1024 * 1024 + 1), mediaType: 'image/png' };
      expect(schema.safeParse({ message: 'hi', files: [oversized] }).success).toBe(false);

      // Individually valid files whose combined size exceeds the 28MB total cap.
      const large = { data: 'a'.repeat(10 * 1024 * 1024), mediaType: 'image/png' };
      expect(schema.safeParse({ message: 'hi', files: [large, large, large] }).success).toBe(false);
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

    it('flattens Error instances on error events so the message survives JSON serialization', async () => {
      const stream = (await STREAM_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-err',
        abortSignal: new AbortController().signal,
      } as any)) as ReadableStream<unknown>;

      const reader = stream.getReader();

      const controller = mastra.getAgentController('code')!;
      await controller.init();
      const session = await controller.createSession({ resourceId: 'user-err', id: 'user-err', ownerId: 'code' });
      session.emit({ type: 'error', error: new Error('model quota exhausted'), errorType: 'provider' } as any);

      let received: any;
      for (let i = 0; i < 10 && received === undefined; i++) {
        const { value } = await reader.read();
        if (value && typeof value === 'object' && (value as any).type === 'error') received = value;
      }
      await reader.cancel();

      expect(received).toBeDefined();
      // Error's message/name are non-enumerable; the wire event must carry them
      // as plain properties so JSON.stringify doesn't send `"error": {}`.
      expect(received.error).toEqual({ name: 'Error', message: 'model quota exhausted' });
      expect(JSON.parse(JSON.stringify(received)).error.message).toBe('model quota exhausted');
      expect(received.errorType).toBe('provider');
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
      } as any)) as { modeId: string; threadId?: string; running?: boolean };
      expect(res.modeId).toBe('build');
      expect(typeof res.threadId).toBe('string');
      // Idle session: hydration snapshot reports not running.
      expect(res.running).toBe(false);
    });

    it('reports running: true while a run is active', async () => {
      const controller = mastra.getAgentController('code')!;
      await controller.init();
      const session = await controller.createSession({ resourceId: 'user-1', id: 'user-1', ownerId: controller.id });
      session.displayState.apply({ type: 'agent_start' } as any);

      const res = (await GET_AGENT_CONTROLLER_SESSION_STATE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
      } as any)) as { running?: boolean };
      expect(res.running).toBe(true);
    });
  });

  describe('LIST_AGENT_CONTROLLER_THREAD_MESSAGES_ROUTE message shape', () => {
    it('returns persisted messages in the MastraDBMessage shape (nested content.parts)', async () => {
      // Given a session/thread with a persisted assistant DB message
      const created = (await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-msg-shape',
      } as any)) as { threadId: string };
      const threadId = created.threadId;

      const memory = await mastra.getStorage()!.getStore('memory');
      await memory!.saveMessages({
        messages: [
          {
            id: 'm-assistant-1',
            role: 'assistant',
            threadId,
            resourceId: 'user-msg-shape',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            content: {
              format: 2,
              parts: [{ type: 'text', text: 'hello world' }],
            },
          } as any,
        ],
      });

      // When the thread messages are listed over the REST handler
      const res = (await LIST_AGENT_CONTROLLER_THREAD_MESSAGES_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-msg-shape',
        threadId,
      } as any)) as { messages: any[] };

      // Then the response exposes the DB-native nested content (not a flat union array)
      const message = res.messages.find(m => m.id === 'm-assistant-1');
      expect(message).toBeDefined();
      expect(message.role).toBe('assistant');
      expect(Array.isArray(message.content)).toBe(false);
      expect(message.content.format).toBe(2);
      expect(message.content.parts).toEqual([{ type: 'text', text: 'hello world' }]);
      expect(message.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('preserves signal-role messages with their data parts', async () => {
      // Given a session/thread with a persisted signal DB message
      const created = (await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-signal-shape',
      } as any)) as { threadId: string };
      const threadId = created.threadId;

      const memory = await mastra.getStorage()!.getStore('memory');
      await memory!.saveMessages({
        messages: [
          {
            id: 'm-signal-1',
            role: 'signal',
            threadId,
            resourceId: 'user-signal-shape',
            createdAt: new Date('2026-01-02T00:00:00.000Z'),
            content: {
              format: 2,
              parts: [
                {
                  type: 'data-signal',
                  data: { id: 's1', type: 'reactive', tagName: 'system-reminder', contents: 'continue' },
                },
              ],
              metadata: { signal: { id: 's1', type: 'reactive', tagName: 'system-reminder' } },
            },
          } as any,
        ],
      });

      // When the thread messages are listed over the REST handler
      const res = (await LIST_AGENT_CONTROLLER_THREAD_MESSAGES_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-signal-shape',
        threadId,
      } as any)) as { messages: any[] };

      // Then the signal row is passed through unflattened with role 'signal'
      const message = res.messages.find(m => m.id === 'm-signal-1');
      expect(message).toBeDefined();
      expect(message.role).toBe('signal');
      expect(message.content.parts[0].type).toBe('data-signal');
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

    it('annotates each thread with its run state (active while a run executes, idle otherwise)', async () => {
      // Thread state comes from the agent thread-stream runtime — the same
      // per-thread active/idle tracking the signals `ifIdle` path uses.
      await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-state',
      } as any);
      const session = await mastra.getAgentController('code')!.createSession({ resourceId: 'user-state' });
      const busy = await session.thread.create({ title: 'busy' });

      const spy = vi
        .spyOn(Agent.prototype, 'getActiveThreadRunId')
        .mockImplementation(({ threadId }) => (threadId === busy.id ? 'run-1' : undefined));
      try {
        const res = (await LIST_AGENT_CONTROLLER_THREADS_ROUTE.handler({
          mastra,
          controllerId: 'code',
          resourceId: 'user-state',
        } as any)) as { threads: { id: string; state?: string }[] };

        expect(res.threads.find(t => t.id === busy.id)?.state).toBe('active');
        expect(res.threads.filter(t => t.id !== busy.id).every(t => t.state === 'idle')).toBe(true);
      } finally {
        spy.mockRestore();
      }
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

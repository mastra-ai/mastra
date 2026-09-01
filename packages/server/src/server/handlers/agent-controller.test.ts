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
  LIST_AGENT_CONTROLLER_ACTIVE_RUNS_ROUTE,
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

  // The messages/steer/follow-up/tool-suspension routes ack immediately and let
  // the session finish the turn in the background. Session methods can still reject (e.g.
  // `sendMessage` rejects when signal submission fails before a stream starts),
  // and an unobserved rejection crashes the process on Node's default
  // `--unhandled-rejections=throw` (see mastra-ai/mastra#19734). The routes must
  // observe the failure: log it and tell the session's subscribers.
  describe('background session failures', () => {
    async function getRouteSession(resourceId: string) {
      const controller = mastra.getAgentController('code')!;
      await controller.init();
      return controller.createSession({ resourceId, id: resourceId, ownerId: controller.id });
    }

    const cases = [
      { name: 'sendMessage', method: 'sendMessage', route: SEND_AGENT_CONTROLLER_MESSAGE_ROUTE },
      { name: 'steer', method: 'steer', route: STEER_AGENT_CONTROLLER_SESSION_ROUTE },
      { name: 'followUp', method: 'followUp', route: FOLLOW_UP_AGENT_CONTROLLER_SESSION_ROUTE },
      {
        name: 'respondToToolSuspension',
        method: 'respondToToolSuspension',
        route: AGENT_CONTROLLER_TOOL_SUSPENSION_ROUTE,
      },
    ] as const;

    for (const { name, method, route } of cases) {
      it(`still acks, logs, and emits an error event when session.${name} rejects`, async () => {
        const session = await getRouteSession(`user-bg-${name}`);
        const failure = new Error('signal failed before stream started');
        vi.spyOn(session, method as any).mockRejectedValue(failure);
        const errorLog = vi.spyOn(mastra.getLogger(), 'error').mockImplementation(() => {});

        const events: any[] = [];
        const unsubscribe = session.subscribe(event => {
          if (event.type === 'error') events.push(event);
        });

        const unhandled: unknown[] = [];
        const onUnhandled = (reason: unknown) => unhandled.push(reason);
        process.on('unhandledRejection', onUnhandled);

        try {
          const res = await route.handler({
            mastra,
            controllerId: 'code',
            resourceId: `user-bg-${name}`,
            message: 'hello',
          } as any);
          expect(res).toEqual({ ok: true });

          // Let the rejection settle and any unhandled-rejection fire.
          await new Promise(resolve => setTimeout(resolve, 0));
          await new Promise(resolve => setTimeout(resolve, 0));

          expect(unhandled).toEqual([]);
          expect(errorLog).toHaveBeenCalledWith(
            expect.stringContaining(name),
            expect.objectContaining({ operation: name, error: failure }),
          );
          expect(events).toEqual([expect.objectContaining({ type: 'error', error: failure })]);
        } finally {
          process.off('unhandledRejection', onUnhandled);
          unsubscribe();
        }
      });
    }
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

    it('acks a tool suspension without waiting for the resumed run to finish', async () => {
      const session = await getRouteSession('user-suspension-ack');
      vi.spyOn(session, 'respondToToolSuspension').mockReturnValue(new Promise<void>(() => {}));

      const result = await Promise.race([
        AGENT_CONTROLLER_TOOL_SUSPENSION_ROUTE.handler({
          mastra,
          controllerId: 'code',
          resourceId: 'user-suspension-ack',
          toolCallId: 'call-3',
          resumeData: 'Yes',
        } as any),
        new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 50)),
      ]);

      expect(result).toEqual({ ok: true });
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

    it('preserves live streamed messages across the SSE boundary without cloning', async () => {
      const stream = (await STREAM_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-live-message',
        abortSignal: new AbortController().signal,
      } as any)) as ReadableStream<unknown>;

      const reader = stream.getReader();
      const controller = mastra.getAgentController('code')!;
      await controller.init();
      const session = await controller.createSession({
        resourceId: 'user-live-message',
        id: 'user-live-message',
        ownerId: 'code',
      });
      const message = {
        id: 'assistant-live-1',
        role: 'assistant',
        createdAt: new Date('2026-01-02T03:04:05.000Z'),
        content: { format: 2, parts: [{ type: 'text', text: 'first' }] },
      } as any;

      session.emit({ type: 'message_update', message });
      message.content.parts[0].text = 'later';

      let received: any;
      for (let i = 0; i < 10 && received === undefined; i++) {
        const { value } = await reader.read();
        if (value && typeof value === 'object' && (value as any).type === 'message_update') received = value;
      }
      await reader.cancel();

      expect(received.message).toBe(message);
      expect(received.message.content.parts[0].text).toBe('later');
      expect(received.message.createdAt).toEqual(new Date('2026-01-02T03:04:05.000Z'));
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

    it('flattens Error instances on every event that carries one, not just on `error`', async () => {
      const stream = (await STREAM_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-ws-err',
        abortSignal: new AbortController().signal,
      } as any)) as ReadableStream<unknown>;

      const reader = stream.getReader();

      const controller = mastra.getAgentController('code')!;
      await controller.init();
      const session = await controller.createSession({ resourceId: 'user-ws-err', id: 'user-ws-err', ownerId: 'code' });
      session.emit({ type: 'workspace_error', error: new Error('clone failed: permission denied') });
      session.emit({ type: 'workspace_status_changed', status: 'error', error: new Error('sandbox unreachable') });

      // The workspace emits its own status changes on the same stream, so match
      // on the error-carrying ones rather than on the first of each type.
      const received = new Map<string, unknown>();
      for (let i = 0; i < 20 && received.size < 2; i++) {
        const { value } = await reader.read();
        if (!value || typeof value !== 'object' || !('type' in value) || !('error' in value) || !value.error) continue;
        const { type } = value;
        if (type === 'workspace_error' || type === 'workspace_status_changed') received.set(type, value);
      }
      await reader.cancel();

      const wired = (type: string) => JSON.parse(JSON.stringify(received.get(type))).error;
      expect(wired('workspace_error')).toEqual({ name: 'Error', message: 'clone failed: permission denied' });
      expect(wired('workspace_status_changed')).toEqual({ name: 'Error', message: 'sandbox unreachable' });
    });

    it('converts display-state Maps to plain objects so tool state survives JSON serialization', async () => {
      const stream = (await STREAM_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-ds',
        abortSignal: new AbortController().signal,
      } as any)) as ReadableStream<unknown>;

      const reader = stream.getReader();

      const controller = mastra.getAgentController('code')!;
      await controller.init();
      const session = await controller.createSession({ resourceId: 'user-ds', id: 'user-ds', ownerId: 'code' });
      session.emit({ type: 'tool_start', toolCallId: 'call-1', toolName: 'read', args: { path: 'a.ts' } });

      let received: unknown;
      for (let i = 0; i < 10 && received === undefined; i++) {
        const { value } = await reader.read();
        if (value && typeof value === 'object' && 'type' in value && value.type === 'display_state_changed') {
          received = value;
        }
      }
      await reader.cancel();

      expect(received).toBeDefined();
      const wire = JSON.parse(JSON.stringify(received));
      expect(wire.displayState.activeTools['call-1']).toMatchObject({ name: 'read', status: 'running' });
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

    it('returns the durable task list for initial UI hydration', async () => {
      const controller = mastra.getAgentController('code')!;
      await controller.init();
      const session = await controller.createSession({ resourceId: 'user-1', id: 'user-1', ownerId: controller.id });
      const threadId = session.thread.requireId();
      const tasks = [
        { id: 'investigate', content: 'Investigate the bug', status: 'completed', activeForm: 'Investigating the bug' },
        { id: 'fix', content: 'Fix the bug', status: 'in_progress', activeForm: 'Fixing the bug' },
      ] as const;
      const threadState = await mastra.getStorage()!.getStore('threadState');
      await threadState!.setState({ threadId, type: 'task', value: tasks });

      const res = (await GET_AGENT_CONTROLLER_SESSION_STATE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
        threadId,
      } as any)) as { tasks?: unknown };

      expect(res.tasks).toEqual(tasks);
    });

    it('returns tasks for the explicitly requested thread instead of the session current thread', async () => {
      const controller = mastra.getAgentController('code')!;
      await controller.init();
      const session = await controller.createSession({ resourceId: 'user-1', id: 'user-1', ownerId: controller.id });
      const currentThreadId = session.thread.requireId();
      const requestedThread = await session.thread.create({ title: 'Requested thread' });
      await session.thread.switch({ threadId: currentThreadId });
      const tasks = [
        { id: 'requested', content: 'Requested task', status: 'pending', activeForm: 'Working on requested task' },
      ] as const;
      const threadState = await mastra.getStorage()!.getStore('threadState');
      await threadState!.setState({ threadId: requestedThread.id, type: 'task', value: tasks });

      const res = (await GET_AGENT_CONTROLLER_SESSION_STATE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
        threadId: requestedThread.id,
      } as any)) as { threadId?: string; tasks?: unknown };

      expect(res).toMatchObject({ threadId: requestedThread.id, tasks });
    });

    it('returns an empty task list when the requested thread has no durable task state', async () => {
      const controller = mastra.getAgentController('code')!;
      await controller.init();
      const session = await controller.createSession({ resourceId: 'user-1', id: 'user-1', ownerId: controller.id });
      const requestedThread = await session.thread.create({ title: 'No tasks' });

      const res = (await GET_AGENT_CONTROLLER_SESSION_STATE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
        threadId: requestedThread.id,
      } as any)) as { tasks?: unknown };

      expect(res.tasks).toEqual([]);
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

    it('keeps persisted session preferences out of a thread\u2019s tags', async () => {
      // Preferences that survive a restart (thinking level, notifications) share
      // the flat thread `metadata` bag with the scoping tags. They are string
      // valued, so nothing but the reserved-key filter keeps them from surfacing
      // as tags \u2014 and from being matchable through the `tags` filter.
      await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-prefs',
      } as any);
      const session = await mastra.getAgentController('code')!.createSession({ resourceId: 'user-prefs' });
      await session.state.set({ projectPath: '/repo' } as any);
      await session.thread.create({ title: 'p1' });
      await session.state.set({ projectPath: '/repo', thinkingLevel: 'high', notifications: 'bell' } as any);

      // The reserved keys are passed as filter tags with values the thread does
      // not have: they must be dropped before matching, not narrow the result.
      const res = (await LIST_AGENT_CONTROLLER_THREADS_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-prefs',
        tags: { projectPath: '/repo', thinkingLevel: 'low', notifications: 'off' },
      } as any)) as { threads: { title?: string; tags?: Record<string, string> }[] };

      const thread = res.threads.find(t => t.title === 'p1');
      expect(thread?.tags).toEqual({ projectPath: '/repo' });
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

      // Handler reads active state from the controller-wide active-run
      // registry (same source as the `active-runs` endpoint) instead of
      // resolving a per-session agent, so mock that instead of the per-agent
      // `getActiveThreadRunId`. Semantics are identical: a thread is active
      // iff a run is registered for its resourceId + threadId.
      const spy = vi
        .spyOn(Agent.prototype, 'listActiveThreadRuns')
        .mockReturnValue([{ runId: 'run-1', resourceId: 'user-state', threadId: busy.id }]);
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

    it('does not initialize the configured workspace on read-only GET endpoints', async () => {
      // Regression: GET /threads and GET /threads/:id/messages used to route
      // through createSession, which fires Workspace.init() -> sandbox.start()
      // as a side effect. That stalled reads 5-17s and burned a sandbox slot
      // per page visit. These routes now query storage directly and must not
      // provision the configured workspace, even on the first request against
      // a fresh controller.
      const { mastra: fresh, controller } = makeMastra();
      const workspaceInit = vi.spyOn(Workspace.prototype, 'init');
      const createSession = vi.spyOn(controller, 'createSession');
      try {
        // Seed a thread through storage so the messages endpoint has a target,
        // WITHOUT going through createSession (which would provision).
        await controller.initStorage();
        const memory = await (controller as any).getMemoryStorage();
        const seeded = await memory.saveThread({
          thread: {
            id: 'seeded-thread',
            resourceId: 'read-only',
            title: 'seeded',
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await LIST_AGENT_CONTROLLER_THREADS_ROUTE.handler({
          mastra: fresh,
          controllerId: 'code',
          resourceId: 'read-only',
        } as any);
        await LIST_AGENT_CONTROLLER_THREAD_MESSAGES_ROUTE.handler({
          mastra: fresh,
          controllerId: 'code',
          resourceId: 'read-only',
          threadId: seeded.id,
        } as any);

        expect(workspaceInit).not.toHaveBeenCalled();
        expect(createSession).not.toHaveBeenCalled();
      } finally {
        workspaceInit.mockRestore();
        createSession.mockRestore();
      }
    });

    it('lists active runs controller-wide without creating a session', async () => {
      const controller = mastra.getAgentController('code')!;
      const createSession = vi.spyOn(controller, 'createSession');
      const spy = vi
        .spyOn(Agent.prototype, 'listActiveThreadRuns')
        .mockReturnValue([{ runId: 'run-1', resourceId: 'workspace-a', threadId: 'thread-a' }]);
      try {
        const res = await LIST_AGENT_CONTROLLER_ACTIVE_RUNS_ROUTE.handler({
          mastra,
          controllerId: 'code',
        } as any);

        expect(res).toEqual({ runs: [{ runId: 'run-1', resourceId: 'workspace-a', threadId: 'thread-a' }] });
        expect(createSession).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
        createSession.mockRestore();
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

    it('SESSION STATE rejects a requested thread owned by another resource', async () => {
      const { victimThreadId } = await setupTwoSessions();
      await expect(
        GET_AGENT_CONTROLLER_SESSION_STATE_ROUTE.handler({
          mastra,
          controllerId: 'code',
          resourceId: 'attacker',
          threadId: victimThreadId,
        } as any),
      ).rejects.toThrow(`thread "${victimThreadId}" not found`);
    });

    it('SESSION STATE rejects a requested thread that does not exist', async () => {
      await setupTwoSessions();
      await expect(
        GET_AGENT_CONTROLLER_SESSION_STATE_ROUTE.handler({
          mastra,
          controllerId: 'code',
          resourceId: 'attacker',
          threadId: 'missing-thread',
        } as any),
      ).rejects.toThrow('thread "missing-thread" not found');
    });
  });
});

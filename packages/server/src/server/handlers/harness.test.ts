import { Agent } from '@mastra/core/agent';
import { Harness } from '@mastra/core/harness';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { describe, it, expect, beforeEach } from 'vitest';

import { HTTPException } from '../http-exception';
import {
  LIST_HARNESSES_ROUTE,
  CREATE_HARNESS_SESSION_ROUTE,
  SEND_HARNESS_MESSAGE_ROUTE,
  ABORT_HARNESS_SESSION_ROUTE,
  STREAM_HARNESS_SESSION_ROUTE,
  GET_HARNESS_SESSION_STATE_ROUTE,
  LIST_HARNESS_MODES_ROUTE,
  LIST_HARNESS_THREADS_ROUTE,
  SWITCH_HARNESS_MODE_ROUTE,
  DELETE_HARNESS_THREAD_ROUTE,
  RENAME_HARNESS_THREAD_ROUTE,
  LIST_HARNESS_THREAD_MESSAGES_ROUTE,
  SWITCH_HARNESS_THREAD_ROUTE,
} from './harness';

function makeAgent(id = 'test-agent') {
  return new Agent({ id, name: id, instructions: 'test', model: {} as any });
}

function makeMastra() {
  const harness = new Harness({
    id: 'code',
    storage: new InMemoryStore(),
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    modes: [
      { id: 'build', name: 'Build', default: true, agent: makeAgent() },
      { id: 'plan', name: 'Plan', agent: makeAgent() },
    ],
  });
  const mastra = new Mastra({ harnesses: { code: harness }, storage: new InMemoryStore() });
  return { mastra, harness };
}

describe('harness routes', () => {
  let mastra: Mastra;

  beforeEach(() => {
    ({ mastra } = makeMastra());
  });

  describe('LIST_HARNESSES_ROUTE', () => {
    it('lists registered harnesses by id', async () => {
      const res = await LIST_HARNESSES_ROUTE.handler({ mastra } as any);
      expect(res).toEqual({ harnesses: [{ id: 'code' }] });
    });

    it('returns an empty list when none registered', async () => {
      const empty = new Mastra({ storage: new InMemoryStore() });
      const res = await LIST_HARNESSES_ROUTE.handler({ mastra: empty } as any);
      expect(res).toEqual({ harnesses: [] });
    });
  });

  describe('CREATE_HARNESS_SESSION_ROUTE', () => {
    it('creates a session and returns its resourceId and threadId', async () => {
      const res = (await CREATE_HARNESS_SESSION_ROUTE.handler({
        mastra,
        harnessId: 'code',
        resourceId: 'user-1',
      } as any)) as { harnessId: string; resourceId: string; threadId?: string };

      expect(res.harnessId).toBe('code');
      expect(res.resourceId).toBe('user-1');
      expect(typeof res.threadId).toBe('string');
    });

    it('is get-or-create: same resourceId resumes the same thread', async () => {
      const first = (await CREATE_HARNESS_SESSION_ROUTE.handler({
        mastra,
        harnessId: 'code',
        resourceId: 'user-1',
      } as any)) as { threadId?: string };
      const second = (await CREATE_HARNESS_SESSION_ROUTE.handler({
        mastra,
        harnessId: 'code',
        resourceId: 'user-1',
      } as any)) as { threadId?: string };

      expect(second.threadId).toBe(first.threadId);
    });

    it('404s for an unknown harness id', async () => {
      await expect(
        CREATE_HARNESS_SESSION_ROUTE.handler({ mastra, harnessId: 'nope', resourceId: 'user-1' } as any),
      ).rejects.toBeInstanceOf(HTTPException);
    });
  });

  describe('ABORT_HARNESS_SESSION_ROUTE', () => {
    it('acks an abort on an idle session', async () => {
      const res = await ABORT_HARNESS_SESSION_ROUTE.handler({
        mastra,
        harnessId: 'code',
        resourceId: 'user-1',
      } as any);
      expect(res).toEqual({ ok: true });
    });
  });

  describe('SEND_HARNESS_MESSAGE_ROUTE', () => {
    it('acks a send (reply streams over SSE, not this response)', async () => {
      const res = await SEND_HARNESS_MESSAGE_ROUTE.handler({
        mastra,
        harnessId: 'code',
        resourceId: 'user-1',
        message: 'hello',
      } as any);
      expect(res).toEqual({ ok: true });
    });
  });

  describe('STREAM_HARNESS_SESSION_ROUTE', () => {
    it('delivers session events to the SSE stream', async () => {
      const stream = (await STREAM_HARNESS_SESSION_ROUTE.handler({
        mastra,
        harnessId: 'code',
        resourceId: 'user-1',
        abortSignal: new AbortController().signal,
      } as any)) as ReadableStream<unknown>;

      const reader = stream.getReader();

      // Emit an event on the session the route subscribed to.
      const harness = mastra.getHarness('code')!;
      await harness.init();
      const session = await harness.createSession({ resourceId: 'user-1', id: 'user-1', ownerId: 'code' });
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

  describe('LIST_HARNESS_MODES_ROUTE', () => {
    it('lists the harness modes', async () => {
      const res = await LIST_HARNESS_MODES_ROUTE.handler({ mastra, harnessId: 'code' } as any);
      expect(res).toEqual({
        modes: [
          { id: 'build', name: 'Build' },
          { id: 'plan', name: 'Plan' },
        ],
      });
    });
  });

  describe('GET_HARNESS_SESSION_STATE_ROUTE', () => {
    it('returns the current mode, model, and thread', async () => {
      const res = (await GET_HARNESS_SESSION_STATE_ROUTE.handler({
        mastra,
        harnessId: 'code',
        resourceId: 'user-1',
      } as any)) as { modeId: string; threadId?: string };
      expect(res.modeId).toBe('build');
      expect(typeof res.threadId).toBe('string');
    });
  });

  describe('SWITCH_HARNESS_MODE_ROUTE', () => {
    it('switches the active mode', async () => {
      const ack = await SWITCH_HARNESS_MODE_ROUTE.handler({
        mastra,
        harnessId: 'code',
        resourceId: 'user-1',
        modeId: 'plan',
      } as any);
      expect(ack).toEqual({ ok: true });

      const state = (await GET_HARNESS_SESSION_STATE_ROUTE.handler({
        mastra,
        harnessId: 'code',
        resourceId: 'user-1',
      } as any)) as { modeId: string };
      expect(state.modeId).toBe('plan');
    });
  });

  describe('LIST_HARNESS_THREADS_ROUTE', () => {
    it('lists the session threads (at least the auto-created one)', async () => {
      await CREATE_HARNESS_SESSION_ROUTE.handler({ mastra, harnessId: 'code', resourceId: 'user-1' } as any);
      const res = (await LIST_HARNESS_THREADS_ROUTE.handler({
        mastra,
        harnessId: 'code',
        resourceId: 'user-1',
      } as any)) as { threads: { id: string }[] };
      expect(Array.isArray(res.threads)).toBe(true);
      expect(res.threads.length).toBeGreaterThanOrEqual(1);
    });

    it('caps the result to `limit`, newest first', async () => {
      await CREATE_HARNESS_SESSION_ROUTE.handler({ mastra, harnessId: 'code', resourceId: 'user-limit' } as any);
      // Create a few more threads so there's something to page.
      const session = await mastra
        .getHarness('code')!
        .createSession({ resourceId: 'user-limit', id: 'user-limit', ownerId: 'code' });
      for (let i = 0; i < 4; i++) await session.thread.create({ title: `t${i}` });

      const res = (await LIST_HARNESS_THREADS_ROUTE.handler({
        mastra,
        harnessId: 'code',
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
      await CREATE_HARNESS_SESSION_ROUTE.handler({ mastra, harnessId: 'code', resourceId: 'user-wt' } as any);
      const session = await mastra.getHarness('code')!.createSession({ resourceId: 'user-wt' });

      await session.state.set({ projectPath: '/repo/worktree-a' } as any);
      await session.thread.create({ title: 'a1' });
      await session.thread.create({ title: 'a2' });
      await session.state.set({ projectPath: '/repo/worktree-b' } as any);
      await session.thread.create({ title: 'b1' });

      const onlyA = (await LIST_HARNESS_THREADS_ROUTE.handler({
        mastra,
        harnessId: 'code',
        resourceId: 'user-wt',
        tags: { projectPath: '/repo/worktree-a' },
      } as any)) as { threads: { title?: string; tags?: Record<string, string> }[] };
      expect(onlyA.threads.map(t => t.title).sort()).toEqual(['a1', 'a2']);
      expect(onlyA.threads.every(t => t.tags?.projectPath === '/repo/worktree-a')).toBe(true);

      const onlyB = (await LIST_HARNESS_THREADS_ROUTE.handler({
        mastra,
        harnessId: 'code',
        resourceId: 'user-wt',
        tags: { projectPath: '/repo/worktree-b' },
      } as any)) as { threads: { title?: string }[] };
      expect(onlyB.threads.map(t => t.title)).toEqual(['b1']);

      // Without tags, every thread for the resource is returned (including the
      // untagged auto-created startup thread).
      const all = (await LIST_HARNESS_THREADS_ROUTE.handler({
        mastra,
        harnessId: 'code',
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
      const victim = (await CREATE_HARNESS_SESSION_ROUTE.handler({
        mastra,
        harnessId: 'code',
        resourceId: 'victim',
      } as any)) as { threadId?: string };
      await CREATE_HARNESS_SESSION_ROUTE.handler({ mastra, harnessId: 'code', resourceId: 'attacker' } as any);
      return { victimThreadId: victim.threadId! };
    }

    it('DELETE rejects a thread owned by another resource', async () => {
      const { victimThreadId } = await setupTwoSessions();
      await expect(
        DELETE_HARNESS_THREAD_ROUTE.handler({
          mastra,
          harnessId: 'code',
          resourceId: 'attacker',
          threadId: victimThreadId,
        } as any),
      ).rejects.toThrow('Thread not found');

      // The victim's thread is untouched.
      const victimThreads = (await LIST_HARNESS_THREADS_ROUTE.handler({
        mastra,
        harnessId: 'code',
        resourceId: 'victim',
      } as any)) as { threads: { id: string }[] };
      expect(victimThreads.threads.some(t => t.id === victimThreadId)).toBe(true);
    });

    it('RENAME rejects a thread owned by another resource', async () => {
      const { victimThreadId } = await setupTwoSessions();
      await expect(
        RENAME_HARNESS_THREAD_ROUTE.handler({
          mastra,
          harnessId: 'code',
          resourceId: 'attacker',
          threadId: victimThreadId,
          title: 'pwned',
        } as any),
      ).rejects.toThrow('Thread not found');
    });

    it('LIST messages rejects a thread owned by another resource', async () => {
      const { victimThreadId } = await setupTwoSessions();
      await expect(
        LIST_HARNESS_THREAD_MESSAGES_ROUTE.handler({
          mastra,
          harnessId: 'code',
          resourceId: 'attacker',
          threadId: victimThreadId,
        } as any),
      ).rejects.toThrow('Thread not found');
    });

    it('SWITCH rejects a thread owned by another resource', async () => {
      const { victimThreadId } = await setupTwoSessions();
      await expect(
        SWITCH_HARNESS_THREAD_ROUTE.handler({
          mastra,
          harnessId: 'code',
          resourceId: 'attacker',
          threadId: victimThreadId,
        } as any),
      ).rejects.toThrow('Thread not found');
    });
  });
});

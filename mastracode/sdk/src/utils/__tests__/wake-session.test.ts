import type { Session } from '@mastra/core/agent-controller';
import { describe, expect, it } from 'vitest';

import { FOREIGN_THREAD, findWakeSession, sessionLeaseScopes, threadScopeKey } from '../wake-session.js';

type Thread = { id: string; resourceId: string; metadata?: Record<string, unknown> };

function session(
  resourceId: string,
  scope: Record<string, string>,
  threads: Thread[],
  openThreadId: string | null = null,
): Session<unknown> {
  return {
    identity: { getResourceId: () => resourceId },
    getThreadScope: () => scope,
    thread: {
      getId: () => openThreadId,
      getById: async ({ threadId }: { threadId: string }) => threads.find(t => t.id === threadId) ?? null,
    },
  } as unknown as Session<unknown>;
}

const threads: Thread[] = [
  { id: 'th-a', resourceId: 'team', metadata: { projectPath: '/homes/a' } },
  { id: 'th-b', resourceId: 'team', metadata: { projectPath: '/homes/b' } },
  { id: 'th-old', resourceId: 'team', metadata: {} },
];

describe('findWakeSession', () => {
  const a = session('team', { projectPath: '/homes/a' }, threads);
  const controller = (found?: Session<unknown>) => ({ getSessionByResource: async () => found });
  const scopeA = threadScopeKey({ projectPath: '/homes/a' });

  it('runs a thread as the session whose project it belongs to, under its project dispatch lease', async () => {
    expect(await findWakeSession(controller(a), [a], { resourceId: 'team', threadId: 'th-a' })).toEqual({
      session: a,
      scope: scopeA,
    });
  });

  it("refuses a thread from another project that shares this session's resource", async () => {
    // Two processes in different directories share the `team` resource; this one must not run b's thread.
    expect(await findWakeSession(controller(a), [a], { resourceId: 'team', threadId: 'th-b' })).toBe(FOREIGN_THREAD);
  });

  it("runs another project's thread in the session that has it open, under a lease for that thread alone", async () => {
    const openOnB = session('team', { projectPath: '/homes/a' }, threads, 'th-b');
    expect(await findWakeSession(controller(openOnB), [openOnB], { resourceId: 'team', threadId: 'th-b' })).toEqual({
      session: openOnB,
      scope: threadScopeKey({ openThread: 'th-b' }),
    });
  });

  it('prefers the session that has the thread open over one whose project tag matches', async () => {
    const b = session('team', { projectPath: '/homes/b' }, threads);
    const openOnA = session('team', { projectPath: '/homes/a' }, threads, 'th-b');
    expect(await findWakeSession(controller(b), [b, openOnA], { resourceId: 'team', threadId: 'th-b' })).toEqual({
      session: openOnA,
      scope: threadScopeKey({ openThread: 'th-b' }),
    });
  });

  it('yields a thread to the process that has it open from another project', async () => {
    const b = session('team', { projectPath: '/homes/b' }, threads);
    const leases = (owner?: string) => ({ getLeaseOwner: async (_key: string) => owner });
    const lookup = { resourceId: 'team', threadId: 'th-b' };
    expect(await findWakeSession(controller(b), [b], lookup, leases('other-process'))).toBe(FOREIGN_THREAD);
    expect(await findWakeSession(controller(b), [b], lookup, leases(undefined))).toEqual({
      session: b,
      scope: threadScopeKey({ projectPath: '/homes/b' }),
    });
  });

  it('picks the matching session when this process has several for the resource', async () => {
    const b = session('team', { projectPath: '/homes/b' }, threads);
    expect(await findWakeSession(controller(a), [a, b], { resourceId: 'team', threadId: 'th-b' })).toEqual({
      session: b,
      scope: threadScopeKey({ projectPath: '/homes/b' }),
    });
  });

  it("keeps a thread with no scope, an unknown thread and an unserved resource as before, under the resource's lease", async () => {
    expect(await findWakeSession(controller(a), [a], { resourceId: 'team', threadId: 'th-old' })).toEqual({
      session: a,
      scope: undefined,
    });
    expect(await findWakeSession(controller(a), [a], { resourceId: 'team', threadId: 'th-new' })).toEqual({
      session: a,
    });
    expect(await findWakeSession(controller(undefined), [], { resourceId: 'team', threadId: 'th-a' })).toBeUndefined();
  });
});

describe('threadScopeKey', () => {
  it('names a scope by its entries in any order, and no scope as none', () => {
    expect(threadScopeKey({ a: '1', b: '2' })).toBe(threadScopeKey({ b: '2', a: '1' }));
    expect(threadScopeKey({ projectPath: '/x' })).not.toBe(threadScopeKey({ projectPath: '/y' }));
    expect(threadScopeKey({})).toBeUndefined();
  });
});

describe('sessionLeaseScopes', () => {
  const threads: Thread[] = [
    { id: 'th-a', resourceId: 'team', metadata: { projectPath: '/homes/a' } },
    { id: 'th-b', resourceId: 'team', metadata: { projectPath: '/homes/b' } },
    { id: 'th-old', resourceId: 'team', metadata: {} },
  ];
  const scopeA = threadScopeKey({ projectPath: '/homes/a' });

  it('adds a lease for the open thread alone when it belongs to another project', async () => {
    expect(await sessionLeaseScopes(session('team', { projectPath: '/homes/a' }, threads, 'th-b'))).toEqual([
      scopeA,
      threadScopeKey({ openThread: 'th-b' }),
    ]);
  });

  it("needs only the session's own lease for its own, untagged or no open thread", async () => {
    for (const open of ['th-a', 'th-old', null]) {
      expect(await sessionLeaseScopes(session('team', { projectPath: '/homes/a' }, threads, open))).toEqual([scopeA]);
    }
  });
});

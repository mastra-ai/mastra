import type { Session } from '@mastra/core/agent-controller';
import { describe, expect, it } from 'vitest';

import { FOREIGN_THREAD, findWakeSession, threadScopeKey } from '../wake-session.js';

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

  it('runs a thread in the session that has it open, even when its project tag names another checkout', async () => {
    const openOnB = session('team', { projectPath: '/homes/a' }, threads, 'th-b');
    expect(await findWakeSession(controller(openOnB), [openOnB], { resourceId: 'team', threadId: 'th-b' })).toEqual({
      session: openOnB,
      scope: scopeA,
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

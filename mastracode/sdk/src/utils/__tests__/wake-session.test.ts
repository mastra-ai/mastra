import type { Session } from '@mastra/core/agent-controller';
import { describe, expect, it } from 'vitest';

import { FOREIGN_THREAD, findWakeSession } from '../wake-session.js';

type Thread = { id: string; resourceId: string; metadata?: Record<string, unknown> };

function session(resourceId: string, scope: Record<string, string>, threads: Thread[]): Session<unknown> {
  return {
    identity: { getResourceId: () => resourceId },
    getThreadScope: () => scope,
    thread: { getById: async ({ threadId }: { threadId: string }) => threads.find(t => t.id === threadId) ?? null },
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

  it('runs a thread as the session whose project it belongs to', async () => {
    expect(await findWakeSession(controller(a), [a], { resourceId: 'team', threadId: 'th-a' })).toBe(a);
  });

  it("refuses a thread from another project that shares this session's resource", async () => {
    // Two processes in different directories share the `team` resource; this one must not run b's thread.
    expect(await findWakeSession(controller(a), [a], { resourceId: 'team', threadId: 'th-b' })).toBe(FOREIGN_THREAD);
  });

  it('picks the matching session when this process has several for the resource', async () => {
    const b = session('team', { projectPath: '/homes/b' }, threads);
    expect(await findWakeSession(controller(a), [a, b], { resourceId: 'team', threadId: 'th-b' })).toBe(b);
  });

  it('keeps a thread with no scope, an unknown thread and an unserved resource as before', async () => {
    expect(await findWakeSession(controller(a), [a], { resourceId: 'team', threadId: 'th-old' })).toBe(a);
    expect(await findWakeSession(controller(a), [a], { resourceId: 'team', threadId: 'th-new' })).toBe(a);
    expect(await findWakeSession(controller(undefined), [], { resourceId: 'team', threadId: 'th-a' })).toBeUndefined();
  });
});

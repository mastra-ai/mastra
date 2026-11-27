import { describe, expect, it } from 'vitest';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { resolveAttributionUserId } from './run-attribution.js';

const FACTORY = 'factory-project:project-1';

function row(sessionId: string, userId: string, originSessionId: string | null = null): SourceControlSession {
  return { sessionId, orgId: 'org-1', userId, originSessionId } as SourceControlSession;
}

/**
 * Sessions by id, each bound to a card whose `work` role was started by `initiatedBy` (if any).
 * `roleSession` names the session the card's role ref points at now, when the role was restarted.
 */
function world(
  rows: SourceControlSession[],
  runs: Record<string, { initiatedBy?: string; roleSession?: string }> = {},
) {
  const bySession = new Map(rows.map(session => [session.sessionId, session]));
  return {
    sessions: { getBySessionId: async (sessionId: string) => bySession.get(sessionId) ?? null },
    workItems: {
      listRunBindingsForSession: async ({ sessionId }: { orgId: string; sessionId: string }) =>
        runs[sessionId] ? [{ orgId: 'org-1', workItemId: `card-${sessionId}`, role: 'work', sessionId }] : [],
      get: async ({ id }: { orgId: string; id: string }) => {
        const sessionId = id.replace(/^card-/, '');
        const run = runs[sessionId];
        if (!run) return null;
        const { roleSession = sessionId, initiatedBy } = run;
        return {
          sessions: {
            work: {
              sessionId: roleSession,
              branch: 'b',
              threadId: 't',
              startedBy: FACTORY,
              ...(initiatedBy ? { initiatedBy } : {}),
            },
          },
        };
      },
    } as never,
  };
}

const resolve = (authenticatedUserId: string, session: SourceControlSession, sources: ReturnType<typeof world>) =>
  resolveAttributionUserId({ authenticatedUserId, session, factoryProjectId: 'project-1', ...sources });

describe('resolveAttributionUserId', () => {
  it('credits the person who started a Factory-owned run', async () => {
    const run = row('run', FACTORY);
    expect(await resolve(FACTORY, run, world([run], { run: { initiatedBy: 'person-1' } }))).toBe('person-1');
  });

  it('credits the Factory for a run nobody started, never its creator', async () => {
    const run = row('run', FACTORY);
    expect(await resolve(FACTORY, run, world([run], { run: {} }))).toBe(FACTORY);
    // A personal Factory's run is owned by its creator, who still did not start it.
    const personal = row('personal-run', 'creator-1');
    expect(await resolve('creator-1', personal, world([personal], { 'personal-run': {} }))).toBe(FACTORY);
  });

  it('never credits the person who restarted a role to the run it replaced', async () => {
    const replaced = row('run', FACTORY);
    const side = row('side', FACTORY, 'run');
    const restarted = world([replaced, side], { run: { initiatedBy: 'person-2', roleSession: 'run-2' } });
    expect(await resolve(FACTORY, replaced, restarted)).toBe(FACTORY);
    expect(await resolve(FACTORY, side, restarted)).toBe(FACTORY);
  });

  it('keeps the credit of a person working in a session they do not own', async () => {
    const run = row('run', FACTORY);
    expect(await resolve('person-2', run, world([run], { run: { initiatedBy: 'person-1' } }))).toBe('person-2');
  });

  it("credits a person's own session to them", async () => {
    const own = row('own', 'person-1');
    expect(await resolve('person-1', own, world([own]))).toBe('person-1');
  });

  it("credits a Factory-owned side session to its origin run's person", async () => {
    const run = row('run', FACTORY);
    const side = row('side', FACTORY, 'run');
    const sideOfSide = row('side-2', FACTORY, 'side');
    const sources = world([run, side, sideOfSide], { run: { initiatedBy: 'person-1' } });
    expect(await resolve(FACTORY, side, sources)).toBe('person-1');
    expect(await resolve(FACTORY, sideOfSide, sources)).toBe('person-1');
  });

  it('stops walking origins after a bounded depth and on a cycle', async () => {
    const chain = [row('run', FACTORY)];
    for (let index = 1; index <= 7; index++)
      chain.push(row(`side-${index}`, FACTORY, index === 1 ? 'run' : `side-${index - 1}`));
    const sources = world(chain, { run: { initiatedBy: 'person-1' } });
    expect(await resolve(FACTORY, chain[5]!, sources)).toBe('person-1');
    expect(await resolve(FACTORY, chain[7]!, sources)).toBe(FACTORY);

    const loopA = row('loop-a', FACTORY, 'loop-b');
    const loopB = row('loop-b', FACTORY, 'loop-a');
    expect(await resolve(FACTORY, loopA, world([loopA, loopB]))).toBe(FACTORY);
  });

  it('credits the Factory when it has no cards to read', async () => {
    const run = row('run', FACTORY);
    expect(
      await resolveAttributionUserId({
        authenticatedUserId: FACTORY,
        session: run,
        factoryProjectId: 'project-1',
        sessions: world([run]).sessions,
      }),
    ).toBe(FACTORY);
  });
});

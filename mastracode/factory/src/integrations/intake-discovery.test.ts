import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { withIntakeDiscovery } from './intake-discovery.js';
import type { IssueReconcileSummary } from './issue-reconciler.js';

interface Issue {
  id: string;
}

const refreshed: IssueReconcileSummary = { projects: 0, checked: 3, updated: 1, closed: 0, missing: 0, failed: 0, errors: [] };

/**
 * Real project and intake storage. The provider side is the two functions a
 * provider hands the sweep: how it lists a project's issues and how it files them.
 */
async function setup(
  list: (projectId: string, cursor: string | undefined, sourceId: string) => { issues: Issue[]; next?: string },
  maxPages?: number,
) {
  const seeded = await createFactoryStorageForTests();
  const filed = new Map<string, string[]>();
  const listed: Array<{ projectId: string; cursor: string | undefined; sourceId: string }> = [];
  const project = async (orgId: string, selection: { enabled: boolean; sourceIds: string[] } | null) => {
    const { id } = await seeded.projects.create({ orgId, userId: 'user-1', input: { name: 'Factory' } });
    if (selection) await seeded.intake.saveConfig({ orgId, config: { tracker: selection } });
    return id;
  };
  const sweep = withIntakeDiscovery<Issue>(async () => ({ ...refreshed, errors: [] }), {
    integrationId: 'tracker',
    intake: seeded.intake,
    projects: seeded.projects,
    ...(maxPages ? { maxPages } : {}),
    open: async (current, selectedIds) =>
      selectedIds.map(sourceId => async (cursor: string | undefined) => {
        listed.push({ projectId: current.id, cursor, sourceId });
        const page = list(current.id, cursor, sourceId);
        return { issues: page.issues, nextCursor: page.next ?? null };
      }),
    ingest: async input => {
      expect(input.userId).toBe('factory-rule-dispatcher');
      filed.set(input.factoryProjectId, [
        ...(filed.get(input.factoryProjectId) ?? []),
        ...input.issues.map(issue => issue.id),
      ]);
    },
  });
  return { project, sweep, filed, listed };
}

describe('intake discovery on a reconcile sweep', () => {
  it('files what each project lists, page after page, and keeps what the refresh reported', async () => {
    const { project, sweep, filed, listed } = await setup((_, cursor) =>
      cursor ? { issues: [{ id: 'second' }] } : { issues: [{ id: 'first' }], next: 'page-2' },
    );
    const id = await project('org-1', { enabled: true, sourceIds: ['source-1'] });

    await expect(sweep()).resolves.toEqual({ ...refreshed, observed: 2 });
    expect(filed.get(id)).toEqual(['first', 'second']);
    expect(listed.map(({ cursor }) => cursor)).toEqual([undefined, 'page-2']);
  });

  it('stops listing a source after five pages', async () => {
    const { project, sweep, listed } = await setup(() => ({ issues: [{ id: 'issue' }], next: 'more' }));
    await project('org-1', { enabled: true, sourceIds: ['source-1'] });

    await expect(sweep()).resolves.toMatchObject({ observed: 5, failed: 0 });
    expect(listed).toHaveLength(5);
  });

  it('gives each source its own five pages, so a busy source cannot starve the next', async () => {
    const { project, sweep, filed } = await setup((_, __, sourceId) =>
      sourceId === 'busy' ? { issues: [{ id: 'busy-issue' }], next: 'more' } : { issues: [{ id: 'new-issue' }] },
    );
    const id = await project('org-1', { enabled: true, sourceIds: ['busy', 'quiet'] });

    await expect(sweep()).resolves.toMatchObject({ observed: 6, failed: 0 });
    expect(filed.get(id)).toContain('new-issue');
  });

  it('reads a source to its end when the provider asks for every page', async () => {
    const { project, sweep, listed } = await setup(
      (_, cursor) => {
        const page = Number(cursor ?? 0);
        return { issues: [{ id: `issue-${page}` }], ...(page < 7 ? { next: String(page + 1) } : {}) };
      },
      Number.POSITIVE_INFINITY,
    );
    await project('org-1', { enabled: true, sourceIds: ['source-1'] });

    await expect(sweep()).resolves.toMatchObject({ observed: 8, failed: 0 });
    expect(listed).toHaveLength(8);
  });

  it('lists nothing for an org that turned the provider off, saved no selection, or selected no source', async () => {
    const { project, sweep, filed, listed } = await setup(() => ({ issues: [{ id: 'issue' }] }));
    await project('org-off', { enabled: false, sourceIds: ['source-1'] });
    await project('org-unset', null);
    await project('org-empty', { enabled: true, sourceIds: [] });

    await expect(sweep()).resolves.toMatchObject({ observed: 0, failed: 0 });
    expect(listed).toEqual([]);
    expect(filed.size).toBe(0);
  });

  it('records a project whose listing fails and still files the others', async () => {
    let broken: string | undefined;
    const { project, sweep, filed } = await setup(projectId => {
      broken ??= projectId;
      if (projectId === broken) throw new Error('provider unavailable');
      return { issues: [{ id: 'issue' }] };
    });
    const ids = [
      await project('org-1', { enabled: true, sourceIds: ['source-1'] }),
      await project('org-2', { enabled: true, sourceIds: ['source-1'] }),
    ];

    const summary = await sweep();
    expect(summary).toMatchObject({
      observed: 1,
      failed: 1,
      errors: [{ projectId: broken, error: 'provider unavailable' }],
    });
    const healthy = ids.find(id => id !== broken)!;
    expect(filed.get(healthy)).toEqual(['issue']);
    expect(filed.has(broken!)).toBe(false);
  });
});

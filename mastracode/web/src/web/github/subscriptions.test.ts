import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from './db';
import { githubProjects, MIGRATION_SQL } from './schema';

vi.mock('drizzle-orm', async importOriginal => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (column: { name: string }, value: unknown) => ({ kind: 'eq', column: column.name, value }),
    and: (...conditions: Condition[]) => ({ kind: 'and', conditions }),
  };
});

interface EqCondition {
  kind: 'eq';
  column: string;
  value: unknown;
}

interface AndCondition {
  kind: 'and';
  conditions: Condition[];
}

type Condition = EqCondition | AndCondition;
type Row = Record<string, any>;

const columnToProperty: Record<string, string> = {
  org_id: 'orgId',
  installation_id: 'installationId',
  github_project_id: 'githubProjectId',
  repo_id: 'repoId',
  pull_request_number: 'pullRequestNumber',
  session_id: 'sessionId',
  resource_id: 'resourceId',
  thread_id: 'threadId',
  session_scope: 'sessionScope',
  status: 'status',
};

function matches(row: Row, condition: Condition): boolean {
  if (condition.kind === 'and') return condition.conditions.every(item => matches(row, item));
  return row[columnToProperty[condition.column] ?? condition.column] === condition.value;
}

function createFakeDb() {
  const projects: Row[] = [];
  const subscriptions: Row[] = [];
  const rowsFor = (table: unknown) => (table === githubProjects ? projects : subscriptions);

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: async (condition: Condition) => rowsFor(table).filter(row => matches(row, condition)),
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Row) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            const duplicate = subscriptions.find(
              row =>
                row.orgId === values.orgId &&
                row.githubProjectId === values.githubProjectId &&
                row.repoId === values.repoId &&
                row.pullRequestNumber === values.pullRequestNumber &&
                row.sessionId === values.sessionId &&
                row.resourceId === values.resourceId &&
                row.threadId === values.threadId &&
                row.sessionScope === values.sessionScope,
            );
            if (duplicate) return [];
            const row = {
              id: `subscription-${subscriptions.length + 1}`,
              createdAt: new Date('2026-07-13T00:00:00Z'),
              updatedAt: new Date('2026-07-13T00:00:00Z'),
              subscribedByUserId: null,
              status: 'open',
              ...values,
            };
            rowsFor(table).push(row);
            return [row];
          },
        }),
      }),
    }),
    delete: (table: unknown) => ({
      where: async (condition: Condition) => {
        const rows = rowsFor(table);
        for (let index = rows.length - 1; index >= 0; index--) {
          if (matches(rows[index]!, condition)) rows.splice(index, 1);
        }
      },
    }),
    update: (table: unknown) => ({
      set: (values: Row) => ({
        where: async (condition: Condition) => {
          for (const row of rowsFor(table)) {
            if (matches(row, condition)) Object.assign(row, values);
          }
        },
      }),
    }),
  } as unknown as AppDb;

  return { db, projects, subscriptions };
}

const baseInput = {
  orgId: 'org-a',
  installationId: 17,
  githubProjectId: '11111111-1111-1111-1111-111111111111',
  repoId: 99,
  pullRequestNumber: 42,
  sessionId: 'session-a',
  ownerId: 'user-a',
  resourceId: 'resource-a',
  threadId: 'thread-a',
  sessionScope: '/workspace/a',
  source: 'explicit-tool' as const,
  subscribedByUserId: 'user-a',
};

describe('GitHub signal subscription store', () => {
  let fake: ReturnType<typeof createFakeDb>;

  beforeEach(() => {
    fake = createFakeDb();
    fake.projects.push({
      id: baseInput.githubProjectId,
      orgId: baseInput.orgId,
      installationId: baseInput.installationId,
      repoId: baseInput.repoId,
      repoFullName: 'octo/hello',
    });
  });

  it('defines repeatable boot DDL for the table and indexes', () => {
    expect(MIGRATION_SQL).toContain('CREATE TABLE IF NOT EXISTS github_signal_subscriptions');
    expect(MIGRATION_SQL).toContain('CREATE UNIQUE INDEX IF NOT EXISTS github_signal_subscriptions_target_pr_unique');
    expect(MIGRATION_SQL).toContain('CREATE INDEX IF NOT EXISTS github_signal_subscriptions_pr_lookup');
    expect(MIGRATION_SQL).toContain('CREATE INDEX IF NOT EXISTS github_signal_subscriptions_thread_lookup');
  });

  it('creates a subscription with project-owned repository metadata', async () => {
    const { subscribeToPullRequest } = await import('./subscriptions');
    const created = await subscribeToPullRequest(baseInput, fake.db);

    expect(created).toMatchObject({
      ...baseInput,
      repoFullName: 'octo/hello',
    });
    expect(fake.subscriptions).toHaveLength(1);
  });

  it('returns the existing row for duplicate subscriptions', async () => {
    const { subscribeToPullRequest } = await import('./subscriptions');
    const first = await subscribeToPullRequest(baseInput, fake.db);
    const second = await subscribeToPullRequest(baseInput, fake.db);

    expect(second.id).toBe(first.id);
    expect(fake.subscriptions).toHaveLength(1);
  });

  it('reactivates a retained terminal subscription when subscribing again', async () => {
    const { retirePullRequestSubscription, subscribeToPullRequest } = await import('./subscriptions');
    const first = await subscribeToPullRequest(baseInput, fake.db);
    await retirePullRequestSubscription(first.id, 'closed', fake.db);

    const reactivated = await subscribeToPullRequest(baseInput, fake.db);

    expect(reactivated.id).toBe(first.id);
    expect(reactivated.status).toBe('open');
    expect(fake.subscriptions[0]?.status).toBe('open');
  });

  it('unsubscribes idempotently', async () => {
    const { subscribeToPullRequest, unsubscribeFromPullRequest } = await import('./subscriptions');
    await subscribeToPullRequest(baseInput, fake.db);
    await unsubscribeFromPullRequest(baseInput, fake.db);
    await unsubscribeFromPullRequest(baseInput, fake.db);

    expect(fake.subscriptions).toHaveLength(0);
  });

  it('supports reverse lookup by pull request and by scoped thread', async () => {
    const { listPullRequestSubscriptions, listPullRequestSubscriptionsForThread, subscribeToPullRequest } =
      await import('./subscriptions');
    await subscribeToPullRequest(baseInput, fake.db);
    await subscribeToPullRequest(
      { ...baseInput, sessionId: 'session-b', threadId: 'thread-b', sessionScope: '/workspace/b' },
      fake.db,
    );

    const forPullRequest = await listPullRequestSubscriptions(
      {
        orgId: baseInput.orgId,
        installationId: baseInput.installationId,
        repoId: baseInput.repoId,
        pullRequestNumber: baseInput.pullRequestNumber,
      },
      fake.db,
    );
    const forThread = await listPullRequestSubscriptionsForThread(
      {
        orgId: baseInput.orgId,
        resourceId: baseInput.resourceId,
        threadId: baseInput.threadId,
        sessionScope: baseInput.sessionScope,
      },
      fake.db,
    );

    expect(forPullRequest).toHaveLength(2);
    expect(forThread).toHaveLength(1);
    expect(forThread[0]?.sessionId).toBe('session-a');
  });

  it('supports installation-scoped webhook lookup and per-target retirement', async () => {
    const { listPullRequestSubscriptionsForWebhook, retirePullRequestSubscription, subscribeToPullRequest } =
      await import('./subscriptions');
    const first = await subscribeToPullRequest(baseInput, fake.db);
    const second = await subscribeToPullRequest(
      { ...baseInput, sessionId: 'session-c', threadId: 'thread-c' },
      fake.db,
    );

    const matches = await listPullRequestSubscriptionsForWebhook(
      {
        installationId: baseInput.installationId,
        repoId: baseInput.repoId,
        pullRequestNumber: baseInput.pullRequestNumber,
      },
      {},
      fake.db,
    );
    expect(matches.map(row => row.id)).toEqual([first.id, second.id]);

    await retirePullRequestSubscription(first.id, 'merged', fake.db);
    expect(fake.subscriptions).toHaveLength(2);
    expect(fake.subscriptions.find(row => row.id === first.id)?.status).toBe('merged');
    expect(
      (
        await listPullRequestSubscriptionsForWebhook(
          {
            installationId: baseInput.installationId,
            repoId: baseInput.repoId,
            pullRequestNumber: baseInput.pullRequestNumber,
          },
          {},
          fake.db,
        )
      ).map(row => row.id),
    ).toEqual([second.id]);
  });

  it('retires all subscriptions for one pull request', async () => {
    const { listPullRequestSubscriptions, retirePullRequestSubscriptions, subscribeToPullRequest } =
      await import('./subscriptions');
    await subscribeToPullRequest(baseInput, fake.db);
    await subscribeToPullRequest({ ...baseInput, pullRequestNumber: 43 }, fake.db);

    await retirePullRequestSubscriptions(
      {
        orgId: baseInput.orgId,
        installationId: baseInput.installationId,
        repoId: baseInput.repoId,
        pullRequestNumber: baseInput.pullRequestNumber,
      },
      fake.db,
    );

    expect(
      await listPullRequestSubscriptions(
        {
          orgId: baseInput.orgId,
          installationId: baseInput.installationId,
          repoId: baseInput.repoId,
          pullRequestNumber: baseInput.pullRequestNumber,
        },
        fake.db,
      ),
    ).toEqual([]);
    expect(fake.subscriptions).toHaveLength(1);
  });

  it('rejects cross-org project access and isolates reverse lookups', async () => {
    const { listPullRequestSubscriptions, subscribeToPullRequest } = await import('./subscriptions');
    await subscribeToPullRequest(baseInput, fake.db);

    await expect(subscribeToPullRequest({ ...baseInput, orgId: 'org-b' }, fake.db)).rejects.toThrow(
      'GitHub project not found',
    );
    expect(
      await listPullRequestSubscriptions(
        {
          orgId: 'org-b',
          installationId: baseInput.installationId,
          repoId: baseInput.repoId,
          pullRequestNumber: baseInput.pullRequestNumber,
        },
        fake.db,
      ),
    ).toEqual([]);
  });
});

import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests, createIsolatedFactoryPostgresForTests } from '../../test-utils.js';
import { WorkItemUpdateConflictError } from './base.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])(
  'card metadata committed with a decision on %s',
  backend => {
    async function setup() {
      const storage =
        backend === 'postgres'
          ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
          : new LibSQLFactoryStorage({ id: `card-metadata-${randomUUID()}`, url: ':memory:' });
      const { workItems } = await createFactoryStorageForTests(storage);
      const scope = { orgId: randomUUID(), factoryProjectId: 'project' };
      const { item } = await workItems.upsert({
        ...scope,
        userId: 'user',
        input: {
          title: 'Issue',
          board: 'work',
          stages: ['planning'],
          externalSource: { integrationId: 'linear', type: 'issue', externalId: `linear:${randomUUID()}` },
          metadata: { labels: ['bug'], observedItem: { labels: ['bug'], observedAt: '2030-01-01T00:00:01Z' } },
        },
      });
      const commit = (identity: string, expectedRevision: number, labels: string[]) =>
        workItems.commitRuleEvaluation({
          ...scope,
          workItemId: item.id,
          ingress: { identity, triggerType: 'test' },
          configVersion: 'v1',
          expectedRevision,
          actor: { type: 'system', id: 'rules' },
          outcome: { status: 'accepted' },
          decisions: [
            {
              type: 'routeEvent',
              idempotencyKey: identity,
              event: { type: 'work_item.updated', labels: { added: labels, removed: [] } },
            },
          ],
          causalChain: [],
          now: new Date(),
          cardMetadata: { userId: 'rules', metadata: { labels, observedItem: { labels, observedAt: identity } } },
        });
      const read = async () => (await workItems.get({ orgId: scope.orgId, id: item.id }))!;
      const queued = async () =>
        (await workItems.listDeferredDecisions(scope.orgId, scope.factoryProjectId, { workItemId: item.id })).map(
          record => record.decision.idempotencyKey,
        );
      return { workItems, scope, item, commit, read, queued };
    }

    it('records what the evaluation saw with the change it queued, and neither once another write moved the card', async () => {
      const { item, commit, read, queued } = await setup();

      // Two evaluations read the card at the same revision; the first to commit wins.
      await expect(commit('t3', item.revision, ['bug', 'ship'])).resolves.toMatchObject({ status: 'committed' });
      await expect(commit('t2', item.revision, ['bug', 'wip'])).resolves.toEqual({ status: 'stale' });

      const stored = await read();
      expect(stored.workItem.labels).toEqual(['bug', 'ship']);
      expect(stored.metadata?.observedItem ?? stored.workItem.metadata?.observedItem).toEqual({
        labels: ['bug', 'ship'],
        observedAt: 't3',
      });
      expect(await queued()).toEqual(['t3']);
    });

    it('refuses a card sync at a revision the card has moved past', async () => {
      const { workItems, scope, item, commit } = await setup();
      await commit('t3', item.revision, ['bug', 'ship']);

      await expect(
        workItems.syncCard({
          orgId: scope.orgId,
          id: item.id,
          userId: 'rules',
          patch: { metadata: { labels: [] } },
          expectedRevision: item.revision,
        }),
      ).rejects.toBeInstanceOf(WorkItemUpdateConflictError);
    });
  },
);

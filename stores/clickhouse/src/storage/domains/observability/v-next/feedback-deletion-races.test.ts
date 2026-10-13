import { randomUUID } from 'node:crypto';
import { createClient } from '@clickhouse/client';
import type { ClickHouseClient } from '@clickhouse/client';
import { coreFeatures } from '@mastra/core/features';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildFeedbackEventsDeltaDDL,
  buildFeedbackEventsDeltaMvDDL,
  DELETION_REQUESTS_DDL,
  FEEDBACK_EVENTS_DDL,
  TABLE_DELETION_REQUESTS,
  TABLE_FEEDBACK_EVENTS,
} from './ddl';
import { createFeedback, deleteFeedback, listFeedback, updateFeedbackReviewStatus } from './feedback';

function gate() {
  let open!: () => void;
  const opened = new Promise<void>(resolve => (open = resolve));
  return { open, opened };
}

// Three real ReplicatedMergeTree replicas in separate databases on the test
// server. Only receipt replication is paused; feedback rows still reach
// every replica. This exercises Keeper/quorum errors without mocking them.
describe('feedback deletion with lagging replicas', () => {
  const config = {
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || 'password',
    clickhouse_settings: { async_insert: 0 as const },
  };
  let admin: ClickHouseClient;
  let clients: ClickHouseClient[];
  let databases: string[];

  beforeEach(async () => {
    admin = createClient(config);
    const id = randomUUID().replaceAll('-', '');
    databases = [0, 1, 2].map(replica => `feedback_race_${id}_${replica}`);
    clients = [];
    for (const [replica, database] of databases.entries()) {
      await admin.command({ query: `CREATE DATABASE ${database}` });
      const client = createClient({ ...config, database });
      clients.push(client);
      for (const [ddl, table, version] of [
        [DELETION_REQUESTS_DDL, TABLE_DELETION_REQUESTS, 'updatedAt'],
        [FEEDBACK_EVENTS_DDL, TABLE_FEEDBACK_EVENTS, undefined],
      ] as const) {
        await client.command({
          query: ddl.replace(
            /ENGINE = ReplacingMergeTree(?:\(updatedAt\))?/,
            `ENGINE = ReplicatedReplacingMergeTree('/mastra/tests/${id}/${table}', '${replica}'${version ? `, ${version}` : ''})`,
          ),
        });
      }
    }
  }, 60_000);

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const client of clients) {
      await client.command({ query: `SYSTEM START FETCHES ${TABLE_DELETION_REQUESTS}` });
      await client.close();
    }
    for (const database of databases) await admin.command({ query: `DROP DATABASE ${database} SYNC` });
    await admin.close();
  }, 60_000);

  async function syncReceipts() {
    for (const client of clients) await client.command({ query: `SYSTEM SYNC REPLICA ${TABLE_DELETION_REQUESTS}` });
  }

  async function visibleFeedback(client: ClickHouseClient) {
    const result = await client.query({
      query: `SELECT feedbackId, reviewStatus FROM ${TABLE_FEEDBACK_EVENTS} FINAL`,
      format: 'JSONEachRow',
    });
    return result.json();
  }

  async function seed(client: ClickHouseClient, feedbackId: string, traceId: string | null = `trace-${feedbackId}`) {
    await createFeedback(client, {
      feedback: {
        feedbackId,
        timestamp: new Date(),
        traceId,
        feedbackSource: 'user',
        feedbackType: 'rating',
        value: 1,
        organizationId: 'org-1',
        resourceId: 'resource-1',
      },
    });
    for (const replica of clients) await replica.command({ query: `SYSTEM SYNC REPLICA ${TABLE_FEEDBACK_EVENTS}` });
  }

  async function requestStates(client: ClickHouseClient) {
    const result = await client.query({
      query: `SELECT lastAppliedAt > toDateTime64(0, 3) AS applied FROM ${TABLE_DELETION_REQUESTS} FINAL ORDER BY applied`,
      format: 'JSONEachRow',
    });
    return result.json();
  }

  /** Pauses the review's replacement-row insert until `release` opens. */
  function holdReviewInsert(client: ClickHouseClient) {
    const ready = gate();
    const release = gate();
    const insert = client.insert.bind(client);
    let held = false;
    vi.spyOn(client, 'insert').mockImplementation(async args => {
      if (args.table === TABLE_FEEDBACK_EVENTS && !held) {
        held = true;
        ready.open();
        await release.opened;
      }
      return insert(args);
    });
    return { ready, release };
  }

  it.each([true, false])(
    'keeps deleted feedback hidden when the post-update guard reads a stale replica (deleted: %s)',
    async deleted => {
      const [writer, , lagging] = clients as [ClickHouseClient, ClickHouseClient, ClickHouseClient];
      await seed(writer, 'feedback-race');
      const ready = gate();
      const release = gate();
      const insert = writer.insert.bind(writer);
      const query = writer.query.bind(writer);
      let held = false;
      let stopped = false;
      let guards = 0;
      // Hold the replacement row until the delete has run. Once the pending
      // request is written, stop the lagging replica from receiving the
      // applied marker that follows.
      vi.spyOn(writer, 'insert').mockImplementation(async args => {
        if (args.table === TABLE_FEEDBACK_EVENTS && !held) {
          held = true;
          ready.open();
          await release.opened;
        }
        const result = await insert(args);
        const row = (args.values as Array<{ lastAppliedAt?: string }>)[0];
        if (!stopped && args.table === TABLE_DELETION_REQUESTS && row?.lastAppliedAt === '1970-01-01T00:00:00.000Z') {
          stopped = true;
          await syncReceipts();
          await lagging.command({ query: `SYSTEM STOP FETCHES ${TABLE_DELETION_REQUESTS}` });
        }
        return result;
      });
      // Answer the post-write guard from the replica that never saw the marker.
      vi.spyOn(writer, 'query').mockImplementation(args => {
        if (args.query.includes('has(predicateValues') && ++guards === 2) return lagging.query(args);
        return query(args);
      });
      const updating = updateFeedbackReviewStatus(writer, { feedbackId: 'feedback-race', reviewStatus: 'reviewed' });
      try {
        await Promise.race([ready.opened, updating]);
        await deleteFeedback(writer, { feedbackIds: [deleted ? 'feedback-race' : 'unrelated-feedback'] }, {});
      } finally {
        release.open();
      }
      // The replacement row lands after the DELETE. The stale replica still
      // holds the pending request, so the post-write guard re-runs the delete.
      if (deleted) await expect(updating).rejects.toThrow('Feedback record not found');
      else await expect(updating).resolves.toMatchObject({ feedbackId: 'feedback-race', reviewStatus: 'reviewed' });
      vi.restoreAllMocks();
      await lagging.command({ query: `SYSTEM START FETCHES ${TABLE_DELETION_REQUESTS}` });
      await syncReceipts();
      for (const client of clients) {
        await client.command({ query: `SYSTEM SYNC REPLICA ${TABLE_FEEDBACK_EVENTS}` });
        expect(await visibleFeedback(client)).toEqual(
          deleted ? [] : [{ feedbackId: 'feedback-race', reviewStatus: 'reviewed' }],
        );
      }
      const retry = updateFeedbackReviewStatus(writer, { feedbackId: 'feedback-race', reviewStatus: 'reviewed' });
      if (deleted) {
        await expect(retry).rejects.toThrow('Feedback record not found');
        expect(await visibleFeedback(writer)).toEqual([]);
      } else {
        await expect(retry).resolves.toMatchObject({ feedbackId: 'feedback-race', reviewStatus: 'reviewed' });
      }
    },
    60_000,
  );

  it('hides a review written after the DELETE but before its applied marker', async () => {
    const writer = clients[0]!;
    await seed(writer, 'marker-race');
    const { ready, release } = holdReviewInsert(writer);
    const deleted = gate();
    const markerRelease = gate();
    const command = writer.command.bind(writer);
    let paused = false;
    vi.spyOn(writer, 'command').mockImplementation(async args => {
      const result = await command(args);
      if (!paused && args.query.startsWith(`DELETE FROM ${TABLE_FEEDBACK_EVENTS}`)) {
        paused = true;
        deleted.open();
        await markerRelease.opened;
      }
      return result;
    });

    const updating = updateFeedbackReviewStatus(writer, { feedbackId: 'marker-race', reviewStatus: 'reviewed' });
    await ready.opened;
    const deleting = deleteFeedback(writer, { feedbackIds: ['marker-race'] }, {});
    await deleted.opened;
    release.open();
    try {
      await expect(updating).rejects.toThrow('Feedback record not found');
    } finally {
      markerRelease.open();
    }
    await deleting;

    vi.restoreAllMocks();
    for (const client of clients) {
      await client.command({ query: `SYSTEM SYNC REPLICA ${TABLE_FEEDBACK_EVENTS}` });
      expect(await visibleFeedback(client)).toEqual([]);
    }
    expect(await requestStates(writer)).toEqual([{ applied: 1 }, { applied: 1 }]);
  }, 60_000);

  /** Answers every deletion-request guard read after the first from `target`, or fails it. */
  function redirectLaterGuards(client: ClickHouseClient, target: ClickHouseClient | 'fail') {
    const query = client.query.bind(client);
    let guards = 0;
    vi.spyOn(client, 'query').mockImplementation(args => {
      if (args.query.includes('has(predicateValues') && guards++ > 0) {
        if (target === 'fail') throw new Error('socket hang up');
        return target.query(args);
      }
      return query(args);
    });
  }

  /** The replacement row leaked past a completed delete; the next review must remove it. */
  async function expectNextReviewCleansUp(writer: ClickHouseClient, feedbackId: string) {
    vi.restoreAllMocks();
    await lagging().command({ query: `SYSTEM START FETCHES ${TABLE_DELETION_REQUESTS}` });
    await syncReceipts();
    for (const client of clients) {
      await client.command({ query: `SYSTEM SYNC REPLICA ${TABLE_FEEDBACK_EVENTS}` });
      expect(await visibleFeedback(client)).toEqual([{ feedbackId, reviewStatus: 'reviewed' }]);
    }
    await expect(updateFeedbackReviewStatus(writer, { feedbackId, reviewStatus: 'needs-review' }, {})).rejects.toThrow(
      'Feedback record not found',
    );
    for (const client of clients) {
      await client.command({ query: `SYSTEM SYNC REPLICA ${TABLE_FEEDBACK_EVENTS}` });
      expect(await visibleFeedback(client)).toEqual([]);
    }
  }

  const lagging = () => clients[2]!;

  it('cleans up a review that leaked because the post-write guard read a replica without the request', async () => {
    const [writer, deleter] = clients as [ClickHouseClient, ClickHouseClient];
    await seed(writer, 'missing-request');
    await lagging().command({ query: `SYSTEM STOP FETCHES ${TABLE_DELETION_REQUESTS}` });
    const { ready, release } = holdReviewInsert(writer);
    redirectLaterGuards(writer, lagging());

    const updating = updateFeedbackReviewStatus(
      writer,
      { feedbackId: 'missing-request', reviewStatus: 'reviewed' },
      {},
    );
    await ready.opened;
    await deleteFeedback(deleter, { feedbackIds: ['missing-request'] }, {});
    release.open();
    // The stale replica has no request, so this review cannot know it lost.
    await expect(updating).resolves.toMatchObject({ reviewStatus: 'reviewed' });

    await expectNextReviewCleansUp(writer, 'missing-request');
  }, 60_000);

  it('cleans up a review that leaked because the post-write guard failed', async () => {
    const [writer, deleter] = clients as [ClickHouseClient, ClickHouseClient];
    await seed(writer, 'guard-failure');
    const { ready, release } = holdReviewInsert(writer);
    redirectLaterGuards(writer, 'fail');

    const updating = updateFeedbackReviewStatus(writer, { feedbackId: 'guard-failure', reviewStatus: 'reviewed' }, {});
    await ready.opened;
    await deleteFeedback(deleter, { feedbackIds: ['guard-failure'] }, {});
    release.open();
    await expect(updating).rejects.toThrow('socket hang up');

    await expectNextReviewCleansUp(writer, 'guard-failure');
  }, 60_000);

  it('reports a failed cleanup delete while another delete is still marking applied', async () => {
    const [writer, deleter] = clients as [ClickHouseClient, ClickHouseClient];
    await seed(writer, 'cleanup-failure');
    const { ready, release } = holdReviewInsert(writer);
    const markerReady = gate();
    const markerRelease = gate();
    const deleterInsert = deleter.insert.bind(deleter);
    vi.spyOn(deleter, 'insert').mockImplementation(async args => {
      const row = (args.values as Array<{ lastAppliedAt?: string }>)[0];
      if (args.table === TABLE_DELETION_REQUESTS && row?.lastAppliedAt !== '1970-01-01T00:00:00.000Z') {
        markerReady.open();
        await markerRelease.opened;
      }
      return deleterInsert(args);
    });
    const writerCommand = writer.command.bind(writer);
    vi.spyOn(writer, 'command').mockImplementation(async args => {
      if (args.query.startsWith(`DELETE FROM ${TABLE_FEEDBACK_EVENTS}`)) throw new Error('socket hang up');
      return writerCommand(args);
    });

    const updating = updateFeedbackReviewStatus(
      writer,
      { feedbackId: 'cleanup-failure', reviewStatus: 'reviewed' },
      {},
    );
    await ready.opened;
    const deleting = deleteFeedback(deleter, { feedbackIds: ['cleanup-failure'] }, {});
    await markerReady.opened;
    release.open();
    // The request is still pending, but its delete is running, not failed.
    try {
      await expect(updating).rejects.toThrow('socket hang up');
    } finally {
      markerRelease.open();
    }
    await deleting;

    await expectNextReviewCleansUp(writer, 'cleanup-failure');
  }, 60_000);

  it.each(['serial', 'fallback'] as const)(
    'publishes review changes through %s delta cursors',
    async strategy => {
      const writer = clients[0]!;
      await writer.command({ query: buildFeedbackEventsDeltaDDL() });
      await writer.command({ query: buildFeedbackEventsDeltaMvDDL(strategy) });
      const enabled = coreFeatures.has('observability-delta-polling');
      coreFeatures.add('observability-delta-polling');
      try {
        await seed(writer, 'review-delta', null);
        let cursor = (await listFeedback(writer, { mode: 'delta' }, strategy)).deltaCursor!;
        for (const reviewStatus of ['reviewed', 'needs-review'] as const) {
          await expect(
            updateFeedbackReviewStatus(writer, { feedbackId: 'review-delta', reviewStatus }),
          ).resolves.toMatchObject({ reviewStatus });
          const delta = await listFeedback(writer, { mode: 'delta', after: cursor }, strategy);
          expect(delta.feedback).toHaveLength(1);
          expect(delta.feedback[0]).toMatchObject({ feedbackId: 'review-delta', reviewStatus });
          expect(BigInt(delta.deltaCursor!)).toBeGreaterThan(BigInt(cursor));
          cursor = delta.deltaCursor!;
        }
      } finally {
        if (!enabled) coreFeatures.delete('observability-delta-polling');
      }
    },
    60_000,
  );

  it('recovers from a real DELETE permission failure while keeping pending feedback editable', async () => {
    const writer = clients[0]!;
    const database = databases[0]!;
    const username = `receipt_test_${randomUUID().replaceAll('-', '')}`;
    await writer.command({ query: `CREATE USER ${username} IDENTIFIED WITH plaintext_password BY 'password'` });
    const limited = createClient({ ...config, database, username, password: 'password' });
    try {
      await writer.command({ query: `GRANT SELECT, INSERT ON ${database}.* TO ${username}` });
      await seed(writer, 'real-delete-failure');
      await expect(deleteFeedback(limited, { feedbackIds: ['real-delete-failure'] }, {})).rejects.toMatchObject({
        code: '497',
      });
      expect(await requestStates(writer)).toEqual([{ applied: 0 }]);
      expect(await visibleFeedback(writer)).toHaveLength(1);
      // The review is not blocked by the failed request. It re-attempts the
      // pending delete, which fails again, and reports that failure; the
      // still-visible feedback keeps the new status.
      await expect(
        updateFeedbackReviewStatus(limited, { feedbackId: 'real-delete-failure', reviewStatus: 'reviewed' }),
      ).rejects.toMatchObject({ code: '497' });
      expect(await visibleFeedback(writer)).toEqual([{ feedbackId: 'real-delete-failure', reviewStatus: 'reviewed' }]);
      // ClickHouse 26.6 and earlier also check ALTER UPDATE for lightweight deletes.
      await writer.command({ query: `GRANT ALTER DELETE, ALTER UPDATE ON ${database}.* TO ${username}` });
      await deleteFeedback(limited, { feedbackIds: ['real-delete-failure'] }, {});
      expect(await requestStates(writer)).toEqual([{ applied: 0 }, { applied: 0 }, { applied: 1 }]);
      for (const client of clients) expect(await visibleFeedback(client)).toEqual([]);
      await expect(
        updateFeedbackReviewStatus(limited, { feedbackId: 'real-delete-failure', reviewStatus: 'reviewed' }),
      ).rejects.toThrow('Feedback record not found');
    } finally {
      await limited.close();
      await writer.command({ query: `DROP USER IF EXISTS ${username}` });
    }
  }, 60_000);

  it('updates review status and publishes the delta with only SELECT and INSERT', async () => {
    const writer = clients[0]!;
    const database = databases[0]!;
    const username = `update_test_${randomUUID().replaceAll('-', '')}`;
    await writer.command({ query: buildFeedbackEventsDeltaDDL() });
    await writer.command({ query: buildFeedbackEventsDeltaMvDDL('fallback') });
    await seed(writer, 'restricted-review', null);
    const enabled = coreFeatures.has('observability-delta-polling');
    coreFeatures.add('observability-delta-polling');
    await writer.command({ query: `CREATE USER ${username} IDENTIFIED WITH plaintext_password BY 'password'` });
    const limited = createClient({ ...config, database, username, password: 'password' });
    try {
      await writer.command({ query: `GRANT SELECT, INSERT ON ${database}.* TO ${username}` });
      const cursor = (await listFeedback(writer, { mode: 'delta' }, 'fallback')).deltaCursor!;
      await expect(
        updateFeedbackReviewStatus(limited, { feedbackId: 'restricted-review', reviewStatus: 'reviewed' }),
      ).resolves.toMatchObject({ reviewStatus: 'reviewed' });
      expect(await visibleFeedback(writer)).toEqual([{ feedbackId: 'restricted-review', reviewStatus: 'reviewed' }]);
      expect((await listFeedback(writer, { mode: 'delta', after: cursor }, 'fallback')).feedback).toMatchObject([
        { feedbackId: 'restricted-review', reviewStatus: 'reviewed' },
      ]);
    } finally {
      if (!enabled) coreFeatures.delete('observability-delta-polling');
      await limited.close();
      await writer.command({ query: `DROP USER IF EXISTS ${username}` });
    }
  }, 60_000);
});

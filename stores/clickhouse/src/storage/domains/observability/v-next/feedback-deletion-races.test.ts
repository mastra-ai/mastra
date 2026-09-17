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
import { recordDeletionRequest } from './deletion-requests';
import { createFeedback, deleteFeedback, listFeedback, updateFeedbackReviewStatus } from './feedback';

function gate() {
  let open!: () => void;
  const opened = new Promise<void>(resolve => (open = resolve));
  return { open, opened };
}

// Three real ReplicatedMergeTree replicas in separate databases on the test
// server. Only receipt replication is paused; feedback mutations still reach
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

  it.each([true, false])(
    'preserves deletion state when the post-update guard reaches a stale replica (deleted: %s)',
    async deleted => {
      const [writer, , lagging] = clients as [ClickHouseClient, ClickHouseClient, ClickHouseClient];
      await createFeedback(writer, {
        feedback: {
          feedbackId: 'feedback-race',
          timestamp: new Date(),
          traceId: 'trace-race',
          feedbackSource: 'user',
          feedbackType: 'rating',
          value: 1,
          organizationId: 'org-1',
          resourceId: 'resource-1',
        },
      });
      for (const client of clients) await client.command({ query: `SYSTEM SYNC REPLICA ${TABLE_FEEDBACK_EVENTS}` });
      const ready = gate();
      const release = gate();
      const insert = writer.insert.bind(writer);
      const command = writer.command.bind(writer);
      const query = writer.query.bind(writer);
      let guards = 0;
      vi.spyOn(writer, 'insert').mockImplementation(async args => {
        if (args.table === TABLE_FEEDBACK_EVENTS) {
          ready.open();
          await release.opened;
        }
        const result = await insert(args);
        const row = (args.values as Array<{ lastAppliedAt?: string }>)[0];
        if (args.table === TABLE_DELETION_REQUESTS && row?.lastAppliedAt === '1970-01-01T00:00:00.000Z') {
          await syncReceipts();
          await lagging.command({ query: `SYSTEM STOP FETCHES ${TABLE_DELETION_REQUESTS}` });
        }
        return result;
      });
      vi.spyOn(writer, 'command').mockImplementation(async args => {
        if (args.query.startsWith(`ALTER TABLE ${TABLE_FEEDBACK_EVENTS} UPDATE`)) {
          ready.open();
          await release.opened;
        }
        return command(args);
      });
      vi.spyOn(writer, 'query').mockImplementation(args => {
        if (args.query.includes('has(predicateValues') && ++guards === 2) return lagging.query(args);
        return query(args);
      });
      const updating = updateFeedbackReviewStatus(
        writer,
        { feedbackId: 'feedback-race', reviewStatus: 'reviewed' },
        {},
      );
      const outcome = updating.then(
        value => ({ value }),
        error => ({ error }),
      );
      try {
        await Promise.race([ready.opened, updating]);
        await deleteFeedback(writer, { feedbackIds: [deleted ? 'feedback-race' : 'unrelated-feedback'] }, {});
      } finally {
        release.open();
      }
      expect(await outcome).toMatchObject({ error: { code: '289' } });
      await lagging.command({ query: `SYSTEM START FETCHES ${TABLE_DELETION_REQUESTS}` });
      await syncReceipts();
      for (const client of clients) {
        await client.command({ query: `SYSTEM SYNC REPLICA ${TABLE_FEEDBACK_EVENTS}` });
        expect(await visibleFeedback(client)).toEqual(
          deleted ? [] : [{ feedbackId: 'feedback-race', reviewStatus: 'reviewed' }],
        );
      }
      const retry = updateFeedbackReviewStatus(writer, { feedbackId: 'feedback-race', reviewStatus: 'reviewed' }, {});
      if (deleted) {
        await expect(retry).rejects.toThrow('Feedback record not found');
        expect(await visibleFeedback(writer)).toEqual([]);
      } else {
        await expect(retry).resolves.toMatchObject({ feedbackId: 'feedback-race', reviewStatus: 'reviewed' });
      }
    },
    60_000,
  );

  it.each(['serial', 'fallback'] as const)(
    'publishes review changes through %s delta cursors without replacing feedback',
    async strategy => {
      const writer = clients[0]!;
      await writer.command({ query: buildFeedbackEventsDeltaDDL() });
      await writer.command({ query: buildFeedbackEventsDeltaMvDDL(strategy) });
      const enabled = coreFeatures.has('observability-delta-polling');
      coreFeatures.add('observability-delta-polling');
      try {
        // Null trace ids exercise the nullable part of the mutation identity.
        await createFeedback(writer, {
          feedback: {
            feedbackId: 'review-delta',
            timestamp: new Date(),
            traceId: null,
            feedbackSource: 'user',
            feedbackType: 'rating',
            value: 1,
          },
        });
        let cursor = (await listFeedback(writer, { mode: 'delta' }, strategy)).deltaCursor!;
        for (const reviewStatus of ['reviewed', 'needs-review'] as const) {
          await expect(
            updateFeedbackReviewStatus(writer, { feedbackId: 'review-delta', reviewStatus }, {}, strategy),
          ).resolves.toMatchObject({ reviewStatus });
          const delta = await listFeedback(writer, { mode: 'delta', after: cursor }, strategy);
          expect(delta.feedback).toHaveLength(1);
          expect(delta.feedback[0]).toMatchObject({ feedbackId: 'review-delta', reviewStatus });
          expect(BigInt(delta.deltaCursor!)).toBeGreaterThan(BigInt(cursor));
          cursor = delta.deltaCursor!;
        }
        const result = await writer.query({
          query: `SELECT toString(writeVersion) AS version FROM ${TABLE_FEEDBACK_EVENTS}`,
          format: 'JSONEachRow',
        });
        expect(await result.json()).toEqual([{ version: '1' }]);
      } finally {
        if (!enabled) coreFeatures.delete('observability-delta-polling');
      }
    },
    60_000,
  );

  it('waits out another serialized quorum insert instead of rejecting a concurrent deletion request', async () => {
    const [writer, second, third] = clients as [ClickHouseClient, ClickHouseClient, ClickHouseClient];
    for (const client of [second, third])
      await client.command({ query: `SYSTEM STOP FETCHES ${TABLE_DELETION_REQUESTS}` });
    const args = {
      signal: 'feedback' as const,
      predicateType: 'itemIds' as const,
      predicateValues: ['feedback-1'],
      requestedAt: new Date().toISOString(),
      replication: {},
    };
    const first = recordDeletionRequest(writer, { ...args, requestId: 'first' });
    let other: Promise<unknown> | undefined;
    try {
      await vi.waitFor(async () => {
        const result = await writer.query({
          query: `SELECT requestId FROM ${TABLE_DELETION_REQUESTS}`,
          format: 'JSONEachRow',
        });
        expect(await result.json()).toEqual([{ requestId: 'first' }]);
      });
      other = recordDeletionRequest(writer, { ...args, requestId: 'second', organizationId: 'other-org' });
      // Attach immediately so a regression is an assertion failure, not an
      // unhandled rejection while the first write is still waiting for quorum.
      const outcome = other.then(
        value => ({ value }),
        error => ({ error }),
      );
      await new Promise(resolve => setTimeout(resolve, 250));
      for (const client of [second, third])
        await client.command({ query: `SYSTEM START FETCHES ${TABLE_DELETION_REQUESTS}` });
      await first;
      expect(await outcome).toMatchObject({ value: { requestId: 'second' } });
    } finally {
      for (const client of [second, third])
        await client.command({ query: `SYSTEM START FETCHES ${TABLE_DELETION_REQUESTS}` });
      await Promise.allSettled([first, ...(other ? [other] : [])]);
    }
  }, 60_000);
});

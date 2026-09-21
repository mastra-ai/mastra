import type { ClickHouseClient } from '@clickhouse/client';
import { describe, expect, it, vi } from 'vitest';

import {
  DELETION_REQUESTS_DDL,
  TABLE_DELETION_REQUESTS,
  TABLE_FEEDBACK_EVENTS,
  TABLE_SCORE_EVENTS,
  TABLE_SCORE_EVENTS_CURRENT,
} from './ddl';
import { deleteFeedback, updateFeedbackReviewStatus } from './feedback';
import { feedbackRecordToRow } from './helpers';
import { deleteScores } from './scores';

function createClient() {
  const insert = vi.fn().mockResolvedValue({ query_id: 'insert-query' });
  const command = vi.fn().mockResolvedValue({ query_id: 'delete-query' });
  const query = vi.fn();
  return { client: { insert, command, query } as unknown as ClickHouseClient, insert, command, query };
}

function queryResult(rows: unknown[]) {
  return { json: vi.fn().mockResolvedValue(rows) };
}

describe('ClickHouse deletion lifecycle', () => {
  it('uses the shared deletion request schema without an OSS retention TTL', () => {
    expect(DELETION_REQUESTS_DDL).toContain('predicateValues Array(String)');
    expect(DELETION_REQUESTS_DDL).toContain('ENGINE = ReplacingMergeTree(updatedAt)');
    expect(DELETION_REQUESTS_DDL).toContain('ORDER BY (organizationId, resourceId, requestId)');
    expect(DELETION_REQUESTS_DDL).not.toContain('TTL');
    expect(DELETION_REQUESTS_DDL).not.toContain('deletedAt');
  });

  it('records a score deletion request before the scoped lightweight delete', async () => {
    const { client, insert, command } = createClient();

    await deleteScores(
      client,
      { scoreIds: ['score-1', 'score-2'], organizationId: 'org-1', resourceId: 'resource-1' },
      { cluster: 'test-cluster' },
    );

    expect(insert).toHaveBeenCalledWith({
      table: TABLE_DELETION_REQUESTS,
      values: [
        {
          requestId: expect.any(String),
          organizationId: 'org-1',
          resourceId: 'resource-1',
          signal: 'scores',
          predicateType: 'itemIds',
          predicateValues: ['score-1', 'score-2'],
          requestedAt: expect.any(String),
          requestedBy: '',
          lastAppliedAt: '1970-01-01T00:00:00.000Z',
          purgeVerifiedAt: '1970-01-01T00:00:00.000Z',
          updatedAt: expect.any(String),
        },
      ],
      format: 'JSONEachRow',
      clickhouse_settings: expect.objectContaining({
        insert_quorum: 'auto',
        insert_quorum_parallel: 0,
        async_insert: 0,
      }),
    });
    const deleteCommand = {
      query_params: {
        sid_0: 'score-1',
        sid_1: 'score-2',
        delOrganizationId: 'org-1',
        delResourceId: 'resource-1',
      },
      clickhouse_settings: { lightweight_deletes_sync: '2' },
    };
    expect(command).toHaveBeenNthCalledWith(1, {
      ...deleteCommand,
      query: `DELETE FROM ${TABLE_SCORE_EVENTS_CURRENT} WHERE scoreId IN ({sid_0:String}, {sid_1:String}) AND organizationId = {delOrganizationId:String} AND resourceId = {delResourceId:String}`,
    });
    expect(command).toHaveBeenNthCalledWith(2, {
      ...deleteCommand,
      query: `DELETE FROM ${TABLE_SCORE_EVENTS} WHERE scoreId IN ({sid_0:String}, {sid_1:String}) AND organizationId = {delOrganizationId:String} AND resourceId = {delResourceId:String}`,
    });
    expect(insert.mock.invocationCallOrder[0]).toBeLessThan(command.mock.invocationCallOrder[0]!);
  });

  it('records a feedback deletion request before the lightweight delete', async () => {
    const { client, insert, command } = createClient();

    await deleteFeedback(client, { feedbackIds: ['feedback-1'] });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        table: TABLE_DELETION_REQUESTS,
        values: [
          expect.objectContaining({
            organizationId: '',
            resourceId: '',
            signal: 'feedback',
            predicateType: 'itemIds',
            predicateValues: ['feedback-1'],
            requestedBy: '',
          }),
        ],
      }),
    );
    expect(command).toHaveBeenCalledWith({
      query: `DELETE FROM ${TABLE_FEEDBACK_EVENTS} WHERE feedbackId IN ({fid_0:String})`,
      query_params: { fid_0: 'feedback-1' },
      clickhouse_settings: { lightweight_deletes_sync: '1' },
    });
    expect(insert.mock.invocationCallOrder[0]).toBeLessThan(command.mock.invocationCallOrder[0]!);
  });

  it('does not delete when request recording fails', async () => {
    const { client, insert, command } = createClient();
    insert.mockRejectedValueOnce(new Error('request insert failed'));

    await expect(deleteScores(client, { scoreIds: ['score-1'] })).rejects.toThrow('request insert failed');
    expect(command).not.toHaveBeenCalled();
  });

  it('propagates delete failures after recording the deletion request', async () => {
    const { client, insert, command } = createClient();
    command.mockRejectedValueOnce(new Error('lightweight delete failed'));

    await expect(deleteFeedback(client, { feedbackIds: ['feedback-1'] })).rejects.toThrow('lightweight delete failed');
    expect(insert).toHaveBeenCalledOnce();
    expect(insert.mock.calls[0]?.[0].values[0].lastAppliedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('marks the request applied only after the lightweight delete succeeds', async () => {
    const feedbackClient = createClient();
    await deleteFeedback(feedbackClient.client, { feedbackIds: ['feedback-1'] }, { cluster: 'test-cluster' });
    const scoresClient = createClient();
    await deleteScores(scoresClient.client, { scoreIds: ['score-1'] });

    // Feedback runs a single delete before the applied mark; review updates mutate in place.
    expect(feedbackClient.command).toHaveBeenCalledTimes(1);
    expect(feedbackClient.insert.mock.invocationCallOrder[1]).toBeGreaterThan(
      feedbackClient.command.mock.invocationCallOrder[0]!,
    );
    // Scores delete from the current-score and event tables, then mark applied.
    expect(scoresClient.command).toHaveBeenCalledTimes(2);
    expect(scoresClient.insert.mock.invocationCallOrder[1]).toBeGreaterThan(
      Math.max(...scoresClient.command.mock.invocationCallOrder),
    );

    for (const { insert, command } of [feedbackClient, scoresClient]) {
      expect(insert).toHaveBeenCalledTimes(2);
      const pending = insert.mock.calls[0]?.[0].values[0];
      const applied = insert.mock.calls[1]?.[0].values[0];
      expect(pending.lastAppliedAt).toBe('1970-01-01T00:00:00.000Z');
      expect(applied).toMatchObject({ ...pending, lastAppliedAt: expect.any(String), updatedAt: expect.any(String) });
      expect(applied.lastAppliedAt).not.toBe('1970-01-01T00:00:00.000Z');
      expect(applied.updatedAt).toBe(applied.lastAppliedAt);
      expect(insert.mock.invocationCallOrder[1]).toBeGreaterThan(command.mock.invocationCallOrder[0]!);
    }
    expect(feedbackClient.insert.mock.calls[1]?.[0].clickhouse_settings).toEqual(
      expect.objectContaining({ insert_quorum: 'auto', insert_quorum_parallel: 0, async_insert: 0 }),
    );
    expect(scoresClient.insert.mock.calls[1]?.[0].clickhouse_settings).not.toHaveProperty('insert_quorum');
  });

  it('mutates only the observed row and reports a concurrent applied deletion', async () => {
    const { client, insert, command, query } = createClient();
    const existingRow = feedbackRecordToRow({
      feedbackId: 'feedback-1',
      timestamp: new Date('2026-09-03T12:00:00Z'),
      traceId: 'trace-1',
      feedbackSource: 'user',
      feedbackType: 'rating',
      value: 1,
      organizationId: 'org-1',
      resourceId: 'resource-1',
      reviewStatus: 'needs-review',
    });
    query
      .mockResolvedValueOnce(queryResult([existingRow]))
      .mockResolvedValueOnce(queryResult([]))
      .mockResolvedValueOnce(queryResult([{ found: 1 }]));

    await expect(
      updateFeedbackReviewStatus(
        client,
        { feedbackId: 'feedback-1', reviewStatus: 'reviewed' },
        { cluster: 'test-cluster' },
      ),
    ).rejects.toThrow('Feedback record not found');

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        query: expect.stringContaining("WHERE signal = 'feedback'"),
        query_params: { feedbackId: 'feedback-1', organizationId: 'org-1', resourceId: 'resource-1' },
      }),
    );
    expect(query.mock.calls[1]?.[0].query).toContain("predicateType = 'itemIds'");
    expect(query.mock.calls[1]?.[0].query).toContain('has(predicateValues, {feedbackId:String})');
    expect(query.mock.calls[1]?.[0].query).toContain('lastAppliedAt > toDateTime64(0, 3)');
    // Quorum-inserted markers are read with sequential consistency on replicated clusters.
    expect(query.mock.calls[1]?.[0].clickhouse_settings).toEqual(
      expect.objectContaining({ select_sequential_consistency: '1' }),
    );
    expect(query.mock.calls[2]?.[0].clickhouse_settings).toEqual(
      expect.objectContaining({ select_sequential_consistency: '1' }),
    );
    expect(insert).not.toHaveBeenCalled();
    expect(command).toHaveBeenCalledExactlyOnceWith({
      query: expect.stringContaining(`ALTER TABLE ${TABLE_FEEDBACK_EVENTS} UPDATE reviewStatus`),
      query_params: expect.objectContaining({
        feedbackId: 'feedback-1',
        traceId: 'trace-1',
        writeVersion: '0',
        reviewStatus: 'reviewed',
      }),
      clickhouse_settings: expect.objectContaining({ mutations_sync: '2' }),
    });
  });

  it('re-applies the review to a newer version ingested during the update', async () => {
    const { client, command, query } = createClient();
    const base = {
      feedbackId: 'feedback-1',
      timestamp: new Date('2026-09-03T12:00:00Z'),
      traceId: 'trace-1',
      feedbackSource: 'user',
      feedbackType: 'rating',
      value: 1,
      reviewStatus: 'needs-review',
    } as const;
    const v1 = { ...feedbackRecordToRow(base), reviewWriteVersion: '1' };
    const v2 = { ...feedbackRecordToRow({ ...base, comment: 'newer' }), reviewWriteVersion: '2' };
    query
      // attempt 1: observed v1, no request, no request, v1 gone under FINAL
      .mockResolvedValueOnce(queryResult([v1]))
      .mockResolvedValueOnce(queryResult([]))
      .mockResolvedValueOnce(queryResult([]))
      .mockResolvedValueOnce(queryResult([]))
      // attempt 2: observed v2, no request, no request, v2 read back
      .mockResolvedValueOnce(queryResult([v2]))
      .mockResolvedValueOnce(queryResult([]))
      .mockResolvedValueOnce(queryResult([]))
      .mockResolvedValueOnce(queryResult([{ ...v2, reviewStatus: 'reviewed' }]));

    await expect(
      updateFeedbackReviewStatus(client, { feedbackId: 'feedback-1', reviewStatus: 'reviewed' }),
    ).resolves.toMatchObject({ feedbackId: 'feedback-1', reviewStatus: 'reviewed', comment: 'newer' });

    expect(command).toHaveBeenCalledTimes(2);
    expect(command.mock.calls[0]?.[0].query_params).toMatchObject({ writeVersion: '1' });
    expect(command.mock.calls[1]?.[0].query_params).toMatchObject({ writeVersion: '2' });
  });

  it('reports a conflict instead of not-found when ingestion keeps superseding the row', async () => {
    const { client, command, query } = createClient();
    const row = {
      ...feedbackRecordToRow({
        feedbackId: 'feedback-1',
        timestamp: new Date('2026-09-03T12:00:00Z'),
        traceId: 'trace-1',
        feedbackSource: 'user',
        feedbackType: 'rating',
        value: 1,
        reviewStatus: 'needs-review',
      }),
      reviewWriteVersion: '1',
    };
    query.mockImplementation(async (args: { query: string }) =>
      queryResult(args.query.includes('ORDER BY writeVersion DESC') ? [row] : []),
    );

    await expect(
      updateFeedbackReviewStatus(client, { feedbackId: 'feedback-1', reviewStatus: 'reviewed' }),
    ).rejects.toMatchObject({ id: 'OBSERVABILITY_UPDATE_FEEDBACK_REVIEW_STATUS_CONFLICT' });
    expect(command).toHaveBeenCalledTimes(3);
  });

  it('reads the guard without sequential consistency when replication is not configured', async () => {
    const { client, query } = createClient();
    const existingRow = feedbackRecordToRow({
      feedbackId: 'feedback-1',
      timestamp: new Date('2026-09-03T12:00:00Z'),
      traceId: 'trace-1',
      feedbackSource: 'user',
      feedbackType: 'rating',
      value: 1,
      reviewStatus: 'needs-review',
    });
    query
      .mockResolvedValueOnce(queryResult([existingRow]))
      .mockResolvedValueOnce(queryResult([]))
      .mockResolvedValueOnce(queryResult([]))
      .mockResolvedValueOnce(queryResult([{ ...existingRow, reviewStatus: 'reviewed' }]));

    await updateFeedbackReviewStatus(client, { feedbackId: 'feedback-1', reviewStatus: 'reviewed' });

    expect(query.mock.calls[1]?.[0].query).toContain('has(predicateValues, {feedbackId:String})');
    expect(query.mock.calls[1]?.[0].clickhouse_settings).not.toHaveProperty('select_sequential_consistency');
    expect(query.mock.calls[2]?.[0].clickhouse_settings).not.toHaveProperty('select_sequential_consistency');
  });

  it('is a complete no-op for empty id arrays', async () => {
    const { client, insert, command } = createClient();

    await deleteScores(client, { scoreIds: [] });
    await deleteFeedback(client, { feedbackIds: [] });

    expect(insert).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
  });
});

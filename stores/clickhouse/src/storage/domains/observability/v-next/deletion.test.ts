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
      clickhouse_settings: expect.objectContaining({ insert_quorum: 'auto', insert_quorum_parallel: 1 }),
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

  it('leaves the score deletion request unapplied when a later lightweight delete fails', async () => {
    const { client, insert, command } = createClient();
    command
      .mockResolvedValueOnce({ query_id: 'delete-current' })
      .mockRejectedValueOnce(new Error('event delete failed'));

    await expect(deleteScores(client, { scoreIds: ['score-1'] })).rejects.toThrow('event delete failed');
    expect(command).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenCalledOnce();
    expect(insert.mock.calls[0]?.[0].values[0].lastAppliedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('marks the request applied only after the lightweight delete succeeds', async () => {
    const feedbackClient = createClient();
    await deleteFeedback(feedbackClient.client, { feedbackIds: ['feedback-1'] }, { cluster: 'test-cluster' });
    const scoresClient = createClient();
    await deleteScores(scoresClient.client, { scoreIds: ['score-1'] });

    // Feedback runs a single delete before the applied mark.
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
      expect.objectContaining({ insert_quorum: 'auto', insert_quorum_parallel: 1 }),
    );
    expect(scoresClient.insert.mock.calls[1]?.[0].clickhouse_settings).not.toHaveProperty('insert_quorum');
  });

  describe('feedback review updates', () => {
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

    /** Answers each deletion-request guard read from the next queued request state. */
    function reviewClient(requests: Array<'none' | 'pending' | 'applied'>) {
      const mocks = createClient();
      mocks.query.mockImplementation(async (args: { query: string }) => {
        if (args.query.includes(TABLE_DELETION_REQUESTS)) {
          const state = requests.shift() ?? 'none';
          const appliedOnly = args.query.includes('lastAppliedAt > toDateTime64(0, 3)');
          return queryResult(state === 'applied' || (state === 'pending' && !appliedOnly) ? [{ found: 1 }] : []);
        }
        if (args.query.includes('max(writeVersion)'))
          return queryResult([{ feedbackId: 'feedback-1', writeVersion: '1' }]);
        return queryResult([existingRow]);
      });
      return mocks;
    }

    const review = (client: ClickHouseClient) =>
      updateFeedbackReviewStatus(client, { feedbackId: 'feedback-1', reviewStatus: 'reviewed' });

    it('inserts a replacement row without mutating or deleting', async () => {
      const { client, insert, command, query } = reviewClient(['none', 'none']);

      await expect(review(client)).resolves.toMatchObject({ feedbackId: 'feedback-1', reviewStatus: 'reviewed' });

      expect(insert).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          table: TABLE_FEEDBACK_EVENTS,
          values: [expect.objectContaining({ feedbackId: 'feedback-1', reviewStatus: 'reviewed', writeVersion: '2' })],
        }),
      );
      expect(command).not.toHaveBeenCalled();
      const guards = query.mock.calls.map(([args]) => args.query).filter(sql => sql.includes(TABLE_DELETION_REQUESTS));
      expect(guards).toHaveLength(2);
      expect(guards[0]).toContain('lastAppliedAt > toDateTime64(0, 3)');
      expect(guards[1]).not.toContain('lastAppliedAt');
      expect(query.mock.calls.find(([args]) => args.query.includes(TABLE_DELETION_REQUESTS))?.[0].query_params).toEqual(
        { feedbackId: 'feedback-1', organizationId: 'org-1', resourceId: 'resource-1' },
      );
    });

    it('deletes a row still visible under an applied request instead of writing', async () => {
      const { client, insert, command } = reviewClient(['applied']);

      await expect(review(client)).rejects.toThrow('Feedback record not found');
      expect(command).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ query: expect.stringContaining(`DELETE FROM ${TABLE_FEEDBACK_EVENTS}`) }),
      );
      // the new request row and its applied marker; no replacement row
      expect(insert).toHaveBeenCalledTimes(2);
      expect(insert.mock.calls.every(([args]) => args.table !== TABLE_FEEDBACK_EVENTS)).toBe(true);
    });

    it('re-runs the delete and reports not found when a request appears after the write', async () => {
      const { client, insert, command } = reviewClient(['none', 'pending']);

      await expect(review(client)).rejects.toThrow('Feedback record not found');
      expect(command).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          query: expect.stringContaining(`DELETE FROM ${TABLE_FEEDBACK_EVENTS}`),
          query_params: { fid_0: 'feedback-1', delOrganizationId: 'org-1', delResourceId: 'resource-1' },
        }),
      );
      // replacement row, new request row, applied marker
      expect(insert).toHaveBeenCalledTimes(3);
      expect(insert.mock.invocationCallOrder[0]).toBeLessThan(command.mock.invocationCallOrder[0]!);
    });

    it('surfaces a failed re-run delete instead of reporting success', async () => {
      // A pending request can be a delete that failed or one still running.
      const { client, insert, command } = reviewClient(['pending', 'pending']);
      command.mockRejectedValueOnce(new Error('missing ALTER DELETE'));

      await expect(review(client)).rejects.toThrow('missing ALTER DELETE');
      // replacement row, then the re-run delete's request row
      expect(insert).toHaveBeenCalledTimes(2);
    });
  });

  it('is a complete no-op for empty id arrays', async () => {
    const { client, insert, command } = createClient();

    await deleteScores(client, { scoreIds: [] });
    await deleteFeedback(client, { feedbackIds: [] });

    expect(insert).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
  });
});

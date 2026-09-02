import type { ClickHouseClient } from '@clickhouse/client';
import { describe, expect, it, vi } from 'vitest';

import { DELETION_REQUESTS_DDL, TABLE_DELETION_REQUESTS, TABLE_FEEDBACK_EVENTS, TABLE_SCORE_EVENTS } from './ddl';
import { deleteFeedback } from './feedback';
import { deleteScores } from './scores';

function createClient() {
  const insert = vi.fn().mockResolvedValue({ query_id: 'insert-query' });
  const command = vi.fn().mockResolvedValue({ query_id: 'delete-query' });
  return { client: { insert, command } as unknown as ClickHouseClient, insert, command };
}

describe('ClickHouse deletion lifecycle', () => {
  it('defines the shared deletion request table with a 45-day audit TTL', () => {
    expect(DELETION_REQUESTS_DDL).toContain('requestId       UUID');
    expect(DELETION_REQUESTS_DDL).toContain("requestedAt     DateTime64(3, 'UTC')");
    expect(DELETION_REQUESTS_DDL).toContain('scoreIds        Array(String)');
    expect(DELETION_REQUESTS_DDL).toContain('feedbackIds     Array(String)');
    expect(DELETION_REQUESTS_DDL).toContain('TTL requestedAt + INTERVAL 45 DAY');
    expect(DELETION_REQUESTS_DDL).not.toContain('deletedAt');
  });

  it('records a score-shaped pending request before the scoped lightweight delete', async () => {
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
          requestedAt: expect.any(String),
          completedAt: null,
          requestType: 'score',
          organizationId: 'org-1',
          resourceId: 'resource-1',
          traceIds: [],
          experimentId: null,
          datasetId: null,
          datasetItemIds: [],
          scoreIds: ['score-1', 'score-2'],
          feedbackIds: [],
          status: 'pending',
          lastError: null,
          attemptCount: 0,
          nextAttemptAt: null,
        },
      ],
      format: 'JSONEachRow',
      clickhouse_settings: expect.objectContaining({ insert_quorum: 'auto', insert_quorum_parallel: 1 }),
    });
    expect(command).toHaveBeenCalledWith({
      query: `DELETE FROM ${TABLE_SCORE_EVENTS} WHERE scoreId IN ({sid_0:String}, {sid_1:String}) AND organizationId = {delOrganizationId:String} AND resourceId = {delResourceId:String}`,
      query_params: {
        sid_0: 'score-1',
        sid_1: 'score-2',
        delOrganizationId: 'org-1',
        delResourceId: 'resource-1',
      },
      clickhouse_settings: { lightweight_deletes_sync: '1' },
    });
    expect(insert.mock.invocationCallOrder[0]).toBeLessThan(command.mock.invocationCallOrder[0]!);
  });

  it('records a feedback-shaped pending request before the lightweight delete', async () => {
    const { client, insert, command } = createClient();

    await deleteFeedback(client, { feedbackIds: ['feedback-1'] });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        table: TABLE_DELETION_REQUESTS,
        values: [
          expect.objectContaining({
            requestType: 'feedback',
            organizationId: null,
            resourceId: null,
            scoreIds: [],
            feedbackIds: ['feedback-1'],
            status: 'pending',
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

  it('propagates delete failures after recording the pending request', async () => {
    const { client, insert, command } = createClient();
    command.mockRejectedValueOnce(new Error('lightweight delete failed'));

    await expect(deleteFeedback(client, { feedbackIds: ['feedback-1'] })).rejects.toThrow('lightweight delete failed');
    expect(insert).toHaveBeenCalledOnce();
  });

  it('is a complete no-op for empty id arrays', async () => {
    const { client, insert, command } = createClient();

    await deleteScores(client, { scoreIds: [] });
    await deleteFeedback(client, { feedbackIds: [] });

    expect(insert).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
  });
});

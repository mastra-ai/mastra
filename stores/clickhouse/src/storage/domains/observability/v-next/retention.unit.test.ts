import { describe, expect, it, vi } from 'vitest';
import { TABLE_SCORE_EVENTS } from './ddl';
import { applyClickHouseRetention } from '.';

describe('applyClickHouseRetention', () => {
  it('treats a concurrent matching TTL update as successful after an ALTER conflict', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => [{ name: TABLE_SCORE_EVENTS, create_table_query: '' }] })
      .mockResolvedValueOnce({
        json: async () => [
          {
            name: TABLE_SCORE_EVENTS,
            create_table_query: `CREATE TABLE ${TABLE_SCORE_EVENTS} (...) TTL timestamp + toIntervalDay(30)`,
          },
        ],
      });
    const command = vi.fn().mockRejectedValueOnce(new Error('CANNOT_ASSIGN_ALTER')).mockResolvedValue(undefined);

    await expect(
      applyClickHouseRetention({ client: { query, command } as any, retention: { scores: 30 } }),
    ).resolves.toHaveLength(2);
    expect(command).toHaveBeenCalledTimes(2);
  });

  it('confirms a matching TTL on every cluster host before suppressing an ALTER conflict', async () => {
    const matchingTtl = `CREATE TABLE ${TABLE_SCORE_EVENTS} (...) TTL timestamp + toIntervalDay(30)`;
    const query = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => [{ name: TABLE_SCORE_EVENTS, create_table_query: '' }] })
      .mockResolvedValueOnce({ json: async () => [{ host_count: 2 }] })
      .mockResolvedValueOnce({
        json: async () => [
          { name: TABLE_SCORE_EVENTS, create_table_query: matchingTtl },
          { name: TABLE_SCORE_EVENTS, create_table_query: matchingTtl },
        ],
      });
    const command = vi.fn().mockRejectedValueOnce(new Error('TIMEOUT_EXCEEDED')).mockResolvedValue(undefined);

    await expect(
      applyClickHouseRetention({
        client: { query, command } as any,
        retention: { scores: 30 },
        replication: { cluster: 'retention-cluster' },
      }),
    ).resolves.toHaveLength(2);
    expect(query.mock.calls[2]?.[0]).toMatchObject({
      query_params: { cluster: 'retention-cluster', table: TABLE_SCORE_EVENTS },
    });
    expect(query.mock.calls[2]?.[0].query).toContain('clusterAllReplicas');
  });

  it('preserves a clustered ALTER error while a remote host has not installed the TTL', async () => {
    const alterError = new Error('TIMEOUT_EXCEEDED');
    const query = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => [{ name: TABLE_SCORE_EVENTS, create_table_query: '' }] })
      .mockResolvedValueOnce({ json: async () => [{ host_count: 2 }] })
      .mockResolvedValueOnce({
        json: async () => [
          {
            name: TABLE_SCORE_EVENTS,
            create_table_query: `CREATE TABLE ${TABLE_SCORE_EVENTS} (...) TTL timestamp + toIntervalDay(30)`,
          },
        ],
      });
    const command = vi.fn().mockRejectedValue(alterError);

    await expect(
      applyClickHouseRetention({
        client: { query, command } as any,
        retention: { scores: 30 },
        replication: { cluster: 'retention-cluster' },
      }),
    ).rejects.toBe(alterError);
  });

  it('preserves the ALTER error when a concurrent caller did not install the requested TTL', async () => {
    const alterError = new Error('CANNOT_ASSIGN_ALTER');
    const query = vi.fn().mockResolvedValue({
      json: async () => [{ name: TABLE_SCORE_EVENTS, create_table_query: '' }],
    });
    const command = vi.fn().mockRejectedValue(alterError);

    await expect(
      applyClickHouseRetention({ client: { query, command } as any, retention: { scores: 30 } }),
    ).rejects.toBe(alterError);
  });
});

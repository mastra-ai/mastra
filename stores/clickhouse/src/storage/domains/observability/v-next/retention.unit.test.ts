import { describe, expect, it, vi } from 'vitest';
import {
  buildRetentionDDL,
  TABLE_DELETION_REQUESTS,
  TABLE_LOG_EVENTS,
  TABLE_SCORE_EVENTS,
  TABLE_SCORE_EVENTS_CURRENT,
} from './ddl';
import { applyClickHouseRetention } from '.';

describe('buildRetentionDDL', () => {
  it.each([
    { tracing: 30, logs: 365 },
    { scores: 30, feedback: 45 },
  ])('keeps deletion requests unbounded when any trace-covered signal is unbounded', retention => {
    expect(buildRetentionDDL(retention)).not.toContain(
      expect.stringContaining('ALTER TABLE mastra_deletion_requests MODIFY TTL'),
    );
  });

  it('keeps deletion requests longer than every signal when all signals are bounded', () => {
    expect(buildRetentionDDL({ tracing: 30, logs: 365, metrics: 14, scores: 90, feedback: 60 })).toContain(
      'ALTER TABLE mastra_deletion_requests MODIFY TTL requestedAt + INTERVAL 395 DAY',
    );
  });
});

describe('applyClickHouseRetention', () => {
  it('skips a clustered ALTER only when every host already has the requested TTL', async () => {
    const matchingTtl = `CREATE TABLE ${TABLE_LOG_EVENTS} (...) TTL timestamp + toIntervalDay(30)`;
    const query = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => [{ host_count: 2 }] })
      .mockResolvedValueOnce({
        json: async () => [
          { name: TABLE_LOG_EVENTS, create_table_query: matchingTtl },
          { name: TABLE_LOG_EVENTS, create_table_query: matchingTtl },
        ],
      });
    const command = vi.fn();

    await expect(
      applyClickHouseRetention({
        client: { query, command } as any,
        retention: { logs: 30 },
        replication: { cluster: 'retention-cluster' },
      }),
    ).resolves.toEqual([]);
    expect(command).not.toHaveBeenCalled();
  });

  it('repairs clustered TTL drift when the connected host matches but another host differs', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => [{ host_count: 2 }] })
      .mockResolvedValueOnce({
        json: async () => [
          {
            name: TABLE_LOG_EVENTS,
            create_table_query: `CREATE TABLE ${TABLE_LOG_EVENTS} (...) TTL timestamp + toIntervalDay(30)`,
          },
          {
            name: TABLE_LOG_EVENTS,
            create_table_query: `CREATE TABLE ${TABLE_LOG_EVENTS} (...) TTL timestamp + toIntervalDay(7)`,
          },
        ],
      });
    const command = vi.fn().mockResolvedValue(undefined);

    await expect(
      applyClickHouseRetention({
        client: { query, command } as any,
        retention: { logs: 30 },
        replication: { cluster: 'retention-cluster' },
      }),
    ).resolves.toHaveLength(1);
    expect(command).toHaveBeenCalledOnce();
    expect(command.mock.calls[0]?.[0].query).toContain("ON CLUSTER 'retention-cluster'");
  });

  it('repairs clustered retention when a host is missing from introspection', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => [{ host_count: 2 }] })
      .mockResolvedValueOnce({
        json: async () => [
          {
            name: TABLE_LOG_EVENTS,
            create_table_query: `CREATE TABLE ${TABLE_LOG_EVENTS} (...) TTL timestamp + toIntervalDay(30)`,
          },
        ],
      });
    const command = vi.fn().mockResolvedValue(undefined);

    await expect(
      applyClickHouseRetention({
        client: { query, command } as any,
        retention: { logs: 30 },
        replication: { cluster: 'retention-cluster' },
      }),
    ).resolves.toHaveLength(1);
    expect(command).toHaveBeenCalledOnce();
  });

  it('fails open when clustered retention introspection is unavailable', async () => {
    const query = vi.fn().mockRejectedValue(new Error('ACCESS_DENIED'));
    const command = vi.fn().mockResolvedValue(undefined);

    await expect(
      applyClickHouseRetention({
        client: { query, command } as any,
        retention: { logs: 30 },
        replication: { cluster: 'retention-cluster' },
      }),
    ).resolves.toHaveLength(1);
    expect(command).toHaveBeenCalledOnce();
  });

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
    expect(command.mock.calls[1]?.[0].query).toContain(`ALTER TABLE ${TABLE_SCORE_EVENTS_CURRENT}`);
  });

  it('confirms a matching TTL on every cluster host before suppressing an ALTER conflict', async () => {
    const matchingTtl = `CREATE TABLE ${TABLE_SCORE_EVENTS} (...) TTL timestamp + toIntervalDay(30)`;
    const query = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => [{ host_count: 2 }] })
      .mockResolvedValueOnce({ json: async () => [] })
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
    expect(command).toHaveBeenCalledTimes(2);
    expect(command.mock.calls[1]?.[0].query).toContain(`ALTER TABLE ${TABLE_SCORE_EVENTS_CURRENT}`);
    expect(query.mock.calls[3]?.[0]).toMatchObject({
      query_params: { cluster: 'retention-cluster', tables: [TABLE_SCORE_EVENTS] },
    });
    expect(query.mock.calls[3]?.[0].query).toContain('clusterAllReplicas');
  });

  it('preserves a clustered ALTER error while a remote host has not installed the TTL', async () => {
    const alterError = new Error('TIMEOUT_EXCEEDED');
    const query = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => [{ host_count: 2 }] })
      .mockResolvedValueOnce({ json: async () => [] })
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

  it('removes stale signal and deletion-request TTLs when a signal is removed', async () => {
    const query = vi.fn().mockResolvedValue({
      json: async () => [
        {
          name: TABLE_LOG_EVENTS,
          create_table_query: `CREATE TABLE ${TABLE_LOG_EVENTS} (...) TTL timestamp + toIntervalDay(30)`,
        },
        {
          name: TABLE_SCORE_EVENTS,
          create_table_query: `CREATE TABLE ${TABLE_SCORE_EVENTS} (...) TTL timestamp + toIntervalDay(90)`,
        },
        {
          name: TABLE_DELETION_REQUESTS,
          create_table_query: `CREATE TABLE ${TABLE_DELETION_REQUESTS} (...) TTL requestedAt + toIntervalDay(120)`,
        },
      ],
    });
    const command = vi.fn().mockResolvedValue(undefined);

    const applied = await applyClickHouseRetention({
      client: { query, command } as any,
      retention: { logs: 30 },
    });

    expect(applied.map(entry => entry.sql)).toEqual([
      `ALTER TABLE ${TABLE_SCORE_EVENTS} REMOVE TTL`,
      `ALTER TABLE ${TABLE_DELETION_REQUESTS} REMOVE TTL`,
    ]);
    expect(command.mock.calls.map(([args]) => args.query)).toEqual(applied.map(entry => entry.sql));
  });

  it('removes all stale managed TTLs when retention is disabled', async () => {
    const query = vi.fn().mockResolvedValue({
      json: async () => [
        {
          name: TABLE_LOG_EVENTS,
          create_table_query: `CREATE TABLE ${TABLE_LOG_EVENTS} (...) TTL timestamp + toIntervalDay(30)`,
        },
        {
          name: TABLE_DELETION_REQUESTS,
          create_table_query: `CREATE TABLE ${TABLE_DELETION_REQUESTS} (...) TTL requestedAt + toIntervalDay(60)`,
        },
      ],
    });
    const command = vi.fn().mockResolvedValue(undefined);

    const applied = await applyClickHouseRetention({ client: { query, command } as any, retention: {} });

    expect(applied.map(entry => entry.sql)).toEqual([
      `ALTER TABLE ${TABLE_LOG_EVENTS} REMOVE TTL`,
      `ALTER TABLE ${TABLE_DELETION_REQUESTS} REMOVE TTL`,
    ]);
    expect(command).toHaveBeenCalledTimes(2);
  });
});

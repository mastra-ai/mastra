import type { ClickHouseClient } from '@clickhouse/client';
import { describe, expect, it, vi } from 'vitest';

import { TABLE_DELETION_REQUESTS } from './ddl';
import { batchDeleteTraces } from './tracing';

function createClient(options?: { rejectStamp?: boolean }) {
  const insert = vi.fn().mockResolvedValue(undefined);
  const command = vi.fn().mockImplementation(({ query }: { query: string }) => {
    if (options?.rejectStamp && query.startsWith('ALTER TABLE')) {
      return Promise.reject(new Error('stamp failed'));
    }
    return Promise.resolve(undefined);
  });
  return { client: { insert, command } as unknown as ClickHouseClient, insert, command };
}

describe('batchDeleteTraces deletion lifecycle', () => {
  it('keeps an empty batch as a no-op', async () => {
    const { client, insert, command } = createClient();
    await batchDeleteTraces(client, { traceIds: [] });
    expect(insert).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
  });

  it('records the full predicate, stamps every table, then applies every mask', async () => {
    const { client, insert, command } = createClient();
    await batchDeleteTraces(client, {
      traceIds: ['trace-2', 'trace-1', 'trace-2'],
      organizationId: 'org-1',
      resourceId: 'resource-1',
    });

    expect(insert).toHaveBeenCalledTimes(1);
    const request = insert.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      table: TABLE_DELETION_REQUESTS,
      format: 'JSONEachRow',
      values: [
        expect.objectContaining({
          requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
          organizationId: 'org-1',
          resourceId: 'resource-1',
          signal: 'traces',
          predicateType: 'traceIds',
          predicateValues: ['trace-2', 'trace-1', 'trace-2'],
          requestedBy: '',
        }),
      ],
    });

    expect(command).toHaveBeenCalledTimes(14);
    const calls = command.mock.calls.map(
      ([call]) =>
        call as {
          query: string;
          query_params: unknown;
          clickhouse_settings: Record<string, unknown> | undefined;
        },
    );
    const stamps = calls.slice(0, 7);
    const masks = calls.slice(7);
    expect(stamps.every(call => call.query.startsWith('ALTER TABLE'))).toBe(true);
    expect(stamps.every(call => call.query.includes('UPDATE deletedAt = now() WHERE'))).toBe(true);
    expect(stamps.every(call => call.clickhouse_settings && call.clickhouse_settings.mutations_sync === '2')).toBe(
      true,
    );
    expect(masks.every(call => call.query.startsWith('DELETE FROM'))).toBe(true);
    expect(
      masks.every(call => call.clickhouse_settings && call.clickhouse_settings.lightweight_deletes_sync === '2'),
    ).toBe(true);

    for (let index = 0; index < stamps.length; index++) {
      const stampPredicate = stamps[index]!.query.split(' WHERE ')[1];
      const maskPredicate = masks[index]!.query.split(' WHERE ')[1];
      expect(maskPredicate).toBe(stampPredicate);
      expect(masks[index]!.query_params).toBe(stamps[index]!.query_params);
    }

    expect(insert.mock.invocationCallOrder[0]).toBeLessThan(command.mock.invocationCallOrder[0]!);
  });

  it('adds ON CLUSTER only to stamp mutations and uses request insert quorum', async () => {
    const { client, insert, command } = createClient();
    await batchDeleteTraces(client, { traceIds: ['trace-1'] }, { cluster: 'test_cluster' });

    expect(insert.mock.calls[0]?.[0]).toMatchObject({
      clickhouse_settings: expect.objectContaining({ insert_quorum: 'auto', insert_quorum_parallel: 1 }),
    });
    const queries = command.mock.calls.map(([call]) => (call as { query: string }).query);
    expect(queries.slice(0, 7).every(query => query.includes(" ON CLUSTER 'test_cluster' UPDATE "))).toBe(true);
    expect(queries.slice(7).every(query => !query.includes(' ON CLUSTER '))).toBe(true);
  });

  it('leaves the durable request in place when stamping fails and does not start masks', async () => {
    const { client, insert, command } = createClient({ rejectStamp: true });
    await expect(batchDeleteTraces(client, { traceIds: ['trace-1'] })).rejects.toThrow('stamp failed');

    expect(insert).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledTimes(7);
    expect(command.mock.calls.every(([call]) => (call as { query: string }).query.startsWith('ALTER TABLE'))).toBe(
      true,
    );
  });
});

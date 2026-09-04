import type { ClickHouseClient } from '@clickhouse/client';
import { describe, expect, it, vi } from 'vitest';

import {
  TABLE_DELETION_REQUESTS,
  TABLE_FEEDBACK_EVENTS,
  TABLE_LOG_EVENTS,
  TABLE_METRIC_EVENTS,
  TABLE_SCORE_EVENTS,
  TABLE_SPAN_EVENTS,
  TABLE_TRACE_BRANCHES,
  TABLE_TRACE_ROOTS,
} from './ddl';
import { batchDeleteTraces } from './tracing';

function createClient(options?: { rejectDelete?: boolean }) {
  const insert = vi.fn().mockResolvedValue(undefined);
  const command = vi.fn().mockImplementation(() => {
    if (options?.rejectDelete) return Promise.reject(new Error('delete failed'));
    return Promise.resolve(undefined);
  });
  return { client: { insert, command } as unknown as ClickHouseClient, insert, command };
}

describe('batchDeleteTraces deletion requests', () => {
  it('keeps an empty batch as a no-op', async () => {
    const { client, insert, command } = createClient();
    await batchDeleteTraces(client, { traceIds: [] });
    expect(insert).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
  });

  it('records the full predicate before applying synchronous lightweight delete masks', async () => {
    const { client, insert, command } = createClient();
    await batchDeleteTraces(client, {
      traceIds: ['trace-2', 'trace-1', 'trace-2'],
      organizationId: 'org-1',
      resourceId: 'resource-1',
    });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0]?.[0]).toMatchObject({
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

    expect(command).toHaveBeenCalledTimes(7);
    const calls = command.mock.calls.map(
      ([call]) =>
        call as {
          query: string;
          query_params: Record<string, string>;
          clickhouse_settings: Record<string, unknown>;
        },
    );
    expect(calls.map(call => call.query.match(/^DELETE FROM (\w+)/)?.[1]).sort()).toEqual(
      [
        TABLE_SPAN_EVENTS,
        TABLE_TRACE_ROOTS,
        TABLE_TRACE_BRANCHES,
        TABLE_METRIC_EVENTS,
        TABLE_LOG_EVENTS,
        TABLE_SCORE_EVENTS,
        TABLE_FEEDBACK_EVENTS,
      ].sort(),
    );
    expect(calls.every(call => call.clickhouse_settings.lightweight_deletes_sync === '2')).toBe(true);
    expect(calls.every(call => call.query.includes('organizationId = {scope_org:String}'))).toBe(true);
    expect(calls.every(call => call.query.includes('resourceId = {scope_res:String}'))).toBe(true);
    expect(calls.every(call => call.query_params.scope_org === 'org-1')).toBe(true);
    expect(calls.every(call => call.query_params.scope_res === 'resource-1')).toBe(true);
    expect(insert.mock.invocationCallOrder[0]).toBeLessThan(command.mock.invocationCallOrder[0]!);
  });

  it('uses request insert quorum without adding ON CLUSTER to lightweight deletes', async () => {
    const { client, insert, command } = createClient();
    await batchDeleteTraces(client, { traceIds: ['trace-1'] }, { cluster: 'test_cluster' });

    expect(insert.mock.calls[0]?.[0]).toMatchObject({
      clickhouse_settings: expect.objectContaining({ insert_quorum: 'auto', insert_quorum_parallel: 1 }),
    });
    const queries = command.mock.calls.map(([call]) => (call as { query: string }).query);
    expect(queries.every(query => query.startsWith('DELETE FROM'))).toBe(true);
    expect(queries.every(query => !query.includes(' ON CLUSTER '))).toBe(true);
  });

  it('leaves the durable request in place when a lightweight delete fails', async () => {
    const { client, insert, command } = createClient({ rejectDelete: true });
    await expect(batchDeleteTraces(client, { traceIds: ['trace-1'] })).rejects.toThrow('delete failed');

    expect(insert).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledTimes(7);
  });
});

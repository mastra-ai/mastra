import { describe, expect, it, vi } from 'vitest';
import { ObservabilityStorageClickhouseVNext } from './domains/observability/v-next';
import { TABLE_LOG_EVENTS } from './domains/observability/v-next/ddl';
import { ClickhouseStoreVNext } from '.';

describe('ClickhouseStoreVNext retention configuration', () => {
  it('forwards retention to the vNext observability domain', async () => {
    const query = vi.fn().mockResolvedValue({
      json: async () => [
        {
          name: TABLE_LOG_EVENTS,
          create_table_query: `CREATE TABLE ${TABLE_LOG_EVENTS} (...) TTL timestamp + toIntervalDay(7)`,
        },
      ],
    });
    const client = { query, command: vi.fn() };
    const store = new ClickhouseStoreVNext({
      id: 'retention-forwarding',
      client: client as any,
      retention: { logs: 7 },
    });

    const observability = await store.getStore('observability');
    expect(observability).toBeInstanceOf(ObservabilityStorageClickhouseVNext);
    await (observability as ObservabilityStorageClickhouseVNext).applyRetention();

    expect(query).toHaveBeenCalledWith(expect.objectContaining({ query_params: { tables: [TABLE_LOG_EVENTS] } }));
    expect(client.command).not.toHaveBeenCalled();
  });
});

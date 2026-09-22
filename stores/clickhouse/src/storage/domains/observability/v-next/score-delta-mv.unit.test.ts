import { describe, expect, it, vi } from 'vitest';
import { MV_SCORE_EVENTS_DELTA } from './ddl';
import { dropStaleScoreDeltaMv } from '.';

const legacyMv = `CREATE MATERIALIZED VIEW ${MV_SCORE_EVENTS_DELTA} AS SELECT scoreId FROM mastra_score_events`;
const currentMv = `${legacyMv} WHERE scoreId NOT IN (SELECT scoreId FROM mastra_score_events_delta)`;

describe('dropStaleScoreDeltaMv', () => {
  it('drops a legacy view on the connected host when no cluster is configured', async () => {
    const query = vi.fn().mockResolvedValue({ json: async () => [{ create_table_query: legacyMv }] });
    const command = vi.fn();

    await dropStaleScoreDeltaMv({ query, command } as any, undefined);

    expect(query.mock.calls[0]?.[0].query).toContain('FROM system.tables');
    expect(query.mock.calls[0]?.[0].query).not.toContain('clusterAllReplicas');
    expect(command).toHaveBeenCalledTimes(1);
    expect(command.mock.calls[0]?.[0].query).toBe(`DROP VIEW IF EXISTS ${MV_SCORE_EVENTS_DELTA}`);
  });

  it('keeps a current view and a missing view alone', async () => {
    for (const rows of [[{ create_table_query: currentMv }], []]) {
      const query = vi.fn().mockResolvedValue({ json: async () => rows });
      const command = vi.fn();

      await dropStaleScoreDeltaMv({ query, command } as any, undefined);

      expect(command).not.toHaveBeenCalled();
    }
  });

  it('inspects every replica and drops ON CLUSTER when any host still has the legacy view', async () => {
    const query = vi.fn().mockResolvedValue({
      json: async () => [{ create_table_query: currentMv }, { create_table_query: legacyMv }],
    });
    const command = vi.fn();

    await dropStaleScoreDeltaMv({ query, command } as any, { cluster: 'obs-cluster' });

    expect(query.mock.calls[0]?.[0]).toMatchObject({
      query_params: { cluster: 'obs-cluster', name: MV_SCORE_EVENTS_DELTA },
    });
    expect(query.mock.calls[0]?.[0].query).toContain('clusterAllReplicas({cluster:String}, system.tables)');
    expect(command).toHaveBeenCalledTimes(1);
    expect(command.mock.calls[0]?.[0].query).toBe(
      `DROP VIEW IF EXISTS ${MV_SCORE_EVENTS_DELTA} ON CLUSTER 'obs-cluster'`,
    );
  });

  it('does not drop when every replica already has the current view', async () => {
    const query = vi.fn().mockResolvedValue({
      json: async () => [{ create_table_query: currentMv }, { create_table_query: currentMv }],
    });
    const command = vi.fn();

    await dropStaleScoreDeltaMv({ query, command } as any, { cluster: 'obs-cluster' });

    expect(command).not.toHaveBeenCalled();
  });

  it('leaves the view in place when introspection fails', async () => {
    const query = vi.fn().mockRejectedValue(new Error('UNKNOWN_TABLE'));
    const command = vi.fn();

    await dropStaleScoreDeltaMv({ query, command } as any, { cluster: 'obs-cluster' });

    expect(command).not.toHaveBeenCalled();
  });
});

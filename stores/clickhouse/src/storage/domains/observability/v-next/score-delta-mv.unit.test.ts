import { describe, expect, it, vi } from 'vitest';
import { MV_SCORE_EVENTS_DELTA, TABLE_SCORE_EVENTS_DELTA } from './ddl';
import { reconcileScoreDeltaMv } from '.';

const legacyMv = `CREATE MATERIALIZED VIEW ${MV_SCORE_EVENTS_DELTA} AS SELECT scoreId FROM mastra_score_events`;
const currentMv = `${legacyMv} WHERE scoreId NOT IN (SELECT scoreId FROM ${TABLE_SCORE_EVENTS_DELTA})`;

describe('reconcileScoreDeltaMv', () => {
  it('alters a legacy view in place on the connected host when no cluster is configured', async () => {
    const query = vi.fn().mockResolvedValue({ json: async () => [{ create_table_query: legacyMv }] });
    const command = vi.fn();

    await reconcileScoreDeltaMv({ query, command } as any, undefined, 'serial');

    expect(query.mock.calls[0]?.[0].query).toContain('FROM system.tables');
    expect(query.mock.calls[0]?.[0].query).not.toContain('clusterAllReplicas');
    expect(command).toHaveBeenCalledTimes(1);
    const ddl = command.mock.calls[0]?.[0].query as string;
    expect(ddl.startsWith(`ALTER TABLE ${MV_SCORE_EVENTS_DELTA} MODIFY QUERY SELECT`)).toBe(true);
    expect(ddl).toContain(`WHERE scoreId NOT IN (`);
    expect(ddl).toContain("generateSerialID('mastra_score_events_delta_cursor')");
    expect(ddl).not.toContain('DROP');
  });

  it('keeps a current view and a missing view alone', async () => {
    for (const rows of [[{ create_table_query: currentMv }], []]) {
      const query = vi.fn().mockResolvedValue({ json: async () => rows });
      const command = vi.fn();

      await reconcileScoreDeltaMv({ query, command } as any, undefined, 'serial');

      expect(command).not.toHaveBeenCalled();
    }
  });

  it('inspects every replica and alters ON CLUSTER when any host still has the legacy view', async () => {
    const query = vi.fn().mockResolvedValue({
      json: async () => [{ create_table_query: currentMv }, { create_table_query: legacyMv }],
    });
    const command = vi.fn();

    await reconcileScoreDeltaMv({ query, command } as any, { cluster: 'obs-cluster' }, 'fallback');

    expect(query.mock.calls[0]?.[0]).toMatchObject({
      query_params: { cluster: 'obs-cluster', name: MV_SCORE_EVENTS_DELTA },
    });
    expect(query.mock.calls[0]?.[0].query).toContain('clusterAllReplicas({cluster:String}, system.tables)');
    expect(command).toHaveBeenCalledTimes(1);
    const ddl = command.mock.calls[0]?.[0].query as string;
    expect(ddl.startsWith(`ALTER TABLE ${MV_SCORE_EVENTS_DELTA} ON CLUSTER 'obs-cluster' MODIFY QUERY SELECT`)).toBe(
      true,
    );
    expect(ddl).toContain('farmFingerprint64(');
  });

  it('does not alter when every replica already has the current view', async () => {
    const query = vi.fn().mockResolvedValue({
      json: async () => [{ create_table_query: currentMv }, { create_table_query: currentMv }],
    });
    const command = vi.fn();

    await reconcileScoreDeltaMv({ query, command } as any, { cluster: 'obs-cluster' }, 'serial');

    expect(command).not.toHaveBeenCalled();
  });

  it('warns and leaves the view in place when introspection fails', async () => {
    const query = vi.fn().mockRejectedValue(new Error('UNKNOWN_TABLE'));
    const command = vi.fn();
    const warn = vi.fn();

    await reconcileScoreDeltaMv({ query, command } as any, { cluster: 'obs-cluster' }, 'serial', { warn } as any);

    expect(command).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('UNKNOWN_TABLE');
  });
});

import { describe, expect, it } from 'vitest';
import {
  applyClickhouseDDLConfig,
  buildClickhouseTableEngine,
  isReplicatedEngineConfig,
  isReplicatedTableEngineName,
} from './engine';

describe('buildClickhouseTableEngine', () => {
  it('keeps plain engines by default', () => {
    expect(buildClickhouseTableEngine('MergeTree()', 'mastra_log_events')).toBe('MergeTree()');
    expect(buildClickhouseTableEngine('ReplacingMergeTree(updatedAt)', 'mastra_spans')).toBe(
      'ReplacingMergeTree(updatedAt)',
    );
  });

  it('maps MergeTree engines to replicated variants', () => {
    expect(buildClickhouseTableEngine('MergeTree', 'mastra_discovery_pairs', 'replicated')).toBe(
      "ReplicatedMergeTree('/clickhouse/tables/{shard}/{database}/mastra_discovery_pairs', '{replica}')",
    );
    expect(buildClickhouseTableEngine('ReplacingMergeTree', 'mastra_log_events', 'replicated')).toBe(
      "ReplicatedReplacingMergeTree('/clickhouse/tables/{shard}/{database}/mastra_log_events', '{replica}')",
    );
    expect(buildClickhouseTableEngine('ReplacingMergeTree(updatedAt)', 'mastra_spans', 'replicated')).toBe(
      "ReplicatedReplacingMergeTree('/clickhouse/tables/{shard}/{database}/mastra_spans', '{replica}', updatedAt)",
    );
  });

  it('honors custom replicated engine settings', () => {
    expect(
      buildClickhouseTableEngine('ReplacingMergeTree', 'mastra_span_events', {
        type: 'replicated',
        zooPath: '/clickhouse/custom/{table}',
        replica: '{replica_name}',
      }),
    ).toBe("ReplicatedReplacingMergeTree('/clickhouse/custom/mastra_span_events', '{replica_name}')");
  });
});

describe('replicated engine detection', () => {
  it('detects replicated config and table engine names', () => {
    expect(isReplicatedEngineConfig('replicated')).toBe(true);
    expect(isReplicatedEngineConfig({ type: 'replicated' })).toBe(true);
    expect(isReplicatedEngineConfig('default')).toBe(false);

    expect(isReplicatedTableEngineName('ReplicatedMergeTree')).toBe(true);
    expect(isReplicatedTableEngineName('ReplicatedReplacingMergeTree')).toBe(true);
    expect(isReplicatedTableEngineName('SharedReplacingMergeTree')).toBe(true);
    expect(isReplicatedTableEngineName('ReplacingMergeTree')).toBe(false);
    expect(isReplicatedTableEngineName('MergeTree')).toBe(false);
  });
});

describe('applyClickhouseDDLConfig', () => {
  it('updates table engines and ON CLUSTER clauses for replicated table DDL', () => {
    const ddl = `
CREATE TABLE IF NOT EXISTS mastra_discovery_pairs (
  kind String
)
ENGINE = MergeTree
ORDER BY kind
`;

    expect(
      applyClickhouseDDLConfig(ddl, {
        type: 'replicated',
        cluster: 'prod_cluster',
        zooPath: '/clickhouse/observability/{table}',
      }),
    ).toContain(
      "CREATE TABLE IF NOT EXISTS mastra_discovery_pairs ON CLUSTER 'prod_cluster' (\n  kind String\n)\nENGINE = ReplicatedMergeTree('/clickhouse/observability/mastra_discovery_pairs', '{replica}')",
    );
  });

  it('supports CREATE TABLE without IF NOT EXISTS', () => {
    expect(
      applyClickhouseDDLConfig(`CREATE TABLE mastra_spans (id String) ENGINE = ReplacingMergeTree(updatedAt)`, {
        type: 'replicated',
        cluster: 'prod_cluster',
      }),
    ).toBe(
      `CREATE TABLE mastra_spans ON CLUSTER 'prod_cluster' (id String) ENGINE = ReplicatedReplacingMergeTree('/clickhouse/tables/{shard}/{database}/mastra_spans', '{replica}', updatedAt)`,
    );
  });

  it('adds ON CLUSTER to materialized views and ALTER statements', () => {
    expect(
      applyClickhouseDDLConfig(
        `CREATE MATERIALIZED VIEW IF NOT EXISTS mastra_mv_trace_roots TO mastra_trace_roots AS SELECT * FROM mastra_span_events`,
        { type: 'replicated', cluster: 'prod_cluster' },
      ),
    ).toContain("mastra_mv_trace_roots ON CLUSTER 'prod_cluster' TO");

    expect(
      applyClickhouseDDLConfig(`ALTER TABLE mastra_span_events ADD COLUMN IF NOT EXISTS resourceId Nullable(String)`, {
        type: 'replicated',
        cluster: 'prod_cluster',
      }),
    ).toBe(
      `ALTER TABLE mastra_span_events ON CLUSTER 'prod_cluster' ADD COLUMN IF NOT EXISTS resourceId Nullable(String)`,
    );
  });
});

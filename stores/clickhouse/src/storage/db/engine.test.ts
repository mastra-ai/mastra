import { describe, it, expect } from 'vitest';
import { buildEngineClause, classifyEngine, isReplicatedMode, onClusterClause, validateEngineConfig } from './engine';
import type { ClickhouseTableEngineConfig } from './engine';

describe('validateEngineConfig', () => {
  it('treats undefined as default', () => {
    expect(validateEngineConfig(undefined)).toEqual({ type: 'default' });
  });

  it('passes through default mode unchanged', () => {
    const cfg: ClickhouseTableEngineConfig = { type: 'default' };
    expect(validateEngineConfig(cfg)).toBe(cfg);
  });

  it('accepts replicated mode with cluster', () => {
    const cfg = { type: 'replicated' as const, cluster: 'prod' };
    expect(validateEngineConfig(cfg)).toBe(cfg);
  });

  it('accepts replicated mode with externallyManagedDDL', () => {
    const cfg = { type: 'replicated' as const, externallyManagedDDL: true as const };
    expect(validateEngineConfig(cfg)).toBe(cfg);
  });

  it('rejects replicated mode without cluster or externallyManagedDDL', () => {
    expect(() => validateEngineConfig({ type: 'replicated' } as any)).toThrowError(/replicated mode requires either/);
  });

  it('rejects replicated mode with both cluster and externallyManagedDDL', () => {
    expect(() =>
      validateEngineConfig({ type: 'replicated', cluster: 'x', externallyManagedDDL: true } as any),
    ).toThrowError(/replicated mode accepts either/);
  });

  it('rejects unknown type', () => {
    expect(() => validateEngineConfig({ type: 'magic' } as any)).toThrowError(/unknown type/);
  });
});

describe('buildEngineClause', () => {
  const def: ClickhouseTableEngineConfig = { type: 'default' };
  const replWithCluster: ClickhouseTableEngineConfig = { type: 'replicated', cluster: 'prod' };
  const replExternal: ClickhouseTableEngineConfig = { type: 'replicated', externallyManagedDDL: true };

  it('passes plain MergeTree through unchanged in default mode', () => {
    expect(buildEngineClause('mastra_messages', 'MergeTree()', def)).toBe('MergeTree()');
    expect(buildEngineClause('mastra_messages', 'MergeTree', def)).toBe('MergeTree()');
  });

  it('preserves ReplacingMergeTree args in default mode', () => {
    expect(buildEngineClause('mastra_spans', 'ReplacingMergeTree(updatedAt)', def)).toBe(
      'ReplacingMergeTree(updatedAt)',
    );
  });

  it('rewrites MergeTree to Replicated in replicated-with-cluster mode', () => {
    expect(buildEngineClause('mastra_messages', 'MergeTree()', replWithCluster)).toBe(
      "ReplicatedMergeTree('/clickhouse/tables/{shard}/{database}/mastra_messages', '{replica}')",
    );
  });

  it('rewrites ReplacingMergeTree(args) and preserves the version column', () => {
    expect(buildEngineClause('mastra_spans', 'ReplacingMergeTree(updatedAt)', replWithCluster)).toBe(
      "ReplicatedReplacingMergeTree('/clickhouse/tables/{shard}/{database}/mastra_spans', '{replica}', updatedAt)",
    );
  });

  it('rewrites engines in replicated + externallyManagedDDL mode (engine clause is identical)', () => {
    expect(buildEngineClause('mastra_log_events', 'MergeTree', replExternal)).toBe(
      "ReplicatedMergeTree('/clickhouse/tables/{shard}/{database}/mastra_log_events', '{replica}')",
    );
  });

  it('honors custom zooPath with {table} substitution', () => {
    expect(
      buildEngineClause('mastra_metric_events', 'ReplacingMergeTree', {
        type: 'replicated',
        cluster: 'prod',
        zooPath: '/keeper/custom/{table}/v1',
      }),
    ).toBe("ReplicatedReplacingMergeTree('/keeper/custom/mastra_metric_events/v1', '{replica}')");
  });

  it('appends table name to zooPath when no {table} placeholder is present', () => {
    expect(
      buildEngineClause('mastra_log_events', 'MergeTree', {
        type: 'replicated',
        cluster: 'prod',
        zooPath: '/keeper/observability',
      }),
    ).toBe("ReplicatedMergeTree('/keeper/observability/mastra_log_events', '{replica}')");
  });

  it('honors custom replica name', () => {
    expect(
      buildEngineClause('mastra_score_events', 'MergeTree', {
        type: 'replicated',
        cluster: 'prod',
        replica: '{replica_name}',
      }),
    ).toBe("ReplicatedMergeTree('/clickhouse/tables/{shard}/{database}/mastra_score_events', '{replica_name}')");
  });

  it('passes through unknown engine families unchanged', () => {
    expect(buildEngineClause('mastra_x', 'CollapsingMergeTree(sign)', replWithCluster)).toBe(
      'CollapsingMergeTree(sign)',
    );
  });
});

describe('onClusterClause', () => {
  it('returns empty string in default mode', () => {
    expect(onClusterClause({ type: 'default' })).toBe('');
  });

  it('returns empty string in replicated + externallyManagedDDL mode', () => {
    expect(onClusterClause({ type: 'replicated', externallyManagedDDL: true })).toBe('');
  });

  it('returns leading-space ON CLUSTER fragment in replicated + cluster mode', () => {
    expect(onClusterClause({ type: 'replicated', cluster: 'prod_cluster' })).toBe(" ON CLUSTER 'prod_cluster'");
  });

  it('escapes single quotes in cluster names', () => {
    expect(onClusterClause({ type: 'replicated', cluster: "weird'name" })).toBe(" ON CLUSTER 'weird\\'name'");
  });
});

describe('classifyEngine', () => {
  it.each([
    ['MergeTree', 'local'],
    ['ReplacingMergeTree', 'local'],
    ['CollapsingMergeTree', 'local'],
    ['ReplicatedMergeTree', 'replicated'],
    ['ReplicatedReplacingMergeTree', 'replicated'],
    ['SharedMergeTree', 'replicated'],
    ['SharedReplacingMergeTree', 'replicated'],
  ])('classifies %s as %s', (engine, family) => {
    expect(classifyEngine(engine)).toBe(family);
  });
});

describe('isReplicatedMode', () => {
  it('returns true for replicated mode', () => {
    expect(isReplicatedMode({ type: 'replicated', cluster: 'prod' })).toBe(true);
    expect(isReplicatedMode({ type: 'replicated', externallyManagedDDL: true })).toBe(true);
  });

  it('returns false for default mode', () => {
    expect(isReplicatedMode({ type: 'default' })).toBe(false);
  });
});

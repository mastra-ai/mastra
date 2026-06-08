import { TABLE_SCHEMAS, TABLE_SPANS } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import {
  addOnClusterToDDL,
  applyReplicationToDDL,
  buildReplicatedTableEngine,
  validateReplicationConfig,
} from './replication';
import { ClickhouseDB } from './index';

describe('ClickHouse replication helpers', () => {
  it('maps MergeTree engines to ReplicatedMergeTree engines', () => {
    expect(buildReplicatedTableEngine('MergeTree()', {})).toBe(
      "ReplicatedMergeTree('/clickhouse/tables/{shard}/{database}/{table}', '{replica}')",
    );
    expect(buildReplicatedTableEngine('ReplacingMergeTree()', {})).toBe(
      "ReplicatedReplacingMergeTree('/clickhouse/tables/{shard}/{database}/{table}', '{replica}')",
    );
    expect(buildReplicatedTableEngine('ReplacingMergeTree(updatedAt)', {})).toBe(
      "ReplicatedReplacingMergeTree('/clickhouse/tables/{shard}/{database}/{table}', '{replica}', updatedAt)",
    );
  });

  it('preserves replicated, shared, and unsupported engines', () => {
    expect(buildReplicatedTableEngine("ReplicatedMergeTree('/path', '{replica}')", {})).toBe(
      "ReplicatedMergeTree('/path', '{replica}')",
    );
    expect(buildReplicatedTableEngine('SharedReplacingMergeTree(updatedAt)', {})).toBe(
      'SharedReplacingMergeTree(updatedAt)',
    );
    expect(buildReplicatedTableEngine('Null()', {})).toBe('Null()');
  });

  it('uses custom replica path and replica name', () => {
    expect(
      buildReplicatedTableEngine('MergeTree()', {
        replicaPath: '/custom/{database}/{table}',
        replicaName: '{replica}-a',
      }),
    ).toBe("ReplicatedMergeTree('/custom/{database}/{table}', '{replica}-a')");
  });

  it('adds ON CLUSTER to Mastra-owned DDL forms', () => {
    expect(addOnClusterToDDL('CREATE TABLE IF NOT EXISTS mastra_threads (id String)', { cluster: 'cluster-a' })).toBe(
      "CREATE TABLE IF NOT EXISTS mastra_threads ON CLUSTER 'cluster-a' (id String)",
    );
    expect(addOnClusterToDDL('CREATE MATERIALIZED VIEW IF NOT EXISTS mastra_mv TO mastra_t AS SELECT 1', { cluster: 'cluster-a' })).toBe(
      "CREATE MATERIALIZED VIEW IF NOT EXISTS mastra_mv ON CLUSTER 'cluster-a' TO mastra_t AS SELECT 1",
    );
    expect(addOnClusterToDDL('ALTER TABLE mastra_threads ADD COLUMN IF NOT EXISTS x String', { cluster: 'cluster-a' })).toBe(
      "ALTER TABLE mastra_threads ON CLUSTER 'cluster-a' ADD COLUMN IF NOT EXISTS x String",
    );
    expect(addOnClusterToDDL('DROP TABLE IF EXISTS mastra_threads', { cluster: 'cluster-a' })).toBe(
      "DROP TABLE IF EXISTS mastra_threads ON CLUSTER 'cluster-a'",
    );
  });

  it('rewrites table DDL engines and cluster together', () => {
    const ddl = `CREATE TABLE IF NOT EXISTS mastra_threads (
  id String
)
ENGINE = ReplacingMergeTree()
ORDER BY id`;

    expect(applyReplicationToDDL(ddl, { cluster: 'cluster-a' })).toContain(
      "CREATE TABLE IF NOT EXISTS mastra_threads ON CLUSTER 'cluster-a'",
    );
    expect(applyReplicationToDDL(ddl, { cluster: 'cluster-a' })).toContain(
      "ENGINE = ReplicatedReplacingMergeTree('/clickhouse/tables/{shard}/{database}/{table}', '{replica}')",
    );
  });

  it('validates configured string values', () => {
    expect(() => validateReplicationConfig({ cluster: '   ' })).toThrow('replication.cluster must be a non-empty string');
    expect(() => validateReplicationConfig({ replicaPath: '' })).toThrow(
      'replication.replicaPath must be a non-empty string',
    );
    expect(() => validateReplicationConfig({ replicaName: '' })).toThrow(
      'replication.replicaName must be a non-empty string',
    );
  });

  it('checks existing tables before emitting replicated CREATE TABLE DDL', async () => {
    const queries: string[] = [];
    const client = {
      query: async ({ query }: { query: string }) => {
        queries.push(query);
        return { json: async () => [] };
      },
    };
    const db = new ClickhouseDB({ client: client as any, ttl: undefined, replication: { cluster: 'cluster-a' } });

    await db.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] });

    expect(queries[0]).toContain('FROM system.tables');
    expect(queries[1]).toContain(`CREATE TABLE IF NOT EXISTS ${TABLE_SPANS} ON CLUSTER 'cluster-a'`);
    expect(queries[1]).toContain(
      "ENGINE = ReplicatedReplacingMergeTree('/clickhouse/tables/{shard}/{database}/{table}', '{replica}', updatedAt)",
    );
  });

  it('throws on existing local tables before emitting CREATE TABLE DDL', async () => {
    const queries: string[] = [];
    const client = {
      query: async ({ query }: { query: string }) => {
        queries.push(query);
        return { json: async () => [{ name: TABLE_SPANS, engine: 'ReplacingMergeTree' }] };
      },
    };
    const db = new ClickhouseDB({ client: client as any, ttl: undefined, replication: { cluster: 'cluster-a' } });

    await expect(db.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] })).rejects.toThrow(
      'existing Mastra tables use non-replicated local engines',
    );
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('FROM system.tables');
  });
});

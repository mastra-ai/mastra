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

  it('uses custom zookeeper path and replica name', () => {
    expect(
      buildReplicatedTableEngine('MergeTree()', {
        zookeeperPath: '/custom/{database}/{table}',
        replicaName: '{replica}-a',
      }),
    ).toBe("ReplicatedMergeTree('/custom/{database}/{table}', '{replica}-a')");
  });

  it('adds ON CLUSTER to Mastra-owned DDL forms', () => {
    expect(addOnClusterToDDL('CREATE TABLE IF NOT EXISTS mastra_threads (id String)', { cluster: 'cluster-a' })).toBe(
      "CREATE TABLE IF NOT EXISTS mastra_threads ON CLUSTER 'cluster-a' (id String)",
    );
    expect(
      addOnClusterToDDL('CREATE MATERIALIZED VIEW IF NOT EXISTS mastra_mv TO mastra_t AS SELECT 1', {
        cluster: 'cluster-a',
      }),
    ).toBe("CREATE MATERIALIZED VIEW IF NOT EXISTS mastra_mv ON CLUSTER 'cluster-a' TO mastra_t AS SELECT 1");
    expect(
      addOnClusterToDDL('ALTER TABLE mastra_threads ADD COLUMN IF NOT EXISTS x String', { cluster: 'cluster-a' }),
    ).toBe("ALTER TABLE mastra_threads ON CLUSTER 'cluster-a' ADD COLUMN IF NOT EXISTS x String");
    expect(addOnClusterToDDL('DROP TABLE IF EXISTS mastra_threads', { cluster: 'cluster-a' })).toBe(
      "DROP TABLE IF EXISTS mastra_threads ON CLUSTER 'cluster-a'",
    );
    expect(addOnClusterToDDL('DROP VIEW IF EXISTS mastra_mv', { cluster: 'cluster-a' })).toBe(
      "DROP VIEW IF EXISTS mastra_mv ON CLUSTER 'cluster-a'",
    );
    expect(addOnClusterToDDL('SYSTEM REFRESH VIEW mastra_mv', { cluster: 'cluster-a' })).toBe(
      "SYSTEM REFRESH VIEW mastra_mv ON CLUSTER 'cluster-a'",
    );
    expect(addOnClusterToDDL('SYSTEM WAIT VIEW mastra_mv', { cluster: 'cluster-a' })).toBe(
      "SYSTEM WAIT VIEW mastra_mv ON CLUSTER 'cluster-a'",
    );
    expect(
      addOnClusterToDDL('ALTER TABLE mastra_db.mastra_threads ADD COLUMN IF NOT EXISTS y String', {
        cluster: 'cluster-a',
      }),
    ).toBe("ALTER TABLE mastra_db.mastra_threads ON CLUSTER 'cluster-a' ADD COLUMN IF NOT EXISTS y String");
  });

  it('adds ON CLUSTER to maintenance DDL forms', () => {
    expect(addOnClusterToDDL('TRUNCATE TABLE mastra_threads', { cluster: 'cluster-a' })).toBe(
      "TRUNCATE TABLE mastra_threads ON CLUSTER 'cluster-a'",
    );
    expect(addOnClusterToDDL('TRUNCATE TABLE IF EXISTS mastra_threads', { cluster: 'cluster-a' })).toBe(
      "TRUNCATE TABLE IF EXISTS mastra_threads ON CLUSTER 'cluster-a'",
    );
    expect(addOnClusterToDDL('OPTIMIZE TABLE mastra_threads FINAL', { cluster: 'cluster-a' })).toBe(
      "OPTIMIZE TABLE mastra_threads ON CLUSTER 'cluster-a' FINAL",
    );
    expect(addOnClusterToDDL('ALTER TABLE mastra_threads MATERIALIZE TTL', { cluster: 'cluster-a' })).toBe(
      "ALTER TABLE mastra_threads ON CLUSTER 'cluster-a' MATERIALIZE TTL",
    );
    // SYSTEM STOP/START MERGES are intentionally NOT clustered — see the
    // addOnClusterToDDL doc comment and ClickhouseDB.clearTable for rationale.
    expect(addOnClusterToDDL('SYSTEM STOP MERGES mastra_threads', { cluster: 'cluster-a' })).toBe(
      'SYSTEM STOP MERGES mastra_threads',
    );
    expect(addOnClusterToDDL('SYSTEM START MERGES mastra_threads', { cluster: 'cluster-a' })).toBe(
      'SYSTEM START MERGES mastra_threads',
    );
  });

  it('rewrites engines with balanced nested parentheses correctly', () => {
    // The parser captures everything between the outer `(` and the trailing `)`,
    // so a nested function call in the version expression rides along intact.
    // This is the current behavior; the balanced-paren guard in
    // getEngineNameAndArgs would only kick in if a future caller fed us a
    // truly malformed engine string with an unbalanced trailing paren.
    expect(buildReplicatedTableEngine('ReplacingMergeTree(toUInt64(updatedAt))', { cluster: 'c' })).toBe(
      "ReplicatedReplacingMergeTree('/clickhouse/tables/{shard}/{database}/{table}', '{replica}', toUInt64(updatedAt))",
    );
  });

  it.each([
    ['CREATE TABLE', "CREATE TABLE mastra_t ON CLUSTER 'c' (id String)"],
    ['CREATE MATERIALIZED VIEW', "CREATE MATERIALIZED VIEW mastra_mv ON CLUSTER 'c' TO mastra_t AS SELECT 1"],
    ['ALTER TABLE', "ALTER TABLE mastra_t ON CLUSTER 'c' ADD COLUMN IF NOT EXISTS x String"],
    ['DROP TABLE', "DROP TABLE IF EXISTS mastra_t ON CLUSTER 'c'"],
    ['DROP VIEW', "DROP VIEW IF EXISTS mastra_mv ON CLUSTER 'c'"],
    ['TRUNCATE TABLE', "TRUNCATE TABLE mastra_t ON CLUSTER 'c'"],
    ['OPTIMIZE TABLE', "OPTIMIZE TABLE mastra_t ON CLUSTER 'c' FINAL"],
    ['SYSTEM REFRESH VIEW', "SYSTEM REFRESH VIEW mastra_mv ON CLUSTER 'c'"],
    ['SYSTEM WAIT VIEW', "SYSTEM WAIT VIEW mastra_mv ON CLUSTER 'c'"],
  ])('addOnClusterToDDL is idempotent for %s', (_label, sql) => {
    expect(addOnClusterToDDL(sql, { cluster: 'c' })).toBe(sql);
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
    expect(() => validateReplicationConfig({ cluster: '   ' })).toThrow(
      'replication.cluster must be a non-empty string',
    );
    expect(() => validateReplicationConfig({ zookeeperPath: '' })).toThrow(
      'replication.zookeeperPath must be a non-empty string',
    );
    expect(() => validateReplicationConfig({ replicaName: '' })).toThrow(
      'replication.replicaName must be a non-empty string',
    );
    expect(() => validateReplicationConfig({ cluster: 'my cluster' })).toThrow(
      'replication.cluster must not contain whitespace or quote characters',
    );
    expect(() => validateReplicationConfig({ cluster: "evil'); DROP" })).toThrow(
      'replication.cluster must not contain whitespace or quote characters',
    );
    expect(() => validateReplicationConfig({ zookeeperPath: '/path with space' })).toThrow(
      'replication.zookeeperPath must not contain whitespace or quote characters',
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

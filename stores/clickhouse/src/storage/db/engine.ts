export type ClickhouseTableEngineConfig =
  | 'default'
  | 'replicated'
  | {
      type: 'default';
    }
  | {
      type: 'replicated';
      /**
       * Optional ClickHouse cluster name for ON CLUSTER DDL.
       */
      cluster?: string;
      /**
       * Keeper path for replicated tables. Supports a {table} placeholder.
       *
       * Defaults to /clickhouse/tables/{shard}/{table}.
       */
      zooPath?: string;
      /**
       * Replica macro/name passed to Replicated*MergeTree.
       *
       * Defaults to {replica}.
       */
      replica?: string;
    };

function isReplicatedEngineConfig(config?: ClickhouseTableEngineConfig): boolean {
  return config === 'replicated' || (typeof config === 'object' && config.type === 'replicated');
}

function getReplicatedEngineConfig(
  config?: ClickhouseTableEngineConfig,
): Extract<ClickhouseTableEngineConfig, { type: 'replicated' }> {
  return typeof config === 'object' && config.type === 'replicated' ? config : { type: 'replicated' };
}

function quoteClickhouseString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function buildClickhouseTableEngine(
  baseEngine: string,
  tableName: string,
  config?: ClickhouseTableEngineConfig,
): string {
  if (!isReplicatedEngineConfig(config)) {
    return baseEngine;
  }

  const match = baseEngine.trim().match(/^(ReplacingMergeTree|MergeTree)(?:\((.*)\))?$/);
  if (!match) {
    return baseEngine;
  }

  const [, engineName, engineArgs] = match;
  const replicatedConfig = getReplicatedEngineConfig(config);
  const zooPathTemplate = replicatedConfig.zooPath ?? '/clickhouse/tables/{shard}/{table}';
  const zooPath = zooPathTemplate.includes('{table}')
    ? zooPathTemplate.replaceAll('{table}', tableName)
    : `${zooPathTemplate}/${tableName}`;
  const replica = replicatedConfig.replica ?? '{replica}';
  const replicatedEngineName =
    engineName === 'ReplacingMergeTree' ? 'ReplicatedReplacingMergeTree' : 'ReplicatedMergeTree';
  const args = [quoteClickhouseString(zooPath), quoteClickhouseString(replica)];

  if (engineArgs?.trim()) {
    args.push(engineArgs.trim());
  }

  return `${replicatedEngineName}(${args.join(', ')})`;
}

function getClickhouseCluster(config?: ClickhouseTableEngineConfig): string | undefined {
  if (!isReplicatedEngineConfig(config)) {
    return undefined;
  }
  return getReplicatedEngineConfig(config).cluster;
}

function addOnCluster(ddl: string, config?: ClickhouseTableEngineConfig): string {
  const cluster = getClickhouseCluster(config);
  if (!cluster) {
    return ddl;
  }

  const quotedCluster = quoteClickhouseString(cluster);
  return ddl
    .replace(/(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\S+)(\s*\()/i, `$1 ON CLUSTER ${quotedCluster}$2`)
    .replace(
      /(CREATE\s+MATERIALIZED\s+VIEW\s+IF\s+NOT\s+EXISTS\s+\S+)(\s+(?:REFRESH|TO|AS)\b)/i,
      `$1 ON CLUSTER ${quotedCluster}$2`,
    )
    .replace(/(ALTER\s+TABLE\s+\S+)(\s+)/i, `$1 ON CLUSTER ${quotedCluster}$2`);
}

export function applyClickhouseDDLConfig(ddl: string, config?: ClickhouseTableEngineConfig): string {
  const tableMatch =
    ddl.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/i) ?? ddl.match(/ALTER\s+TABLE\s+(\S+)/i);
  const tableName = tableMatch?.[1];
  const configuredDDL = tableName
    ? ddl.replace(/ENGINE\s*=\s*(ReplacingMergeTree|MergeTree)(?:\(([^)]*)\))?/g, match => {
        const baseEngine = match.replace(/ENGINE\s*=\s*/i, '');
        return `ENGINE = ${buildClickhouseTableEngine(baseEngine, tableName, config)}`;
      })
    : ddl;

  return addOnCluster(configuredDDL, config);
}

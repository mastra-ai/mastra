import { serializeDate, TABLE_MESSAGES, TABLE_WORKFLOW_SNAPSHOT, TABLE_SCORERS } from '@mastra/core/storage';
import type { TABLE_NAMES } from '@mastra/core/storage';

export function getKey(tableName: TABLE_NAMES, keys: Record<string, any>): string {
  const keyParts = Object.entries(keys)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}:${value}`);
  return `${tableName}:${keyParts.join(':')}`;
}

/**
 * Escape the Redis glob metacharacters in a literal string so it can be used as
 * the fixed part of a `SCAN MATCH` pattern. Run ids and workflow names are
 * caller-supplied, so an unescaped `*`, `?` or `[...]` in one of them would
 * widen the match to other keys.
 */
export function escapeRedisGlob(value: string): string {
  return value.replace(/[\\*?[\]]/g, char => `\\${char}`);
}

export function processRecord(tableName: TABLE_NAMES, record: Record<string, any>) {
  let key: string;

  if (tableName === TABLE_MESSAGES) {
    // For messages, use threadId as the primary key component
    key = getKey(tableName, { threadId: record.threadId, id: record.id });
  } else if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
    // Snapshots are keyed by run identity only. A run's resourceId is kept in
    // the record but never in the key, so persist, update and delete all reach
    // the same record (legacy resource-suffixed keys are migrated on write).
    key = getKey(tableName, {
      namespace: record.namespace || 'workflows',
      workflow_name: record.workflow_name,
      run_id: record.run_id,
    });
  } else if (tableName === TABLE_SCORERS) {
    key = getKey(tableName, { id: record.id });
  } else {
    key = getKey(tableName, { id: record.id });
  }

  // Convert dates to ISO strings before storing
  const processedRecord = {
    ...record,
    createdAt: serializeDate(record.createdAt),
    updatedAt: serializeDate(record.updatedAt),
  };

  return { key, processedRecord };
}

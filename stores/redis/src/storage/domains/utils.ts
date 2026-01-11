import { serializeDate, TABLE_MESSAGES, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { TABLE_NAMES } from '@mastra/core/storage';

/**
 * Generate a Redis key from table name and key parts.
 *
 * @example
 * ```typescript
 * getKey('mastra_threads', { id: 'thread-123' });
 * // Returns: 'mastra_threads:id:thread-123'
 *
 * getKey('mastra_messages', { threadId: 'thread-123', id: 'msg-456' });
 * // Returns: 'mastra_messages:threadId:thread-123:id:msg-456'
 * ```
 */
export function getKey(tableName: TABLE_NAMES, keys: Record<string, unknown>): string {
  const keyParts = Object.entries(keys)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}:${value}`);

  return `${tableName}:${keyParts.join(':')}`;
}

/**
 * Process a record for storage, generating the appropriate key and serializing dates.
 */
export function processRecord(tableName: TABLE_NAMES, record: Record<string, unknown>) {
  let key: string;

  if (tableName === TABLE_MESSAGES) {
    key = getKey(tableName, { threadId: record.threadId, id: record.id });
  } else if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
    key = getKey(tableName, {
      namespace: record.namespace || 'workflows',
      workflow_name: record.workflow_name,
      run_id: record.run_id,
      ...(record.resourceId ? { resourceId: record.resourceId } : {}),
    });
  } else {
    key = getKey(tableName, { id: record.id });
  }

  const processedRecord = {
    ...record,
    createdAt: serializeDate(record.createdAt as Date | string | undefined),
    updatedAt: serializeDate(record.updatedAt as Date | string | undefined),
  };

  return { key, processedRecord };
}

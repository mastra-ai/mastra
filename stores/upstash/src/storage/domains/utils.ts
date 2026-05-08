import { serializeDate, TABLE_MESSAGES, TABLE_WORKFLOW_SNAPSHOT, TABLE_SCORERS } from '@mastra/core/storage';
import type { TABLE_NAMES } from '@mastra/core/storage';

export function getKey(tableName: TABLE_NAMES, keys: Record<string, any>): string {
  const keyParts = Object.entries(keys)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}:${value}`);
  return `${tableName}:${keyParts.join(':')}`;
}

export function processRecord(tableName: TABLE_NAMES, record: Record<string, any>) {
  let key: string;

  if (tableName === TABLE_MESSAGES) {
    // For messages, use threadId as the primary key component
    key = getKey(tableName, { threadId: record.threadId, id: record.id });
  } else if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
    key = getKey(tableName, {
      namespace: record.namespace || 'workflows',
      workflow_name: record.workflow_name,
      run_id: record.run_id,
      ...(record.resourceId ? { resourceId: record.resourceId } : {}),
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

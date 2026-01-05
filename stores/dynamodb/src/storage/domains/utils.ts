import {
  TABLE_THREADS,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCORERS,
} from '@mastra/core/storage';
import type { TABLE_NAMES } from '@mastra/core/storage';
import type { Service } from 'electrodb';

/**
 * Maps table names to ElectroDB entity names
 */
const ENTITY_MAP: Record<string, string> = {
  [TABLE_THREADS]: 'thread',
  [TABLE_MESSAGES]: 'message',
  [TABLE_RESOURCES]: 'resource',
  [TABLE_WORKFLOW_SNAPSHOT]: 'workflow_snapshot',
  [TABLE_SCORERS]: 'score',
};

/**
 * Gets the primary key fields for an entity based on the scanned item
 */
function getDeleteKey(entityName: string, item: any): Record<string, any> {
  const key: Record<string, any> = { entity: entityName };

  switch (entityName) {
    case 'thread':
    case 'message':
    case 'resource':
    case 'score':
      key.id = item.id;
      break;
    case 'workflow_snapshot':
      key.workflow_name = item.workflow_name;
      key.run_id = item.run_id;
      break;
    default:
      key.id = item.id;
  }

  return key;
}

/**
 * Deletes all data for a given table/entity type
 */
export async function deleteTableData(service: Service<Record<string, any>>, tableName: TABLE_NAMES): Promise<void> {
  const entityName = ENTITY_MAP[tableName];
  if (!entityName || !service.entities[entityName]) {
    throw new Error(`No entity mapping found for table: ${tableName}`);
  }

  const entity = service.entities[entityName];

  // Scan all items
  const result = await entity.scan.go({ pages: 'all' });

  if (!result.data.length) {
    return;
  }

  // Delete in batches of 25 (DynamoDB limit)
  const batchSize = 25;
  for (let i = 0; i < result.data.length; i += batchSize) {
    const batch = result.data.slice(i, i + batchSize);
    const keysToDelete = batch.map((item: any) => getDeleteKey(entityName, item));
    await entity.delete(keysToDelete).go();
  }
}

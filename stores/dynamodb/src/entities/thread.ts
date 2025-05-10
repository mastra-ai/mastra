import { Entity } from 'electrodb';
import { baseAttributes } from './utils';

export const threadEntity = new Entity({
  model: {
    entity: 'thread',
    version: '1',
    service: 'mastra',
  },
  attributes: {
    entity: {
      type: 'string',
      required: true,
    },
    ...baseAttributes,
    id: {
      type: 'string',
      required: true,
    },
    resourceId: {
      type: 'string',
      required: true,
    },
    title: {
      type: 'string',
      required: true,
    },
    metadata: {
      type: 'string',
      required: false,
    },
  },
  indexes: {
    primary: {
      pk: { field: 'pk', composite: ['entity', 'id'] },
      sk: { field: 'sk', composite: [] },
    },
    byResource: {
      index: 'gsi1',
      pk: { field: 'gsi1pk', composite: ['entity', 'resourceId'] },
      sk: { field: 'gsi1sk', composite: ['createdAt'] },
    },
  },
});

// // Export the base entity
// export const ThreadEntity = new Entity(schema);

// // Export the configuration function
// export function configureThreadEntity(
//   client: DynamoDBDocumentClient,
//   table: string,
// ): Entity<string, string, string, Schema<string, string, string>> {
//   return new Entity(schema, { client, table });
// }

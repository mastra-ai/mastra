import { Entity } from 'electrodb';
import { baseAttributes } from './utils';

export const workflowSnapshotEntity = new Entity({
  model: {
    entity: 'workflow_snapshot',
    version: '1',
    service: 'mastra',
  },
  attributes: {
    entity: {
      type: 'string',
      required: true,
    },
    ...baseAttributes,
    workflow_name: {
      type: 'string',
      required: true,
    },
    run_id: {
      type: 'string',
      required: true,
    },
    snapshot: {
      type: 'string', // JSON stringified
      required: true,
      // Stringify snapshot object on set
      set: (value?: any) => {
        if (value && typeof value !== 'string') {
          return JSON.stringify(value);
        }
        return value;
      },
      // Parse JSON string to object on get
      get: (value?: string) => {
        return value;
      },
    },
    resourceId: {
      type: 'string',
      required: false,
    },
  },
  indexes: {
    primary: {
      pk: { field: 'pk', composite: ['entity', 'workflow_name'] },
      sk: { field: 'sk', composite: ['run_id'] },
    },
  },
});

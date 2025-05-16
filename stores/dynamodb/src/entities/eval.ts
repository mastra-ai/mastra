import { Entity } from 'electrodb';
import { baseAttributes } from './utils';

export const evalEntity = new Entity({
  model: {
    entity: 'eval',
    version: '1',
    service: 'mastra',
  },
  attributes: {
    entity: {
      type: 'string',
      required: true,
    },
    ...baseAttributes,
    input: {
      type: 'string',
      required: true,
    },
    output: {
      type: 'string',
      required: true,
    },
    result: {
      type: 'string', // JSON stringified
      required: true,
      // Stringify object on set
      set: (value?: any) => {
        if (value && typeof value !== 'string') {
          return JSON.stringify(value);
        }
        return value;
      },
      // Parse JSON string to object on get
      get: (value?: string) => {
        if (value) {
          return JSON.parse(value);
        }
        return value;
      },
    },
    agent_name: {
      type: 'string',
      required: true,
    },
    metric_name: {
      type: 'string',
      required: true,
    },
    instructions: {
      type: 'string',
      required: true,
    },
    test_info: {
      type: 'string', // JSON stringified
      required: false,
      // Stringify object on set
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
    global_run_id: {
      type: 'string',
      required: true,
    },
    run_id: {
      type: 'string',
      required: true,
    },
    created_at: {
      type: 'string',
      required: true,
      // Initialize with current timestamp if not provided
      default: () => new Date().toISOString(),
      // Convert Date to ISO string on set
      set: (value?: Date | string) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value || new Date().toISOString();
      },
    },
  },
  indexes: {
    primary: {
      pk: { field: 'pk', composite: ['entity', 'run_id'] },
      sk: { field: 'sk', composite: [] },
    },
    byAgent: {
      index: 'gsi1',
      pk: { field: 'gsi1pk', composite: ['entity', 'agent_name'] },
      sk: { field: 'gsi1sk', composite: ['created_at'] },
    },
  },
});

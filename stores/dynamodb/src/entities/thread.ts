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
      // Stringify metadata object on set if it's not already a string
      set: (value?: Record<string, unknown> | string) => {
        if (value && typeof value !== 'string') {
          return JSON.stringify(value);
        }
        return value;
      },
      // Parse JSON string to object on get
      get: (value?: string) => {
        if (value && typeof value === 'string') {
          try {
            // Attempt to parse only if it might be JSON (e.g., starts with { or [)
            if (value.startsWith('{') || value.startsWith('[')) {
              return JSON.parse(value);
            }
          } catch {
            // Ignore parse error, return original string
            return value;
          }
        }
        return value;
      },
    },
  },
  indexes: {
    primary: {
      pk: { field: 'pk', composite: ['entity', 'id'] },
      sk: { field: 'sk', composite: ['id'] },
    },
    byResource: {
      index: 'gsi1',
      pk: { field: 'gsi1pk', composite: ['entity', 'resourceId'] },
      sk: { field: 'gsi1sk', composite: ['createdAt'] },
    },
  },
});

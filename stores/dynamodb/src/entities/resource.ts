import { Entity } from 'electrodb';
import { baseAttributes } from './utils';

export const resourceEntity = new Entity({
  model: {
    entity: 'resource',
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
    workingMemory: {
      type: 'string',
      required: false,
    },
    metadata: {
      type: 'string',
      required: false,
      // Stringify content object on set if it's not already a string
      set: (value?: string | void) => {
        if (value && typeof value !== 'string') {
          return JSON.stringify(value);
        }
        return value;
      },
      // Parse JSON string to object on get ONLY if it looks like JSON
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
      sk: { field: 'sk', composite: ['entity'] },
    },
  },
});

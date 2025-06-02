import { Entity } from 'electrodb';
import { baseAttributes } from './utils';

export const messageEntity = new Entity({
  model: {
    entity: 'message',
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
    threadId: {
      type: 'string',
      required: true,
    },
    content: {
      type: 'string',
      required: true,
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
    role: {
      type: 'string',
      required: true,
    },
    type: {
      type: 'string',
      default: 'text',
    },
    resourceId: {
      type: 'string',
      required: false,
    },
    toolCallIds: {
      type: 'string',
      required: false,
      set: (value?: string[] | string) => {
        if (Array.isArray(value)) {
          return JSON.stringify(value);
        }
        return value;
      },
      // Parse JSON string to array on get
      get: (value?: string) => {
        if (value && typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            // Return raw value on error, consistent with 'content' field
            return value;
          }
        }
        // If value was not a string, or if it was an empty string, return it as is.
        return value;
      },
    },
    toolCallArgs: {
      type: 'string',
      required: false,
      set: (value?: Record<string, unknown>[] | string) => {
        if (value && typeof value !== 'string') {
          return JSON.stringify(value);
        }
        return value;
      },
      // Parse JSON string to object on get
      get: (value?: string) => {
        if (value && typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            // Return raw value on error, consistent with 'content' field
            return value;
          }
        }
        // If value was not a string, or if it was an empty string, return it as is.
        return value;
      },
    },
    toolNames: {
      type: 'string',
      required: false,
      set: (value?: string[] | string) => {
        if (Array.isArray(value)) {
          return JSON.stringify(value);
        }
        return value;
      },
      // Parse JSON string to array on get
      get: (value?: string) => {
        if (value && typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            // Return raw value on error, consistent with 'content' field
            return value;
          }
        }
        // If value was not a string, or if it was an empty string, return it as is.
        return value;
      },
    },
  },
  indexes: {
    primary: {
      pk: { field: 'pk', composite: ['entity', 'id'] },
      sk: { field: 'sk', composite: ['entity'] },
    },
    byThread: {
      index: 'gsi1',
      pk: { field: 'gsi1pk', composite: ['entity', 'threadId'] },
      sk: { field: 'gsi1sk', composite: ['createdAt'] },
    },
  },
});

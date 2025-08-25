import { Entity } from 'electrodb';
import { baseAttributes } from './utils';

export const aiSpanEntity = new Entity({
  model: {
    entity: 'ai-span',
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
    traceId: {
      type: 'string',
      required: true,
    },
    spanId: {
      type: 'string',
      required: true,
    },
    parentSpanId: {
      type: 'string',
      required: false,
      default: 'ROOT',
    },
    name: {
      type: 'string',
      required: true,
    },
    scope: {
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
        return value ? JSON.parse(value) : value;
      },
    },
    spanType: {
      type: 'number',
      required: true,
    },
    attributes: {
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
        return value ? JSON.parse(value) : value;
      },
    },
    metadata: {
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
        return value ? JSON.parse(value) : value;
      },
    },
    events: {
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
        return value ? JSON.parse(value) : value;
      },
    },
    links: {
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
        return value ? JSON.parse(value) : value;
      },
    },
    input: {
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
        return value ? JSON.parse(value) : value;
      },
    },
    output: {
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
        return value ? JSON.parse(value) : value;
      },
    },
    error: {
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
        return value ? JSON.parse(value) : value;
      },
    },
    startTime: {
      type: 'number',
      required: true,
    },
    endTime: {
      type: 'number',
      required: true,
    },
  },
  indexes: {
    primary: {
      pk: { field: 'pk', composite: ['entity', 'id'] },
      sk: { field: 'sk', composite: [] },
    },
    byName: {
      index: 'gsi1',
      pk: { field: 'gsi1pk', composite: ['entity', 'name'] },
      sk: { field: 'gsi1sk', composite: ['createdAt'] },
    },
    byTraceId: {
      index: 'gsi2',
      pk: { field: 'gsi2pk', composite: ['entity', 'traceId'] },
      sk: { field: 'gsi2sk', composite: ['createdAt'] },
    },
    bySpanType: {
      index: 'gsi3',
      pk: { field: 'gsi3pk', composite: ['entity', 'spanType'] },
      sk: { field: 'gsi3sk', composite: ['createdAt'] },
    },
    byParentSpan: {
      index: 'gsi4',
      pk: { field: 'gsi4pk', composite: ['entity', 'parentSpanId'] },
      sk: { field: 'gsi4sk', composite: ['createdAt'] },
    },
    byCreatedAt: {
      index: 'gsi5',
      pk: { field: 'gsi5pk', composite: ['entity', 'createdAt'] },
      sk: { field: 'gsi5sk', composite: ['id'] },
    },
  },
});

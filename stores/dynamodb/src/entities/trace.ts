import { Entity } from 'electrodb';
import { baseAttributes } from './utils';

export const traceEntity = new Entity({
  model: {
    entity: 'trace',
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
    parentSpanId: {
      type: 'string',
      default: 'ROOT_SPAN',
    },
    name: {
      type: 'string',
      required: true,
    },
    traceId: {
      type: 'string',
      required: true,
    },
    scope: {
      type: 'string',
      required: true,
    },
    kind: {
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
    status: {
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
        return value;
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
        return value;
      },
    },
    other: {
      type: 'string',
      required: false,
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
      sk: { field: 'gsi1sk', composite: ['startTime'] },
    },
    byScope: {
      index: 'gsi2',
      pk: { field: 'gsi2pk', composite: ['entity', 'scope'] },
      sk: { field: 'gsi2sk', composite: ['startTime'] },
    },
    byParentSpanAndName: {
      index: 'gsi3',
      pk: { field: 'gsi3pk', composite: ['entity', 'parentSpanId', 'name'] },
      sk: { field: 'gsi3sk', composite: ['createdAt'] },
    },
    byParentSpanAndScope: {
      index: 'gsi4',
      pk: { field: 'gsi4pk', composite: ['entity', 'parentSpanId', 'scope'] },
      sk: { field: 'gsi4sk', composite: ['createdAt'] },
    },
    byTraceId: {
      index: 'gsi5',
      pk: { field: 'gsi5pk', composite: ['entity', 'traceId'] },
      sk: { field: 'gsi5sk', composite: ['createdAt'] },
    },
  },
});

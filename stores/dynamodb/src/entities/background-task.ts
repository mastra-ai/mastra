import { Entity } from 'electrodb';
import { baseAttributes } from './utils';

/**
 * JSON field helpers — DynamoDB stores JSON as stringified strings,
 * and parses them on get.
 */
const jsonSetGet = {
  set: (value?: unknown) => {
    if (value == null) return value as undefined;
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  },
  get: (value?: string) => {
    if (!value) return value;
    if (typeof value !== 'string') return value;
    try {
      if (value.startsWith('{') || value.startsWith('[')) {
        return JSON.parse(value);
      }
    } catch {
      // fall through
    }
    return value;
  },
};

export const backgroundTaskEntity = new Entity({
  model: {
    entity: 'background_task',
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
    status: {
      type: 'string',
      required: true,
    },
    toolName: {
      type: 'string',
      required: true,
    },
    toolCallId: {
      type: 'string',
      required: true,
    },
    agentId: {
      type: 'string',
      required: true,
    },
    runId: {
      type: 'string',
      required: true,
    },
    threadId: {
      type: 'string',
      required: false,
    },
    resourceId: {
      type: 'string',
      required: false,
    },
    args: {
      type: 'string',
      required: true,
      ...jsonSetGet,
    },
    result: {
      type: 'string',
      required: false,
      ...jsonSetGet,
    },
    error: {
      type: 'string',
      required: false,
      ...jsonSetGet,
    },
    retryCount: {
      type: 'number',
      required: true,
    },
    maxRetries: {
      type: 'number',
      required: true,
    },
    timeoutMs: {
      type: 'number',
      required: true,
    },
    // Separate ISO strings for date columns — use these for GSI sort keys
    startedAtIso: {
      type: 'string',
      required: false,
    },
    completedAtIso: {
      type: 'string',
      required: false,
    },
  },
  indexes: {
    primary: {
      pk: { field: 'pk', composite: ['entity', 'id'] },
      sk: { field: 'sk', composite: ['entity'] },
    },
    byAgent: {
      index: 'gsi1',
      pk: { field: 'gsi1pk', composite: ['entity', 'agentId'] },
      sk: { field: 'gsi1sk', composite: ['createdAt'] },
    },
    byRun: {
      index: 'gsi2',
      pk: { field: 'gsi2pk', composite: ['entity', 'runId'] },
      sk: { field: 'gsi2sk', composite: ['createdAt'] },
    },
    byStatus: {
      index: 'gsi3',
      pk: { field: 'gsi3pk', composite: ['entity', 'status'] },
      sk: { field: 'gsi3sk', composite: ['createdAt'] },
    },
  },
});

import { Entity } from 'electrodb';
import { baseAttributes } from './utils';

export const scoreEntity = new Entity({
  model: {
    entity: 'score',
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
    scorerId: {
      type: 'string',
      required: true,
    },
    traceId: {
      type: 'string',
      required: false,
    },
    runId: {
      type: 'string',
      required: true,
    },
    scorer: {
      type: 'string',
      required: true,
      set: (value?: Record<string, unknown> | string) => {
        if (value && typeof value !== 'string') {
          return JSON.stringify(value);
        }
        return value;
      },
      get: (value?: string) => {
        if (value && typeof value === 'string') {
          try {
            if (value.startsWith('{') || value.startsWith('[')) {
              return JSON.parse(value);
            }
          } catch {
            return value;
          }
        }
        return value;
      },
    },
    extractStepResult: {
      type: 'string',
      required: false,
      set: (value?: Record<string, unknown> | string) => {
        if (value && typeof value !== 'string') {
          return JSON.stringify(value);
        }
        return value;
      },
      get: (value?: string) => {
        if (value && typeof value === 'string') {
          try {
            if (value.startsWith('{') || value.startsWith('[')) {
              return JSON.parse(value);
            }
          } catch {
            return value;
          }
        }
        return value;
      },
    },
    preprocessStepResult: {
      type: 'string',
      required: false,
      set: (value?: Record<string, unknown> | string) => {
        if (value && typeof value !== 'string') {
          return JSON.stringify(value);
        }
        return value;
      },
      get: (value?: string) => {
        if (value && typeof value === 'string') {
          try {
            if (value.startsWith('{') || value.startsWith('[')) {
              return JSON.parse(value);
            }
          } catch {
            return value;
          }
        }
        return value;
      },
    },
    analyzeStepResult: {
      type: 'string',
      required: false,
      set: (value?: Record<string, unknown> | string) => {
        if (value && typeof value !== 'string') {
          return JSON.stringify(value);
        }
        return value;
      },
      get: (value?: string) => {
        if (value && typeof value === 'string') {
          try {
            if (value.startsWith('{') || value.startsWith('[')) {
              return JSON.parse(value);
            }
          } catch {
            return value;
          }
        }
        return value;
      },
    },
    score: {
      type: 'number',
      required: true,
    },
    reason: {
      type: 'string',
      required: false,
    },
    extractPrompt: {
      type: 'string',
      required: false,
    },
    analyzePrompt: {
      type: 'string',
      required: false,
    },

    // Deprecated in favor of generateReasonPrompt
    reasonPrompt: {
      type: 'string',
      required: false,
    },
    generateScorePrompt: {
      type: 'string',
      required: false,
    },
    generateReasonPrompt: {
      type: 'string',
      required: false,
    },
    input: {
      type: 'string',
      required: true,
      set: (value?: Record<string, unknown> | string) => {
        if (value && typeof value !== 'string') {
          return JSON.stringify(value);
        }
        return value;
      },
      get: (value?: string) => {
        if (value && typeof value === 'string') {
          try {
            if (value.startsWith('{') || value.startsWith('[')) {
              return JSON.parse(value);
            }
          } catch {
            return value;
          }
        }
        return value;
      },
    },
    output: {
      type: 'string',
      required: true,
      set: (value?: Record<string, unknown> | string) => {
        if (value && typeof value !== 'string') {
          return JSON.stringify(value);
        }
        return value;
      },
      get: (value?: string) => {
        if (value && typeof value === 'string') {
          try {
            if (value.startsWith('{') || value.startsWith('[')) {
              return JSON.parse(value);
            }
          } catch {
            return value;
          }
        }
        return value;
      },
    },
    additionalContext: {
      type: 'string',
      required: false,
      set: (value?: Record<string, unknown> | string) => {
        if (value && typeof value !== 'string') {
          return JSON.stringify(value);
        }
        return value;
      },
      get: (value?: string) => {
        if (value && typeof value === 'string') {
          try {
            if (value.startsWith('{') || value.startsWith('[')) {
              return JSON.parse(value);
            }
          } catch {
            return value;
          }
        }
        return value;
      },
    },
    runtimeContext: {
      type: 'string',
      required: false,
      set: (value?: Record<string, unknown> | string) => {
        if (value && typeof value !== 'string') {
          return JSON.stringify(value);
        }
        return value;
      },
      get: (value?: string) => {
        if (value && typeof value === 'string') {
          try {
            if (value.startsWith('{') || value.startsWith('[')) {
              return JSON.parse(value);
            }
          } catch {
            return value;
          }
        }
        return value;
      },
    },
    entityType: {
      type: 'string',
      required: false,
    },
    entityData: {
      type: 'string',
      required: false,
      set: (value?: Record<string, unknown> | string) => {
        if (value && typeof value !== 'string') {
          return JSON.stringify(value);
        }
        return value;
      },
      get: (value?: string) => {
        if (value && typeof value === 'string') {
          try {
            if (value.startsWith('{') || value.startsWith('[')) {
              return JSON.parse(value);
            }
          } catch {
            return value;
          }
        }
        return value;
      },
    },
    entityId: {
      type: 'string',
      required: false,
    },
    source: {
      type: 'string',
      required: true,
    },
    resourceId: {
      type: 'string',
      required: false,
    },
    threadId: {
      type: 'string',
      required: false,
    },
  },
  indexes: {
    primary: {
      pk: { field: 'pk', composite: ['entity', 'id'] },
      sk: { field: 'sk', composite: ['entity'] },
    },
    byScorer: {
      index: 'gsi1',
      pk: { field: 'gsi1pk', composite: ['entity', 'scorerId'] },
      sk: { field: 'gsi1sk', composite: ['createdAt'] },
    },
    byRun: {
      index: 'gsi2',
      pk: { field: 'gsi2pk', composite: ['entity', 'runId'] },
      sk: { field: 'gsi2sk', composite: ['createdAt'] },
    },
    byTrace: {
      index: 'gsi3',
      pk: { field: 'gsi3pk', composite: ['entity', 'traceId'] },
      sk: { field: 'gsi3sk', composite: ['createdAt'] },
    },
    byEntityData: {
      index: 'gsi4',
      pk: { field: 'gsi4pk', composite: ['entity', 'entityId'] },
      sk: { field: 'gsi4sk', composite: ['createdAt'] },
    },
    byResource: {
      index: 'gsi5',
      pk: { field: 'gsi5pk', composite: ['entity', 'resourceId'] },
      sk: { field: 'gsi5sk', composite: ['createdAt'] },
    },
    byThread: {
      index: 'gsi6',
      pk: { field: 'gsi6pk', composite: ['entity', 'threadId'] },
      sk: { field: 'gsi6sk', composite: ['createdAt'] },
    },
  },
});

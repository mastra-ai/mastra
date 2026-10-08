import { Entity } from 'electrodb';

/**
 * The current claim on a durable workflow run. `leaseExpiresAt` holds the
 * lease's expiry in epoch milliseconds and is removed when the owner releases
 * the run; `generation` and `ownerId` are kept.
 */
export const workflowRunOwnerEntity = new Entity({
  model: {
    entity: 'workflow_run_owner',
    version: '1',
    service: 'mastra',
  },
  attributes: {
    entity: {
      type: 'string',
      required: true,
    },
    run_id: {
      type: 'string',
      required: true,
    },
    generation: {
      type: 'number',
    },
    ownerId: {
      type: 'string',
    },
    leaseExpiresAt: {
      type: 'number',
    },
  },
  indexes: {
    primary: {
      pk: { field: 'pk', composite: ['entity', 'run_id'] },
      sk: { field: 'sk', composite: ['entity'] },
    },
  },
});

/** The newest fence memory has seen for a run. Fenced memory writes check it. */
export const memoryRunFenceEntity = new Entity({
  model: {
    entity: 'memory_run_fence',
    version: '1',
    service: 'mastra',
  },
  attributes: {
    entity: {
      type: 'string',
      required: true,
    },
    run_id: {
      type: 'string',
      required: true,
    },
    generation: {
      type: 'number',
    },
    ownerId: {
      type: 'string',
    },
  },
  indexes: {
    primary: {
      pk: { field: 'pk', composite: ['entity', 'run_id'] },
      sk: { field: 'sk', composite: ['entity'] },
    },
  },
});

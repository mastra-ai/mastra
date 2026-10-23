import { Entity } from 'electrodb';

/**
 * The current claim on a durable workflow run. `leaseExpiresAt` holds the
 * lease's expiry in epoch milliseconds and is removed when the owner releases
 * the run; `generation` and `ownerId` are kept. `updatedAt` is the epoch
 * milliseconds of the last claim, renewal or release.
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
    updatedAt: {
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

/**
 * The newest fence memory has seen for a run. Fenced memory writes check it.
 * `retiredAt` is set, in epoch milliseconds, once the execution holding the
 * fence settles, and removed when a fence is raised again.
 */
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
    retiredAt: {
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

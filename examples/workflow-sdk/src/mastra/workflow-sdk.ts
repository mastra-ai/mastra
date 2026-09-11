import { init } from '@mastra/workflow';
import { mastraRunner } from '@mastra/workflow/workflows';

/**
 * `init()` returns the same `createWorkflow` / `createStep` builders you get
 * from `@mastra/core/workflows`, except every step executes as a durable
 * Workflow SDK step. Nothing else about authoring a workflow changes.
 */
export const { createWorkflow, createStep } = init({ runner: mastraRunner });

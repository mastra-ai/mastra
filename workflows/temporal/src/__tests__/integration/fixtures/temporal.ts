import { init } from '@mastra/temporal';

export const { createStep, createWorkflow } = init({
  client: undefined as never,
  taskQueue: 'mastra',
});

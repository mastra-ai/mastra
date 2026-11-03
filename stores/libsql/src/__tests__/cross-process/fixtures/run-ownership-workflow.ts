/** Default-engine workflow registered by both replicas in run-ownership.test.ts. */
import { createStep, createWorkflow } from '@mastra/core/workflows';

const emptyObjectSchema = { type: 'object', properties: {}, additionalProperties: false } as const;

export function createOwnedWorkflow(onExecute: (runId: string) => Promise<void>) {
  const step = createStep({
    id: 'side-effect',
    inputSchema: emptyObjectSchema,
    outputSchema: emptyObjectSchema,
    execute: async ({ runId }) => {
      await onExecute(runId);
      return {};
    },
  });
  return createWorkflow({ id: 'run-ownership-wf', inputSchema: emptyObjectSchema, outputSchema: emptyObjectSchema })
    .then(step)
    .commit();
}

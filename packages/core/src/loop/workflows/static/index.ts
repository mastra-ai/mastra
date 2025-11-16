import { z } from 'zod';
import { InternalSpans } from '../../../observability';
import { MastraModelOutput, AISDKV5OutputStream } from '../../../stream';
import { createWorkflow } from '../../../workflows';
import { createMapResultsStep } from './map-results-step';
import { createPrepareMemoryStep } from './prepare-memory-step';
import { createPrepareToolsStep } from './prepare-tools-step';
import { executionWorkflowStateSchema } from './schema';
import { createStreamStep } from './stream-step';

/**
 * Creates a static, reusable execution workflow for agent stream/generate calls.
 *
 * This workflow is designed to be created once and reused across multiple agent executions.
 * Request-specific data is passed via the workflow's initialState parameter, not via closures,
 * which prevents memory leaks from recreating the workflow on each request.
 *
 * Workflow structure:
 * 1. prepareToolsStep + prepareMemoryStep (parallel)
 * 2. mapResultsStep (combines outputs from step 1)
 * 3. streamStep (executes LLM call)
 *
 * @returns A committed workflow that can be used to create runs
 */
export function createStaticExecutionWorkflow() {
  // Create steps without any request-specific data
  // They will access data from the workflow state parameter
  const prepareToolsStep = createPrepareToolsStep();
  const prepareMemoryStep = createPrepareMemoryStep();
  const streamStep = createStreamStep();
  const mapResultsStep = createMapResultsStep();

  return createWorkflow({
    id: 'execution-workflow',
    stateSchema: executionWorkflowStateSchema,
    inputSchema: z.object({}), // Empty input - all data comes from state
    outputSchema: z.union([z.instanceof(MastraModelOutput), z.instanceof(AISDKV5OutputStream)]),
    steps: [prepareToolsStep, prepareMemoryStep, streamStep, mapResultsStep],
    options: {
      tracingPolicy: {
        internal: InternalSpans.WORKFLOW,
      },
    },
  })
    .parallel([prepareToolsStep, prepareMemoryStep])
    .then(mapResultsStep)
    .then(streamStep)
    .commit();
}

/**
 * Export the state schema for use in Agent
 */
export { executionWorkflowStateSchema } from './schema';
export type ExecutionWorkflowState = z.infer<typeof executionWorkflowStateSchema>;

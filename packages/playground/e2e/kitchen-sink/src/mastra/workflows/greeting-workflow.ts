import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const buildGreetingStep = createStep({
  id: 'build-greeting',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ inputData }) => ({ message: `Hello, ${inputData.name}!` }),
});

/**
 * Registered under the key `greetingWorkflow` while its intrinsic id is
 * `greeting-workflow`. The divergence is deliberate: nested stored workflows
 * must resolve through either identity, and runtime keys nested results by the
 * intrinsic id.
 */
export const greetingWorkflow = createWorkflow({
  id: 'greeting-workflow',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ message: z.string() }),
})
  .then(buildGreetingStep)
  .commit();

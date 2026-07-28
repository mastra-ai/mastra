import { z } from 'zod';
import { createStep, createWorkflow } from '../workflow-sdk';

const counterSchema = z.object({
  value: z.number(),
});

const incrementStep = createStep({
  id: 'increment',
  description: 'Adds one to the counter',
  inputSchema: counterSchema,
  outputSchema: counterSchema,
  execute: async ({ inputData }) => {
    const value = inputData.value + 1;
    console.log(`[increment] ${inputData.value} -> ${value}`);
    return { value };
  },
});

const reportStep = createStep({
  id: 'report',
  description: 'Reports the final counter value',
  inputSchema: counterSchema,
  outputSchema: counterSchema,
  execute: async ({ inputData }) => {
    console.log(`[report] counter finished at ${inputData.value}`);
    return inputData;
  },
});

/**
 * Loops until the counter reaches 10, then sleeps before reporting.
 *
 * Each iteration is a separate durable step: the run survives a restart
 * mid-loop and picks up from the last completed iteration. The `.sleep()`
 * suspends the run without holding a function alive — the Workflow SDK wakes it
 * back up when the delay elapses.
 */
export const incrementWorkflow = createWorkflow({
  id: 'increment-workflow',
  inputSchema: counterSchema,
  outputSchema: counterSchema,
})
  .dountil(incrementStep, async ({ inputData }) => inputData.value >= 10)
  .sleep(5000)
  .then(reportStep)
  .commit();

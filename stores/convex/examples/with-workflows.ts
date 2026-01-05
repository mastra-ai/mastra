/**
 * Mastra Workflows with Convex Storage
 *
 * Workflow state is automatically persisted to Convex.
 */

import { Mastra } from '@mastra/core';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { ConvexStore } from '@mastra/convex';
import { z } from 'zod';

// Storage
const storage = new ConvexStore({
  id: 'convex',
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_AUTH_TOKEN!,
});

// Define workflow steps
const fetchData = createStep({
  id: 'fetch-data',
  inputSchema: z.object({ url: z.string() }),
  outputSchema: z.object({ data: z.any() }),
  execute: async ({ inputData }) => {
    const res = await fetch(inputData.url);
    return { data: await res.json() };
  },
});

const processData = createStep({
  id: 'process-data',
  inputSchema: z.object({ data: z.any() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => {
    return { result: JSON.stringify(inputData.data) };
  },
});

// Create workflow
const dataWorkflow = createWorkflow({
  id: 'data-pipeline',
  inputSchema: z.object({ url: z.string() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(fetchData)
  .then(processData);

dataWorkflow.commit();

// Initialize Mastra
const mastra = new Mastra({
  storage,
  workflows: {
    'data-pipeline': dataWorkflow,
  },
});

// Run workflow - state persisted to Convex
async function main() {
  const workflow = mastra.getWorkflow('data-pipeline');
  const run = workflow.createRun();

  const result = await run.start({
    inputData: { url: 'https://api.example.com/data' },
  });

  console.log('Workflow result:', result);

  // Workflow state is now in Convex and can be:
  // - Resumed after server restart
  // - Queried for status
  // - Used for time-travel debugging
}

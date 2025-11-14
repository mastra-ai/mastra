import { randomUUID } from 'node:crypto';
import { mastra } from './mastra';

const workflow = mastra.getWorkflow('myWorkflow');

async function main() {
  const resourceId = randomUUID();

  const result = await workflow.createRun({
    resourceId: resourceId,
  });

  console.log('result.runId', result.runId);

  await result.start({
    inputData: {
      ingredient: 'pasta',
    },
  });

  const runById = await workflow.getWorkflowRunById(result.runId);
  console.log('runById', runById);

  if (runById?.resourceId !== resourceId) {
    throw new Error('Resource ID mismatch');
  } else {
    console.log('✅ Resource ID matches expected value', resourceId);
  }
}

main();

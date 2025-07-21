import { mastra } from './mastra';

const workflow = mastra.getWorkflow('myWorkflow');

async function main() {
  const result = await workflow.createRunAsync({
    resourceId: '123',
  });

  console.log(result);

  const run = await result.start({
    inputData: {
      ingredient: 'pasta',
    },
  });

  console.log(run);

  const runs = await workflow.getWorkflowRuns({
    resourceId: '123',
  });

  console.log(runs);
}

main();

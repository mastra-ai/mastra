import { mastra } from './mastra';

async function main() {
  const run = await mastra.getWorkflow('myWorkflow').createRunAsync();
  try {
    const res = await run.start({
      inputData: {
        inputValue: 12,
      },
    });

    if (res.status === 'success') {
      console.log(res.result);
    } else if (res.status === 'failed') {
      console.log('Workflow failed:', res.error);
    } else {
      console.log('Workflow suspended:', res.suspended);
    }
  } catch (e) {
    console.log(e);
  }
}

main();

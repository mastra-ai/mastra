import { mastra } from './mastra';

async function main() {
  const myWorkflow = mastra.getWorkflow('myWorkflow');
  const run = await myWorkflow.createRun();
  try {
    const res = await run.start({
      inputData: {
        inputValue: 30,
      },
    });
    console.log(res.results);
  } catch (e) {
    console.log(e);
  }
}

main();

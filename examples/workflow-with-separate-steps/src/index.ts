import { mastra } from './mastra';

async function main() {
  const myWorkflow = mastra.getWorkflow('myWorkflow');
  const { start } = myWorkflow.createRun();
  try {
    const res = await start({
      triggerData: {
        inputValue: 30,
      },
    });
    console.log(res.results);
  } catch (e) {
    console.log(e);
  }
}

main();

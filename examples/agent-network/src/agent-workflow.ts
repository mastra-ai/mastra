import { mastra } from './mastra';

async function main() {
  const wflow = mastra.getWorkflow('agentWorkflow');

  const { runId, start } = wflow.createRun();

  const result = await start({
    triggerData: {
      prompt: 'What is the capital of France?',
    },
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);

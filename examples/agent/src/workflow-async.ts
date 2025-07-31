import { MastraClient } from '@mastra/client-js';
import { MastraError } from '@mastra/core/error';

const client = new MastraClient({
  baseUrl: 'http://localhost:4111',
});

async function main() {
  const workflow = client.getWorkflow('myWorkflow');

  const run = await workflow.createRun();

  const result = await workflow.startAsync({
    runId: run.runId,
    inputData: {
      ingredient: 'John',
    },
  });

  if (result.status === 'failed') {
    console.log(result.error.toJSON());
  }
}

main();

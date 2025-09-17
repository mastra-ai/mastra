import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function message() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('What would you like to do today?\n'));

  const run = await mastra.getWorkflow('message').createRunAsync();
  const { runId, start } = run;

  console.log(runId);

  console.log(
    await start({
      triggerData: {
        resourceId: 'f8b5c3a1-d6e7-4f9c-b2a3-1d8e4c7f9b5a',
        threadId: '2d9e8c7f-6b5a-4d3c-8f1e-9b7d5c3a2e8h',
      },
    }),
  );
}

import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function changelog() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Lets make the changelog..\n'));

  const workflow = mastra.getWorkflow('changelog');

  const run = await workflow.createRunAsync();
  const { start } = run;

  const res = await start({
    triggerData: {
      channelId: process.env.CHANNEL_ID!,
    },
  });

  console.log(res);

  process.exit(0);
}

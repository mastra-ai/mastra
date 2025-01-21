import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function linkChecker() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Lets check the links...\n'));

  const workflow = mastra.getWorkflow('linkChecker');

  const { start } = workflow.createRun();
  const res = await start({
    triggerData: {
      channelId: process.env.LINK_CHECKER_CHANNEL_ID!,
      targetUrl: process.env.TARGET_URL!,
    },
  });

  console.log(res);

  process.exit(0);
}

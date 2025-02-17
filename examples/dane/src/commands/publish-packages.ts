import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function publishPackages() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Let me publish your packages..\n'));

  const workflow = mastra.getWorkflow('packagePublisher');

  const { start } = workflow.createRun();

  const result = await start();

  console.log(result);

  process.exit(0);
}

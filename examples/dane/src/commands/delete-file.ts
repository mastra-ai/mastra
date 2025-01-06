import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function deleteFile() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Let me delete your file..\n'));

  const workflow = mastra.getWorkflow('deleteFile');

  const result = await workflow.execute();

  console.log(result);
}

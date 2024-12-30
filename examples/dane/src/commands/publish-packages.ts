import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function publishPackages() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Let me publish your packages..\n'));

  const agent = mastra.getAgent('danePackagePublisher');
  const result = await agent.generate(`
        Can you tell me which packages within the packages and integrations directory need to be published to npm?
        `);

  console.log(``);
  console.log(chalk.green(result.text));
}

// import inquirer from 'inquirer';
import chalk from 'chalk';

import { mastra } from './mastra';

async function main() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('What would you like to do today?\n'));
  console.log(await mastra.getWorkflow('message').execute({}));
}

main();

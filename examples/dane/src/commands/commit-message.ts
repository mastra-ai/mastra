import chalk from 'chalk';
import { execSync } from 'child_process';

import { mastra } from '../mastra/index.js';

export async function commitMessageCommand() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Let me generate a commit message for you..\n'));

  try {
    const workflow = mastra.getWorkflow('commitMessage');
    if (!workflow) {
      console.error(chalk.red('Commit message workflow not found. Make sure it is properly set up.'));
      process.exit(1);
    }

    // Get the current path
    const currentPath = execSync('pwd', { encoding: 'utf-8' }).trim();

    const run = await workflow.createRunAsync();
    const { start } = run;

    const result = await start({
      triggerData: {
        repoPath: currentPath,
      },
    });

    const errorMessage = Object.values(result.results).find(result => result.status === 'failed')?.error;

    if (result.results?.commit?.status !== 'success') {
      console.error(chalk.red(`\n${errorMessage}`));
      return;
    }

    console.log(chalk.green('\nCommit message generated and committed successfully'));
  } catch (error: any) {
    console.error(chalk.red('Error:', error?.message || 'An unknown error occurred'));
    process.exit(1);
  }
}

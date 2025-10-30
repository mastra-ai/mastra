import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function newContributorMessage() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Let me create a welcoming message..\n'));

  try {
    const workflow = mastra.getWorkflow('githubFirstContributorMessage');
    if (!workflow) {
      console.error(chalk.red('First contributor workflow not found. Make sure it is properly set up.'));
      process.exit(1);
    }

    const run = await workflow.createRunAsync();
    const { start } = run;

    const result = await start({
      triggerData: {
        pr_number: parseInt(process.env.PR_NUMBER!, 10),
        owner: process.env.OWNER!,
        repo: normalizeRepo(process.env.REPO!),
      },
    });

    console.log(result);
    const errorMessage = Object.values(result.results).find(result => result.status === 'failed')?.error;

    if (result.results?.commit?.status !== 'success') {
      console.error(chalk.red(`\n${errorMessage}`));
      return;
    }

    console.log(chalk.green('\New contributor message generated and published successfully'));
  } catch (error: any) {
    console.error(chalk.red('Error:', error?.message || 'An unknown error occurred'));
    process.exit(1);
  }
}

/**
 * Extracts the repo name from owner/repo format provided by github
 * @param repo - The repo name to normalize
 * @returns The normalized repo name
 */
function normalizeRepo(repo: string): string {
  if (repo.includes('/')) {
    return repo.split('/')[1] || repo;
  }

  return repo;
}

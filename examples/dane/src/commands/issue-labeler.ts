import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function issueLabelerCommand() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Let me label this for you..\n'));

  const run = await mastra.getWorkflow('githubIssueLabeler').createRunAsync();
  const { start } = run;

  const issueNumber = parseInt(process.env.ISSUE_NUMBER!, 10);
  const result = await start({
    triggerData: {
      issue_number: issueNumber,
      owner: process.env.OWNER!,
      repo: normalizeRepo(process.env.REPO!),
    },
  });

  if (result.results?.labelIssue?.status === 'failed') {
    console.error(chalk.red(`Error applying labels for issue: ${issueNumber}`));
    console.error({ error: result.results?.labelIssue?.error });
    return;
  }

  if (result.results?.labelIssue?.status !== 'success') {
    console.error(chalk.red(`Failed to apply labels for issue: ${issueNumber}`));
    return;
  }

  console.log(
    chalk.green(
      `Issue: ${issueNumber} has been labeled with: ${result.results?.labelIssue?.output?.labels.join(', ')}`,
    ),
  );
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

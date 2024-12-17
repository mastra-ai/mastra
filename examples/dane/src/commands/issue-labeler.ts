import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function issueLabelerCommand() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Let me label this for you..\n'));
  const result = await mastra.getWorkflow('githubIssueLabeler').execute({
    triggerData: {
      issue_number: parseInt(process.env.ISSUE_NUMBER!, 10),
      owner: process.env.OWNER!,
      repo: process.env.REPO!,
    },
  });

  if (result.results?.labelIssue?.status !== 'success') {
    console.error(chalk.red(`Failed to apply labels for issue: ${result.triggerData?.issue_number}`));
    return;
  }

  console.log(
    chalk.green(
      `Issue: ${result.triggerData?.issue_number} has been labeled with: ${result.results?.labelIssue?.payload?.labels.join(', ')}`,
    ),
  );
}

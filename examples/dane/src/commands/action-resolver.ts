import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function actionResolverCommand() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Analyzing failed GitHub Actions...\n'));

  const { start } = mastra.getWorkflow('githubActionResolver').createRun();

  const result = await start({
    triggerData: {
      repo: normalizeRepo(process.env.REPO!),
      owner: process.env.OWNER!,
      pull_number: parseInt(process.env.PULL_NUMBER!, 10),
    },
  });

  let failedActionsCount = 0;

  console.log('result=', JSON.stringify(result, null, 2));

  if (result.results?.getFailedActions?.status === 'failed') {
    console.error(chalk.red('Error getting failed actions'));
    console.error({ error: result.results?.getFailedActions?.error });
    return;
  }

  if (result.results?.getFailedActions?.status === 'success') {
    failedActionsCount = result.results?.getFailedActions?.payload?.count ?? 0;
    if (failedActionsCount === 0) {
      console.log(chalk.green('No failed actions found!'));

      if (result.results?.noFailedActions?.status === 'failed') {
        console.error(chalk.red('Error posting no failed actions'));
        console.error({ error: result.results?.noFailedActions?.error });
        return;
      }

      process.exit(0);
    }
  }

  if (result.results?.getActionLogs?.status === 'failed') {
    console.error(chalk.red('Error getting action logs'));
    console.error({ error: result.results?.getActionLogs?.error });
    return;
  }

  if (result.results?.getSolutions?.status === 'failed') {
    console.error(chalk.red('Error getting solutions'));
    console.error({ error: result.results?.getSolutions?.error });
    return;
  }

  if (result.results?.postSolutions?.status === 'failed') {
    console.error(chalk.red('Error posting solutions'));
    console.error({ error: result.results?.postSolutions?.error });
    return;
  }

  console.log(
    chalk.green(
      `Successfully analyzed ${failedActionsCount} failed action${
        failedActionsCount === 1 ? '' : 's'
      } and posted solutions to PR #${result.triggerData?.pull_number}`,
    ),
  );

  process.exit(0);
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

import childProcess from 'node:child_process';
import * as clack from '@clack/prompts';
import { Octokit } from '@octokit/rest';
import { defineCommand } from 'citty';
import { getBotToken } from './get-bot-token.js';

const repo = 'mastra';
const owner = 'mastra-ai';
const baseBranch = '0.x';

async function backport({
  pull_number,
  continue: continueAfterCherryPick,
  octokit,
}: {
  pull_number: number;
  continue: boolean;
  octokit: Octokit;
}) {
  const prDetails = await octokit.pulls.get({
    owner,
    repo,
    pull_number,
  });

  const branch = prDetails.data.head.ref;

  if (!prDetails.data.merged_at) {
    throw new Error(`PR ${pull_number} is not merged yet.`);
  }

  const commitSha = prDetails.data.merge_commit_sha;
  if (!commitSha) {
    throw new Error(`PR ${pull_number} does not have a merge commit sha.`);
  }

  const commitMeta = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: commitSha,
  });

  const commitMessage = commitMeta.data.message.split('\n')[0];
  clack.log.info(`Commit message: ${commitMessage}`);

  const normalizedBranch = branch.replaceAll('/', '-');
  const backportBranchName = `backport/${normalizedBranch}-${pull_number}`;

  clack.log.info(`Backport branch name: ${backportBranchName}`);

  childProcess.execSync(`git fetch origin ${baseBranch}`, {
    stdio: 'inherit',
  });

  try {
    childProcess.execSync(`git switch "${baseBranch}"`, {
      stdio: 'inherit',
    });
    childProcess.execSync(`git pull origin "${baseBranch}"`, {
      stdio: 'inherit',
    });
  } catch {}

  if (!continueAfterCherryPick) {
    try {
      childProcess.execSync(`git branch -D "${backportBranchName}"`, {
        stdio: 'inherit',
      });
    } catch {}
  }

  if (continueAfterCherryPick) {
    childProcess.execSync(`git switch "${backportBranchName}"`, {
      stdio: 'inherit',
    });

    try {
      childProcess.execSync(`git cherry-pick --continue`, {
        stdio: 'inherit',
      });
    } catch {}
  } else {
    childProcess.execSync(`git checkout -b "${backportBranchName}"`, {
      stdio: 'inherit',
    });

    try {
      childProcess.execSync(`git cherry-pick -x ${commitSha}`, {
        stdio: 'inherit',
      });
    } catch (err) {
      clack.log.error('Cherry-pick failed');

      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pull_number,
        body: `Failed to backport the PR. Please manually create a backport PR.
cc @${prDetails.data.user?.login}
      `,
      });

      return;
    }
  }

  childProcess.execSync(`git push origin +${backportBranchName} --force`, {
    stdio: 'inherit',
  });

  const pr = await octokit.pulls.create({
    owner,
    repo,
    title: commitMessage,
    head: backportBranchName,
    base: baseBranch,
    body: `Backporting #${pull_number} to the ${baseBranch} branch\n\n(cherry picked from commit ${commitSha})`,
  });

  try {
    await octokit.issues.removeLabel({
      owner,
      repo,
      issue_number: pull_number,
      name: 'cherry',
    });
  } catch {
    // ignore
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pull_number,
    body: `Created backport PR: ${pr.data.html_url}`,
  });

  clack.log.success(`Created backport PR: ${pr.data.html_url}`);
}

export const backportCommand = defineCommand({
  meta: {
    name: 'backport',
    description: 'Backport merged PR into a branch & create a cherry-pick PR',
  },
  args: {
    pr: {
      type: 'positional',
      description: 'The PR number to backport',
      required: true,
    },
    continue: {
      type: 'boolean',
      description: 'Continue after cherry-pick',
      required: false,
      default: false,
    },
  },
  async run({ args }) {
    clack.intro('Backport PR');

    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
    if (!privateKey) {
      clack.log.error('GITHUB_APP_PRIVATE_KEY environment variable is required');
      clack.outro('Failed');
      process.exit(1);
    }

    const spinner = clack.spinner();
    spinner.start('Fetching GitHub token...');

    let githubToken: string;
    try {
      githubToken = await getBotToken(privateKey);
      spinner.stop('GitHub token fetched');
    } catch (err) {
      spinner.stop('Failed to fetch GitHub token');
      clack.log.error(err instanceof Error ? err.message : String(err));
      clack.outro('Failed');
      process.exit(1);
    }

    const octokit = new Octokit({
      auth: `token ${githubToken}`,
    });

    clack.log.warn('If this script fails, finish the rest manually.');

    const { pr, continue: continueAfterCherryPick } = args;

    try {
      await backport({
        pull_number: Number(pr),
        continue: continueAfterCherryPick,
        octokit,
      });
      clack.outro('Backport completed');
    } catch (err) {
      clack.log.error(err instanceof Error ? err.message : String(err));
      clack.outro('Backport failed');
      process.exit(1);
    }
  },
});

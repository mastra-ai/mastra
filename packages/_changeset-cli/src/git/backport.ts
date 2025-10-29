/* eslint-disable no-console */
import 'dotenv/config';
import childProcess from 'child_process';
import { Octokit } from '@octokit/rest';
import { defineCommand, runMain } from 'citty';

if (!process.env.GITHUB_TOKEN) {
  throw new Error(`GITHUB_TOKEN environment variable must be set.`);
}

const repo = 'mastra';
const owner = 'mastra-ai';
const baseBranch = '0.x';

const octokit = new Octokit({
  auth: `token ${process.env.GITHUB_TOKEN}`,
});

/**
 * Get the details of the PR, create a new branch, cherry-pick the commit, push the branch, and create a PR.
 */
async function github({ pull_number, continue: continueAfterCherryPick }: { pull_number: number; continue: boolean }) {
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

  // Get the first line of the commit
  const commitMessage = commitMeta.data.message.split('\n')[0];
  console.log(`Commit message: ${commitMessage}`);

  const normalizedBranch = branch.replaceAll('/', '-');
  const backportBranchName = `backport/${normalizedBranch}-${pull_number}`;

  console.log(`Backport branch name: ${backportBranchName}`);

  childProcess.execSync(`git fetch origin ${baseBranch}`, {
    stdio: `inherit`,
  });

  try {
    childProcess.execSync(`git switch "${baseBranch}"`, {
      stdio: `inherit`,
    });
  } catch {}

  if (!continueAfterCherryPick) {
    try {
      childProcess.execSync(`git branch -D "${backportBranchName}"`, {
        stdio: `inherit`,
      });
    } catch {}
  }

  if (continueAfterCherryPick) {
    childProcess.execSync(`git switch "${backportBranchName}"`, {
      stdio: `inherit`,
    });

    try {
      childProcess.execSync(`git cherry-pick --continue`, {
        stdio: `inherit`,
      });
    } catch {}
  } else {
    childProcess.execSync(`git checkout -b "${backportBranchName}"`, {
      stdio: `inherit`,
    });

    try {
      childProcess.execSync(`git cherry-pick -x ${commitSha}`, {
        stdio: `inherit`,
      });
    } catch (err) {
      console.error('[ERROR]: cherry-pick failed', err);

      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pull_number,
        body: `Failed to backport the PR. Please manually create a backport PR.
cc @${prDetails.data.user.login}
      `,
      });

      return;
    }
  }

  childProcess.execSync(`git push origin +${backportBranchName} --force`, {
    stdio: `inherit`,
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
      name: `cherry`,
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
}

/**
 * @example node backport.mjs <branch> <pr>
 * @example node backport.mjs v4 1234
 */
const main = defineCommand({
  meta: {
    name: 'backport',
    version: '1.0.0',
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
      description: 'continue after cherry-pick',
      required: false,
      default: false,
    },
  },
  setup() {
    console.log('Starting backport script. If this script fails, finish the rest manually.');
  },
  async run({ args }) {
    const { pr, continue: continueAfterCherryPick } = args;
    try {
      await github({ pull_number: Number(pr), continue: continueAfterCherryPick });
    } catch (err) {
      console.error(err);
      process.exit(1);
    } finally {
      console.log('Backport script completed.');
    }
  },
});

void runMain(main);

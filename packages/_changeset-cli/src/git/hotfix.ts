/* eslint-disable no-console */
import 'dotenv/config';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import { Octokit } from '@octokit/rest';
import { defineCommand, runMain } from 'citty';

if (!process.env.GITHUB_TOKEN) {
  throw new Error(`GITHUB_TOKEN environment variable must be set.`);
}

const owner = 'mastra-ai';
const repo = 'mastra';
const baseBranch = 'main';
const defaultHotfixBranch = 'hotfix/current';
const hotfixCommitMessage = 'chore: hotfix version packages';
const hotfixPrTitle = 'chore: hotfix release';

const octokit = new Octokit({
  auth: `token ${process.env.GITHUB_TOKEN}`,
});

type HotfixPullRequest = {
  number: number;
  mergeCommitSha: string;
  title: string;
  url: string;
};

function run(
  command: string,
  args: string[],
  options?: { stdio?: 'inherit' | 'pipe'; env?: NodeJS.ProcessEnv },
): string {
  return childProcess.execFileSync(command, args, {
    encoding: 'utf-8',
    stdio: options?.stdio === 'inherit' ? 'inherit' : 'pipe',
    env: options?.env,
  });
}

function tryRun(command: string, args: string[]): { success: boolean; output: string } {
  try {
    return {
      success: true,
      output: run(command, args),
    };
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      return {
        success: false,
        output: String(error.stdout ?? ''),
      };
    }

    return {
      success: false,
      output: '',
    };
  }
}

function setGithubOutput(name: string, value: string) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function normalizePrNumbers(prNumbers: string): number[] {
  const normalized = prNumbers
    .split(/[\s,]+/)
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => Number.parseInt(value, 10));

  if (normalized.length === 0 || normalized.some(value => Number.isNaN(value))) {
    throw new Error(`Please provide one or more valid pull request numbers.`);
  }

  return Array.from(new Set(normalized));
}

function remoteBranchExists(branch: string): boolean {
  const result = tryRun('git', ['ls-remote', '--heads', 'origin', branch]);
  return result.success && result.output.trim().length > 0;
}

function getLatestTag(): { name: string; commitSha: string } {
  const tags = run('git', ['for-each-ref', '--sort=-creatordate', '--format=%(refname:short)', 'refs/tags'])
    .split('\n')
    .map(tag => tag.trim())
    .filter(Boolean);

  const latestTag = tags[0];

  if (!latestTag) {
    throw new Error(`No release tags found. Cannot determine hotfix base.`);
  }

  const commitSha = run('git', ['rev-list', '-n', '1', latestTag]).trim();

  if (!commitSha) {
    throw new Error(`Unable to resolve commit for tag ${latestTag}.`);
  }

  return { name: latestTag, commitSha };
}

function checkoutHotfixBranch(branch: string, latestTagCommitSha: string) {
  run('git', ['fetch', 'origin', baseBranch, '--tags'], { stdio: 'inherit' });

  if (remoteBranchExists(branch)) {
    run('git', ['fetch', 'origin', branch], { stdio: 'inherit' });
    run('git', ['checkout', '-B', branch, `origin/${branch}`], { stdio: 'inherit' });
    return;
  }

  run('git', ['checkout', '-B', branch, latestTagCommitSha], { stdio: 'inherit' });
}

async function getMergedPullRequest(prNumber: number): Promise<HotfixPullRequest> {
  const prDetails = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  if (!prDetails.data.merged_at) {
    throw new Error(`PR #${prNumber} is not merged.`);
  }

  if (!prDetails.data.merge_commit_sha) {
    throw new Error(`PR #${prNumber} does not have a merge commit SHA.`);
  }

  return {
    number: prNumber,
    mergeCommitSha: prDetails.data.merge_commit_sha,
    title: prDetails.data.title,
    url: prDetails.data.html_url,
  };
}

function hasCherryPickedMergeCommit(mergeCommitSha: string): boolean {
  const result = tryRun('git', ['log', '--format=%B', '--grep', mergeCommitSha, 'HEAD']);
  return result.success && result.output.includes(mergeCommitSha);
}

function cherryPickCommit(mergeCommitSha: string) {
  const commitWithParents = run('git', ['rev-list', '--parents', '-n', '1', mergeCommitSha]).trim().split(/\s+/);
  const parentCount = Math.max(commitWithParents.length - 1, 0);
  const args = ['cherry-pick'];

  if (parentCount > 1) {
    args.push('-m', '1');
  }

  args.push('-x', mergeCommitSha);

  run('git', args, { stdio: 'inherit' });
}

function commitVersionChanges(): boolean {
  run('pnpm', ['changeset-cli', 'version'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      HUSKY: '0',
    },
  });

  const status = run('git', ['status', '--porcelain']).trim();
  if (!status) {
    return false;
  }

  run('git', ['add', '-A'], { stdio: 'inherit' });
  run('git', ['commit', '-m', hotfixCommitMessage, '--no-verify'], { stdio: 'inherit' });

  return true;
}

async function createOrUpdateHotfixPr(branch: string, pullRequests: HotfixPullRequest[]) {
  const body = ['## Hotfix source PRs', '', ...pullRequests.map(pr => `- #${pr.number} - ${pr.title}`)].join('\n');

  const existingPullRequests = await octokit.pulls.list({
    owner,
    repo,
    state: 'open',
    head: `${owner}:${branch}`,
    base: baseBranch,
    per_page: 100,
  });

  const existingPullRequest = existingPullRequests.data[0];

  if (existingPullRequest) {
    const updatedPullRequest = await octokit.pulls.update({
      owner,
      repo,
      pull_number: existingPullRequest.number,
      title: hotfixPrTitle,
      body,
    });

    return updatedPullRequest.data;
  }

  const createdPullRequest = await octokit.pulls.create({
    owner,
    repo,
    head: branch,
    base: baseBranch,
    title: hotfixPrTitle,
    body,
  });

  return createdPullRequest.data;
}

async function commentOnSourcePullRequests(pullRequests: HotfixPullRequest[], branch: string, hotfixPrUrl: string) {
  const body = `Added to hotfix branch \`${branch}\` and tracking PR ${hotfixPrUrl}`;

  await Promise.all(
    pullRequests.map(pr =>
      octokit.issues.createComment({
        owner,
        repo,
        issue_number: pr.number,
        body,
      }),
    ),
  );
}

async function hotfix({ prNumbers, branch }: { prNumbers: number[]; branch: string }) {
  const latestTag = getLatestTag();
  console.log(`Using latest release tag ${latestTag.name} (${latestTag.commitSha}) as hotfix base.`);

  checkoutHotfixBranch(branch, latestTag.commitSha);

  const mergedPullRequests = await Promise.all(prNumbers.map(prNumber => getMergedPullRequest(prNumber)));
  const newlyCherryPickedPullRequests: HotfixPullRequest[] = [];

  for (const pullRequest of mergedPullRequests) {
    if (hasCherryPickedMergeCommit(pullRequest.mergeCommitSha)) {
      console.log(`Skipping PR #${pullRequest.number}; merge commit already exists on ${branch}.`);
      continue;
    }

    try {
      cherryPickCommit(pullRequest.mergeCommitSha);
      newlyCherryPickedPullRequests.push(pullRequest);
    } catch (error) {
      tryRun('git', ['cherry-pick', '--abort']);

      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: pullRequest.number,
        body: `Failed to add this PR to hotfix branch \`${branch}\`. Please resolve the cherry-pick manually.`,
      });

      throw error;
    }
  }

  const createdVersionCommit = commitVersionChanges();

  const hasBranchChanges = tryRun('git', ['rev-parse', '--verify', `origin/${branch}`]).success
    ? run('git', ['rev-list', '--left-right', '--count', `origin/${branch}...HEAD`]).trim() !== '0\t0'
    : run('git', ['rev-list', '--count', 'HEAD', `^${latestTag.commitSha}`]).trim() !== '0';

  if (!hasBranchChanges && !createdVersionCommit) {
    console.log(`No new hotfix changes to push for ${branch}.`);
  } else {
    run('git', ['push', '--set-upstream', 'origin', branch], { stdio: 'inherit' });
  }

  const hotfixPullRequest = await createOrUpdateHotfixPr(branch, mergedPullRequests);
  await commentOnSourcePullRequests(mergedPullRequests, branch, hotfixPullRequest.html_url);

  console.log(`Hotfix branch: ${branch}`);
  console.log(`Hotfix PR: ${hotfixPullRequest.html_url}`);
  setGithubOutput('hotfix_branch', branch);
  setGithubOutput('hotfix_pr_url', hotfixPullRequest.html_url);
}

const main = defineCommand({
  meta: {
    name: 'hotfix',
    version: '1.0.0',
    description: 'Create or update a rolling hotfix branch from merged pull requests.',
  },
  args: {
    prs: {
      type: 'positional',
      description: 'Comma or whitespace separated pull request numbers',
      required: true,
    },
    branch: {
      type: 'string',
      description: 'Hotfix branch name',
      required: false,
      default: defaultHotfixBranch,
    },
  },
  setup() {
    console.log('Starting hotfix script.');
  },
  async run({ args }) {
    try {
      await hotfix({
        prNumbers: normalizePrNumbers(String(args.prs)),
        branch: String(args.branch || defaultHotfixBranch),
      });
    } catch (error) {
      console.error(error);
      process.exit(1);
    } finally {
      console.log('Hotfix script completed.');
    }
  },
});

void runMain(main);

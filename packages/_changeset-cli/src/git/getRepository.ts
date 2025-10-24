import { execSync } from 'child_process';

export function getPullRequestNumber(commit: string) {
  const message = execSync(`git log -1 --pretty=%B ${commit}`, { encoding: 'utf-8' });
  const pullRequestNumber = message.trim().match(/#(\d+)/)?.[1];

  return pullRequestNumber;
}
export function getPullRequestUrl(prNumber: string) {
  return `https://github.com/mastra-ai/mastra/pull/${prNumber}`;
}
export function getCommitUrl(hash: string) {
  return `https://github.com/mastra-ai/mastra/commit/${hash}`;
}

import { appendFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WorkspaceIndex } from './src/blast-radius.ts';
import { octokitPullRequestApi } from './src/github.ts';
import { DEFAULT_BASE_URL, DEFAULT_MODEL } from './src/model.ts';
import { run } from './src/run.ts';

const prNumber = Number(requireEnv('PR_NUMBER'));
if (!Number.isInteger(prNumber) || prNumber < 1) throw new Error('PR_NUMBER must be a positive integer');

// The base-branch checkout. Package manifests and CODEOWNERS are read from here, never from the PR head.
const repoRoot = resolve(process.env.REPO_ROOT ?? join(import.meta.dirname, '..', '..'));

const result = await run({
  api: octokitPullRequestApi({ token: requireEnv('GITHUB_TOKEN'), owner: requireEnv('OWNER'), repo: requireEnv('REPO'), number: prNumber }),
  index: WorkspaceIndex.load(repoRoot),
  rubric: readFileSync(join(import.meta.dirname, 'rubric.md'), 'utf8'),
  model: {
    apiKey: requireEnv('OPENROUTER_API_KEY'),
    model: process.env.RISK_MODEL || DEFAULT_MODEL,
    baseUrl: process.env.RISK_MODEL_BASE_URL || DEFAULT_BASE_URL,
  },
  botLogin: requireEnv('BOT_LOGIN'),
});

const summary =
  result.status === 'labeled'
    ? `PR #${prNumber} rated \`${result.risk}\` (${result.classification.source}).`
    : result.status === 'unchanged'
      ? `PR #${prNumber} is unchanged since it was rated \`${result.risk}\`; skipped the model call.`
      : result.status === 'skipped'
        ? `PR #${prNumber} skipped: ${result.reason}`
        : `PR #${prNumber} could not be rated: ${result.error}`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## PR risk classifier\n\n${summary}\n`);
if (result.status === 'failed') process.exitCode = 1;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

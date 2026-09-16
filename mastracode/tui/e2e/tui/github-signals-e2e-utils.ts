import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eInProcessAppContext, McE2ePrepareContext } from './types.js';

export const githubMultiPrFixtures = [
  {
    id: 1,
    owner: 'mastra-ai',
    repo: 'mastra',
    number: 17637,
    title: 'feat: add agent tool hooks',
    htmlUrl: 'https://github.com/mastra-ai/mastra/pull/17637',
    updatedAt: '2026-06-06T01:08:18Z',
    contentHash: 'f80eac0f355460e6b73560649bd3b21b67e2f78c66da1e1265a16ddd441a7cad',
    headSha: 'fe097a5ea68b96b0294df099841c060fceb073a4',
    headRef: 'fix/workspace-tool-hooks',
  },
  {
    id: 2,
    owner: 'mastra-ai',
    repo: 'mastra',
    number: 17638,
    title: 'fix: stabilize github signal polling',
    htmlUrl: 'https://github.com/mastra-ai/mastra/pull/17638',
    updatedAt: '2026-06-06T02:08:18Z',
    contentHash: 'fb1b94575605e7d27fdba1db0ff7ef672f3d5a7ec56500c88af36b459a1f1111',
    headSha: 'd6ec39f0ed7328f94e3580fdfeabc113d09f0102',
    headRef: 'fix/github-polling',
  },
] as const;

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function enableGithubSignals(context: McE2ePrepareContext, extraSignals: Record<string, unknown> = {}) {
  const settingsPath = join(context.appDataDir, 'settings.json');
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as { signals?: Record<string, unknown> };
  settings.signals = {
    ...settings.signals,
    experimentalGithubSignals: true,
    ...extraSignals,
  };
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

export function prepareGithubSignalsMultiFixture(context: McE2ePrepareContext) {
  const fixtureDir = join(context.projectDir, '.github-signals-multi-e2e');
  mkdirSync(fixtureDir, { recursive: true });

  const dbPath = join(fixtureDir, 'gitcrawl.db');
  const sql = `
create table repositories (id integer primary key, owner text not null, name text not null, full_name text not null unique, raw_json text not null, updated_at text not null);
create table threads (id integer primary key, repo_id integer not null, github_id text not null, number integer not null, kind text not null, state text not null, title text not null, body text, author_login text, author_type text, html_url text not null, labels_json text not null, assignees_json text not null, raw_json text not null, content_hash text not null, is_draft integer not null default 0, created_at_gh text, updated_at_gh text, closed_at_gh text, merged_at_gh text, updated_at text not null);
create table pull_request_details (thread_id integer primary key, repo_id integer not null, number integer not null, base_sha text, head_sha text, head_ref text, head_repo_full_name text, mergeable_state text, additions integer not null default 0, deletions integer not null default 0, changed_files integer not null default 0, raw_json text not null, fetched_at text not null, updated_at text not null);
create table pull_request_checks (thread_id integer not null, name text, status text, conclusion text, workflow_name text, details_url text, started_at text, completed_at text, fetched_at text, raw_json text not null);
create table github_workflow_runs (repo_id integer not null, head_sha text, workflow_name text, status text, conclusion text, html_url text, updated_at_gh text, raw_json text not null);
create table pull_request_review_threads (thread_id integer not null, review_thread_id text not null, path text, line integer not null default 0, start_line integer not null default 0, is_resolved integer not null default 0, is_outdated integer not null default 0, viewer_can_resolve integer not null default 0, viewer_can_unresolve integer not null default 0, viewer_can_reply integer not null default 0, first_author_login text, first_author_type text, first_comment_body text, first_comment_url text, first_comment_created_at text, first_comment_updated_at text, comments_json text not null, raw_json text not null, fetched_at text not null);
create table comments (thread_id integer not null, author_login text, author_type text, is_bot integer not null default 0, body text, created_at_gh text, updated_at_gh text, raw_json text not null);
insert into repositories (id, owner, name, full_name, raw_json, updated_at) values (1, 'mastra-ai', 'mastra', 'mastra-ai/mastra', '{}', '2026-06-06T02:08:18Z');
${githubMultiPrFixtures
  .map(
    pr => `insert into threads (id, repo_id, github_id, number, kind, state, title, body, author_login, author_type, html_url, labels_json, assignees_json, raw_json, content_hash, created_at_gh, updated_at_gh, updated_at) values (${pr.id}, 1, 'PR_kwDOfixture_${pr.number}', ${pr.number}, 'pull_request', 'open', ${sqlString(pr.title)}, 'Sanitized gitcrawl fixture body.', 'octocat', 'User', ${sqlString(pr.htmlUrl)}, '[]', '[]', '{}', ${sqlString(pr.contentHash)}, '2026-06-05T23:00:18Z', ${sqlString(pr.updatedAt)}, ${sqlString(pr.updatedAt)});
insert into pull_request_details (thread_id, repo_id, number, head_sha, head_ref, mergeable_state, raw_json, fetched_at, updated_at) values (${pr.id}, 1, ${pr.number}, ${sqlString(pr.headSha)}, ${sqlString(pr.headRef)}, 'unknown', '{}', ${sqlString(pr.updatedAt)}, ${sqlString(pr.updatedAt)});`,
  )
  .join('\n')}
`;
  execFileSync('sqlite3', [dbPath], { input: sql });

  const mockGitcrawlPath = join(fixtureDir, 'gitcrawl');
  writeFileSync(
    mockGitcrawlPath,
    `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(join(fixtureDir, 'gitcrawl-calls.jsonl'))}, JSON.stringify(args) + '\\n');
const threads = ${JSON.stringify(
      githubMultiPrFixtures.map(pr => ({
        number: pr.number,
        kind: 'pull_request',
        state: 'open',
        title: pr.title,
        html_url: pr.htmlUrl,
        updated_at_gh: pr.updatedAt,
        content_hash: pr.contentHash,
      })),
    )};
if (args[0] === 'sync') { console.log(JSON.stringify({ ok: true, synced: 1 })); process.exit(0); }
if (args[0] === 'threads') { console.log(JSON.stringify({ threads })); process.exit(0); }
console.error('unexpected gitcrawl args: ' + args.join(' '));
process.exit(2);
`,
  );
  chmodSync(mockGitcrawlPath, 0o755);

  const mockGhPath = join(fixtureDir, 'gh');
  writeFileSync(
    mockGhPath,
    `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(join(fixtureDir, 'gh-calls.jsonl'))}, JSON.stringify(args) + '\\n');
const prs = ${JSON.stringify(
      githubMultiPrFixtures.map(pr => ({
        number: pr.number,
        title: pr.title,
        author: { login: 'octocat' },
        updatedAt: pr.updatedAt,
        url: pr.htmlUrl,
        headRefName: pr.headRef,
        baseRefName: 'main',
      })),
    )};
if (args[0] === 'repo' && args[1] === 'view') { console.log(JSON.stringify({ owner: { login: 'mastra-ai' }, name: 'mastra' })); process.exit(0); }
if (args[0] === 'pr' && args[1] === 'view') { console.log('https://github.com/mastra-ai/mastra/pull/17637'); process.exit(0); }
if (args[0] === 'pr' && args[1] === 'list') { console.log(JSON.stringify(prs)); process.exit(0); }
console.error('unexpected gh args: ' + args.join(' '));
process.exit(2);
`,
  );
  chmodSync(mockGhPath, 0o755);

  writeFileSync(
    join(context.projectDir, '.github-signals-multi-e2e-env.json'),
    JSON.stringify({ dbPath, mockGitcrawlPath, fixtureDir }),
  );
  return { dbPath, mockGitcrawlPath, fixtureDir };
}

export function readGithubSignalsMultiEnv(projectDir: string) {
  return JSON.parse(readFileSync(join(projectDir, '.github-signals-multi-e2e-env.json'), 'utf8')) as {
    dbPath: string;
    mockGitcrawlPath: string;
    fixtureDir: string;
  };
}

export function githubSignalsEnv(projectDir: string, currentPath: string | undefined) {
  const { dbPath, mockGitcrawlPath, fixtureDir } = readGithubSignalsMultiEnv(projectDir);
  return {
    GITCRAWL_DB_PATH: dbPath,
    MASTRACODE_GITCRAWL_BIN: mockGitcrawlPath,
    PATH: `${fixtureDir}${currentPath ? `:${currentPath}` : ''}`,
  };
}

export function githubSignalsInProcessApp({
  startMastraCodeApp,
}: Pick<McE2eInProcessAppContext, 'startMastraCodeApp'>) {
  return startMastraCodeApp({
    config: {
      disableHooks: true,
      disableMcp: true,
      unixSocketPubSub: false,
    },
  });
}

import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2ePrepareContext, McE2eScenario } from './types.js';

const prFixture = {
  owner: 'mastra-ai',
  repo: 'mastra',
  number: 17639,
  title: 'test: unsubscribe github signal fixture',
  htmlUrl: 'https://github.com/mastra-ai/mastra/pull/17639',
  updatedAt: '2026-06-12T02:00:00Z',
  contentHash: 'github-unsubscribe-reload-content-hash',
  headSha: '2222222222222222222222222222222222222222',
  headRef: 'test/github-signals-unsubscribe-reload',
};

const threadFixture = {
  resourceId: 'mc-e2e-github-unsubscribe-resource',
  threadId: 'thread-mc-e2e-github-unsubscribe',
  title: 'E2E GitHub unsubscribe fixture',
};

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function prepareGitcrawlFixture({ projectDir }: McE2ePrepareContext) {
  const gitcrawlDir = join(projectDir, '.gitcrawl-unsubscribe-e2e');
  mkdirSync(gitcrawlDir, { recursive: true });

  const dbPath = join(gitcrawlDir, 'gitcrawl.db');
  const sql = `
create table repositories (id integer primary key, owner text not null, name text not null, full_name text not null unique, raw_json text not null, updated_at text not null);
create table threads (id integer primary key, repo_id integer not null, github_id text not null, number integer not null, kind text not null, state text not null, title text not null, body text, author_login text, author_type text, html_url text not null, labels_json text not null, assignees_json text not null, raw_json text not null, content_hash text not null, is_draft integer not null default 0, created_at_gh text, updated_at_gh text, closed_at_gh text, merged_at_gh text, updated_at text not null);
create table pull_request_details (thread_id integer primary key, repo_id integer not null, number integer not null, base_sha text, head_sha text, head_ref text, head_repo_full_name text, mergeable_state text, additions integer not null default 0, deletions integer not null default 0, changed_files integer not null default 0, raw_json text not null, fetched_at text not null, updated_at text not null);
create table pull_request_checks (thread_id integer not null, name text, status text, conclusion text, workflow_name text, details_url text, started_at text, completed_at text, fetched_at text, raw_json text not null);
create table github_workflow_runs (repo_id integer not null, head_sha text, workflow_name text, status text, conclusion text, html_url text, updated_at_gh text, raw_json text not null);
create table pull_request_review_threads (thread_id integer not null, review_thread_id text not null, path text, line integer not null default 0, start_line integer not null default 0, is_resolved integer not null default 0, is_outdated integer not null default 0, viewer_can_resolve integer not null default 0, viewer_can_unresolve integer not null default 0, viewer_can_reply integer not null default 0, first_author_login text, first_author_type text, first_comment_body text, first_comment_url text, first_comment_created_at text, first_comment_updated_at text, comments_json text not null, raw_json text not null, fetched_at text not null);
create table comments (thread_id integer not null, author_login text, author_type text, is_bot integer not null default 0, body text, created_at_gh text, updated_at_gh text, raw_json text not null);
insert into repositories (id, owner, name, full_name, raw_json, updated_at) values (1, ${sqlString(prFixture.owner)}, ${sqlString(prFixture.repo)}, ${sqlString(`${prFixture.owner}/${prFixture.repo}`)}, '{}', ${sqlString(prFixture.updatedAt)});
insert into threads (id, repo_id, github_id, number, kind, state, title, body, author_login, author_type, html_url, labels_json, assignees_json, raw_json, content_hash, created_at_gh, updated_at_gh, updated_at) values (1, 1, 'PR_kwDunsubfixture', ${prFixture.number}, 'pull_request', 'open', ${sqlString(prFixture.title)}, 'Sanitized unsubscribe gitcrawl fixture body.', 'octocat', 'User', ${sqlString(prFixture.htmlUrl)}, '[]', '[]', '{}', ${sqlString(prFixture.contentHash)}, '2026-06-12T01:50:00Z', ${sqlString(prFixture.updatedAt)}, ${sqlString(prFixture.updatedAt)});
insert into pull_request_details (thread_id, repo_id, number, head_sha, head_ref, mergeable_state, raw_json, fetched_at, updated_at) values (1, 1, ${prFixture.number}, ${sqlString(prFixture.headSha)}, ${sqlString(prFixture.headRef)}, 'clean', '{}', ${sqlString(prFixture.updatedAt)}, ${sqlString(prFixture.updatedAt)});
insert into pull_request_checks (thread_id, name, status, conclusion, details_url, completed_at, fetched_at, raw_json) values (1, 'GitHub Signals unsubscribe e2e', 'completed', 'success', 'https://github.com/mastra-ai/mastra/actions/runs/30000000002/job/1', ${sqlString(prFixture.updatedAt)}, ${sqlString(prFixture.updatedAt)}, ${sqlString(JSON.stringify({ head_sha: prFixture.headSha }))});
insert into github_workflow_runs (repo_id, head_sha, workflow_name, status, conclusion, html_url, updated_at_gh, raw_json) values (1, ${sqlString(prFixture.headSha)}, 'GitHub Signals unsubscribe e2e', 'completed', 'success', 'https://github.com/mastra-ai/mastra/actions/runs/30000000002', ${sqlString(prFixture.updatedAt)}, '{}');
`;
  execFileSync('sqlite3', [dbPath], { input: sql });

  const mockGitcrawlPath = join(gitcrawlDir, 'gitcrawl');
  writeFileSync(
    mockGitcrawlPath,
    `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(join(gitcrawlDir, 'gitcrawl-calls.jsonl'))}, JSON.stringify(args) + '\\n');
const thread = ${JSON.stringify({
      number: prFixture.number,
      kind: 'pull_request',
      state: 'open',
      title: prFixture.title,
      html_url: prFixture.htmlUrl,
      updated_at_gh: prFixture.updatedAt,
      content_hash: prFixture.contentHash,
    })};
if (args[0] === 'sync') { console.log(JSON.stringify({ ok: true, synced: 1 })); process.exit(0); }
if (args[0] === 'threads') { console.log(JSON.stringify({ threads: [thread] })); process.exit(0); }
console.error('unexpected gitcrawl args: ' + args.join(' '));
process.exit(2);
`,
  );
  chmodSync(mockGitcrawlPath, 0o755);

  return { dbPath, mockGitcrawlPath };
}

export const githubSignalsUnsubscribeReloadScenario = {
  name: 'github-signals-unsubscribe-reload',
  description: 'loads a subscribed GitHub PR thread and unsubscribes through the TUI without fixed pacing waits',
  testName: 'unsubscribes a persisted GitHub PR subscription through the command flow',
  prepare(context) {
    mkdirSync(context.projectDir, { recursive: true });

    const settingsPath = join(context.appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as { signals?: Record<string, unknown> };
    settings.signals = {
      ...settings.signals,
      experimentalGithubSignals: true,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const { dbPath, mockGitcrawlPath } = prepareGitcrawlFixture(context);
    writeFileSync(join(context.projectDir, '.gitcrawl-unsubscribe-e2e-env.json'), JSON.stringify({ dbPath, mockGitcrawlPath }));

    const now = new Date('2026-06-12T02:01:00.000Z');
    const metadata = {
      projectPath: context.projectDir,
      mastra: {
        githubSignals: {
          subscriptions: [
            {
              owner: prFixture.owner,
              repo: prFixture.repo,
              number: prFixture.number,
              subscribedAt: prFixture.updatedAt,
              updatedAt: prFixture.updatedAt,
              lastSubscribeSignalId: 'github-unsubscribe-seeded-subscribe',
              lastSyncAt: prFixture.updatedAt,
              lastSyncStatus: 'success',
              lastObservedGithubUpdatedAt: prFixture.updatedAt,
              lastObservedContentHash: prFixture.contentHash,
              lastObservedThreadContentHash: prFixture.contentHash,
              lastObservedHeadSha: prFixture.headSha,
              lastObservedState: 'open',
              lastObservedMergeableState: 'clean',
              lastObservedCiState: 'success',
            },
          ],
        },
      },
    };
    const userContent = JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'Seeded GitHub unsubscribe thread.' }] });
    const assistantContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Ready for GitHub unsubscribe fixture.' }],
    });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${sqlString(threadFixture.threadId)}, ${sqlString(threadFixture.resourceId)}, ${sqlString(threadFixture.title)}, ${sqlString(JSON.stringify(metadata))}, ${sqlString(now.toISOString())}, ${sqlString(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-github-unsubscribe-user', ${sqlString(threadFixture.threadId)}, ${sqlString(userContent)}, 'user', 'v2', ${sqlString(now.toISOString())}, ${sqlString(threadFixture.resourceId)}),
  ('msg-github-unsubscribe-assistant', ${sqlString(threadFixture.threadId)}, ${sqlString(assistantContent)}, 'assistant', 'v2', ${sqlString(new Date(now.getTime() + 1000).toISOString())}, ${sqlString(threadFixture.resourceId)});
`;
    execFileSync('sqlite3', [context.dbPath], { input: sql });
  },
  env({ projectDir }) {
    const { dbPath, mockGitcrawlPath } = JSON.parse(readFileSync(join(projectDir, '.gitcrawl-unsubscribe-e2e-env.json'), 'utf8')) as {
      dbPath: string;
      mockGitcrawlPath: string;
    };
    return {
      GITCRAWL_DB_PATH: dbPath,
      MASTRACODE_GITCRAWL_BIN: mockGitcrawlPath,
    };
  },
  inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: true,
        unixSocketPubSub: false,
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project: mastra/i, terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/GitHub unsubscribe fixture/i, terminal);
    terminal.write('unsubscribe fixture');
    await runtime.waitForScreenText(/GitHub unsubscribe fixture/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to: E2E GitHub unsubscribe fixture/i, terminal);
    await runtime.waitForScreenText(/idle/i, terminal, 10_000);

    terminal.submit('/github unsubscribe mastra-ai/mastra#17639');
    await runtime.waitForScreenText(/Unsubscribed from mastra-ai\/mastra#17639/i, terminal, 20_000);

    runtime.printScreen('github unsubscribe command output', terminal);
  },
} satisfies McE2eScenario;

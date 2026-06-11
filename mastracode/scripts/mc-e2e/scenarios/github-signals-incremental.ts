import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2ePrepareContext, McE2eScenario } from './types.js';

const prFixture = {
  owner: 'mastra-ai',
  repo: 'mastra',
  number: 17638,
  title: 'fix: recover github signals incremental flow',
  htmlUrl: 'https://github.com/mastra-ai/mastra/pull/17638',
  initialUpdatedAt: '2026-06-11T16:00:00Z',
  recoveredUpdatedAt: '2026-06-11T16:05:00Z',
  initialContentHash: 'github-incremental-initial-content-hash',
  recoveredContentHash: 'github-incremental-recovered-content-hash',
  headSha: '1111111111111111111111111111111111111111',
  headRef: 'fix/github-signals-incremental',
  checkName: 'E2E Tests / GitHub Signals incremental',
};

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function prepareGitcrawlFixture({ projectDir }: McE2ePrepareContext) {
  const gitcrawlDir = join(projectDir, '.gitcrawl-incremental-e2e');
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
insert into repositories (id, owner, name, full_name, raw_json, updated_at) values (1, ${sqlString(prFixture.owner)}, ${sqlString(prFixture.repo)}, ${sqlString(`${prFixture.owner}/${prFixture.repo}`)}, '{}', ${sqlString(prFixture.recoveredUpdatedAt)});
insert into threads (id, repo_id, github_id, number, kind, state, title, body, author_login, author_type, html_url, labels_json, assignees_json, raw_json, content_hash, created_at_gh, updated_at_gh, updated_at) values (1, 1, 'PR_kwDincrfixture', ${prFixture.number}, 'pull_request', 'open', ${sqlString(prFixture.title)}, 'Sanitized incremental gitcrawl fixture body.', 'octocat', 'User', ${sqlString(prFixture.htmlUrl)}, '[]', '[]', '{}', ${sqlString(prFixture.recoveredContentHash)}, '2026-06-11T15:50:00Z', ${sqlString(prFixture.recoveredUpdatedAt)}, ${sqlString(prFixture.recoveredUpdatedAt)});
insert into pull_request_details (thread_id, repo_id, number, head_sha, head_ref, mergeable_state, raw_json, fetched_at, updated_at) values (1, 1, ${prFixture.number}, ${sqlString(prFixture.headSha)}, ${sqlString(prFixture.headRef)}, 'clean', '{}', ${sqlString(prFixture.recoveredUpdatedAt)}, ${sqlString(prFixture.recoveredUpdatedAt)});
insert into pull_request_checks (thread_id, name, status, conclusion, details_url, completed_at, fetched_at, raw_json) values (1, ${sqlString(prFixture.checkName)}, 'completed', 'success', 'https://github.com/mastra-ai/mastra/actions/runs/30000000001/job/1', ${sqlString(prFixture.recoveredUpdatedAt)}, ${sqlString(prFixture.recoveredUpdatedAt)}, ${sqlString(JSON.stringify({ head_sha: prFixture.headSha }))});
insert into github_workflow_runs (repo_id, head_sha, workflow_name, status, conclusion, html_url, updated_at_gh, raw_json) values (1, ${sqlString(prFixture.headSha)}, 'GitHub Signals incremental', 'completed', 'success', 'https://github.com/mastra-ai/mastra/actions/runs/30000000001', ${sqlString(prFixture.recoveredUpdatedAt)}, '{}');
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
      updated_at_gh: prFixture.recoveredUpdatedAt,
      content_hash: prFixture.recoveredContentHash,
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

export const githubSignalsIncrementalScenario = {
  name: 'github-signals-incremental',
  description:
    'loads a persisted GitHub PR subscription, syncs a changed gitcrawl snapshot, and renders the incremental notification',
  testName: 'renders an incremental GitHub notification after /github sync observes changed PR state',
  useOpenAIModel: true,
  aimockFixture: 'github-signals-incremental.json',
  prepare(context) {
    mkdirSync(context.projectDir, { recursive: true });

    const settingsPath = join(context.appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.signals = {
      ...settings.signals,
      experimentalGithubSignals: true,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const { dbPath, mockGitcrawlPath } = prepareGitcrawlFixture(context);
    writeFileSync(join(context.projectDir, '.gitcrawl-incremental-e2e-env.json'), JSON.stringify({ dbPath, mockGitcrawlPath }));

    const now = new Date('2026-06-11T16:01:00.000Z');
    const resourceId = 'mc-e2e-github-incremental-resource';
    const threadId = 'thread-mc-e2e-github-incremental';
    const title = 'E2E GitHub incremental subscription fixture';
    const metadata = {
      projectPath: context.projectDir,
      mastra: {
        githubSignals: {
          subscriptions: [
            {
              owner: prFixture.owner,
              repo: prFixture.repo,
              number: prFixture.number,
              subscribedAt: prFixture.initialUpdatedAt,
              updatedAt: prFixture.initialUpdatedAt,
              lastSubscribeSignalId: 'github-incremental-seeded-subscribe',
              lastSyncAt: prFixture.initialUpdatedAt,
              lastSyncStatus: 'success',
              lastObservedGithubUpdatedAt: prFixture.initialUpdatedAt,
              lastObservedContentHash: prFixture.initialContentHash,
              lastObservedThreadContentHash: prFixture.initialContentHash,
              lastObservedHeadSha: prFixture.headSha,
              lastObservedState: 'open',
              lastObservedMergeableState: 'clean',
              lastObservedCiState: 'failure',
            },
          ],
        },
      },
    };
    const userContent = JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'Seeded GitHub incremental thread.' }] });
    const assistantContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Ready to sync the GitHub incremental fixture.' }],
    });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${sqlString(threadId)}, ${sqlString(resourceId)}, ${sqlString(title)}, ${sqlString(JSON.stringify(metadata))}, ${sqlString(now.toISOString())}, ${sqlString(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-github-incremental-user', ${sqlString(threadId)}, ${sqlString(userContent)}, 'user', 'v2', ${sqlString(now.toISOString())}, ${sqlString(resourceId)}),
  ('msg-github-incremental-assistant', ${sqlString(threadId)}, ${sqlString(assistantContent)}, 'assistant', 'v2', ${sqlString(new Date(now.getTime() + 1000).toISOString())}, ${sqlString(resourceId)});
`;
    execFileSync('sqlite3', [context.dbPath], { input: sql });

    writeFileSync(
      join(context.projectDir, '.mc-e2e-github-signals-incremental-entrypoint.ts'),
      `import { join } from 'node:path';\nimport { pathToFileURL } from 'node:url';\n\nconst mastracodeDir = ${JSON.stringify(context.mastracodeDir)};\nconst { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);\nconst { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);\nconst { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);\n\nprocess.on('SIGINT', () => process.exit(0));\nprocess.on('SIGTERM', () => process.exit(0));\n\nconst result = await createMastraCode({\n  cwd: process.cwd(),\n  disableMcp: true,\n  disableHooks: true,\n  unixSocketPubSub: false,\n});\n\nconst tui = new MastraTUI({\n  harness: result.harness,\n  hookManager: result.hookManager,\n  authStorage: result.authStorage,\n  mcpManager: result.mcpManager,\n  appName: 'Mastra Code',\n  version: getCurrentVersion(),\n  inlineQuestions: true,\n  githubSignals: result.githubSignals,\n});\n\nvoid tui.run().catch(error => {\n  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');\n  process.exit(1);\n});\n`,
    );
  },
  env({ projectDir }) {
    const { dbPath, mockGitcrawlPath } = JSON.parse(
      readFileSync(join(projectDir, '.gitcrawl-incremental-e2e-env.json'), 'utf8'),
    ) as {
      dbPath: string;
      mockGitcrawlPath: string;
    };
    return {
      GITCRAWL_DB_PATH: dbPath,
      MASTRACODE_GITCRAWL_BIN: mockGitcrawlPath,
    };
  },
  entrypoint({ projectDir }) {
    return join(projectDir, '.mc-e2e-github-signals-incremental-entrypoint.ts');
  },
  verifyAimockRequests(requests) {
    if (requests.length < 1) throw new Error(`Expected at least 1 AIMock request, received ${requests.length}`);
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project: mastra/i, terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E GitHub incremental subscription fixture/i, terminal);
    terminal.write('incremental subscription');
    await runtime.waitForScreenText(/E2E GitHub incremental subscription fixture/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to: E2E GitHub incremental subscription fixture/i, terminal);

    terminal.submit('/github sync');
    await runtime.waitForScreenText(/notification from github/i, terminal, 30_000);
    await runtime.waitForScreenText(/mastra-ai\/mastra#17638 CI recovered/i, terminal, 30_000);
    await runtime.waitForScreenText(/medium · pull-request-ci-recovered · delivered/i, terminal, 30_000);

    terminal.submit('/github debug');
    await runtime.waitForScreenText(/mastra-ai\/mastra#17638 sync=success/i, terminal, 30_000);
    await runtime.waitForScreenText(/ci=success/i, terminal, 30_000);
    runtime.printScreen('github incremental debug status', terminal);
  },
} satisfies McE2eScenario;

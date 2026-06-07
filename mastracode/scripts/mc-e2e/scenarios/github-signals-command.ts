import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2ePrepareContext, McE2eScenario } from './types.js';

const prFixture = {
  owner: 'mastra-ai',
  repo: 'mastra',
  number: 17637,
  title: 'feat: add agent tool hooks',
  htmlUrl: 'https://github.com/mastra-ai/mastra/pull/17637',
  updatedAt: '2026-06-06T01:08:18Z',
  contentHash: 'f80eac0f355460e6b73560649bd3b21b67e2f78c66da1e1265a16ddd441a7cad',
  headSha: 'fe097a5ea68b96b0294df099841c060fceb073a4',
  headRef: 'fix/workspace-tool-hooks',
  mergeableState: 'unknown',
  failingCheck: 'E2E Tests / E2E kitchen-sink (1/3)',
};

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function prepareGitcrawlFixture({ projectDir }: McE2ePrepareContext) {
  const gitcrawlDir = join(projectDir, '.gitcrawl-e2e');
  mkdirSync(gitcrawlDir, { recursive: true });

  const dbPath = join(gitcrawlDir, 'gitcrawl.db');
  const sql = `
create table repositories (id integer primary key, owner text not null, name text not null, full_name text not null unique, raw_json text not null, updated_at text not null);
create table threads (id integer primary key, repo_id integer not null, github_id text not null, number integer not null, kind text not null, state text not null, title text not null, body text, author_login text, author_type text, html_url text not null, labels_json text not null, assignees_json text not null, raw_json text not null, content_hash text not null, is_draft integer not null default 0, created_at_gh text, updated_at_gh text, closed_at_gh text, merged_at_gh text, updated_at text not null);
create table pull_request_details (thread_id integer primary key, repo_id integer not null, number integer not null, base_sha text, head_sha text, head_ref text, head_repo_full_name text, mergeable_state text, additions integer not null default 0, deletions integer not null default 0, changed_files integer not null default 0, raw_json text not null, fetched_at text not null, updated_at text not null);
create table pull_request_checks (thread_id integer not null, name text, status text, conclusion text, workflow_name text, details_url text, started_at text, completed_at text, fetched_at text, raw_json text not null);
create table github_workflow_runs (repo_id integer not null, head_sha text, workflow_name text, status text, conclusion text, html_url text, updated_at_gh text, raw_json text not null);
create table pull_request_review_threads (thread_id integer not null, review_thread_id text not null, path text, line integer not null default 0, start_line integer not null default 0, is_resolved integer not null default 0, is_outdated integer not null default 0, viewer_can_resolve integer not null default 0, viewer_can_unresolve integer not null default 0, viewer_can_reply integer not null default 0, first_author_login text, first_author_type text, first_comment_body text, first_comment_url text, first_comment_created_at text, first_comment_updated_at text, comments_json text not null, raw_json text not null, fetched_at text not null);
create table comments (thread_id integer not null, author_login text, author_type text, is_bot integer not null default 0, created_at_gh text, updated_at_gh text, raw_json text not null);
insert into repositories (id, owner, name, full_name, raw_json, updated_at) values (1, ${sqlString(prFixture.owner)}, ${sqlString(prFixture.repo)}, ${sqlString(`${prFixture.owner}/${prFixture.repo}`)}, '{}', ${sqlString(prFixture.updatedAt)});
insert into threads (id, repo_id, github_id, number, kind, state, title, body, author_login, author_type, html_url, labels_json, assignees_json, raw_json, content_hash, created_at_gh, updated_at_gh, updated_at) values (1, 1, 'PR_kwDOfixture', ${prFixture.number}, 'pull_request', 'open', ${sqlString(prFixture.title)}, 'Sanitized gitcrawl fixture body.', 'octocat', 'User', ${sqlString(prFixture.htmlUrl)}, '[]', '[]', '{}', ${sqlString(prFixture.contentHash)}, '2026-06-05T23:00:18Z', ${sqlString(prFixture.updatedAt)}, ${sqlString(prFixture.updatedAt)});
insert into pull_request_details (thread_id, repo_id, number, head_sha, head_ref, mergeable_state, raw_json, fetched_at, updated_at) values (1, 1, ${prFixture.number}, ${sqlString(prFixture.headSha)}, ${sqlString(prFixture.headRef)}, ${sqlString(prFixture.mergeableState)}, '{}', ${sqlString(prFixture.updatedAt)}, ${sqlString(prFixture.updatedAt)});
insert into pull_request_checks (thread_id, name, status, conclusion, details_url, completed_at, fetched_at, raw_json) values (1, ${sqlString(prFixture.failingCheck)}, 'completed', 'failure', 'https://github.com/mastra-ai/mastra/actions/runs/27047106933/job/79837516788', '2026-06-06T01:03:23Z', ${sqlString(prFixture.updatedAt)}, ${sqlString(JSON.stringify({ head_sha: prFixture.headSha }))});
insert into github_workflow_runs (repo_id, head_sha, workflow_name, status, conclusion, html_url, updated_at_gh, raw_json) values (1, ${sqlString(prFixture.headSha)}, 'Prebuild', 'completed', 'failure', 'https://github.com/mastra-ai/mastra/actions/runs/27047106933', '2026-06-06T01:03:24Z', '{}');
`;
  execFileSync('sqlite3', [dbPath], { input: sql });

  const mockGitcrawlPath = join(gitcrawlDir, 'gitcrawl');
  writeFileSync(
    mockGitcrawlPath,
    `#!/usr/bin/env node\nimport { appendFileSync } from 'node:fs';\nconst args = process.argv.slice(2);\nappendFileSync(${JSON.stringify(join(gitcrawlDir, 'gitcrawl-calls.jsonl'))}, JSON.stringify(args) + '\\n');\nconst thread = ${JSON.stringify(
      {
        number: prFixture.number,
        kind: 'pull_request',
        state: 'open',
        title: prFixture.title,
        html_url: prFixture.htmlUrl,
        updated_at_gh: prFixture.updatedAt,
        content_hash: prFixture.contentHash,
      },
    )};\nif (args[0] === 'sync') { console.log(JSON.stringify({ ok: true, synced: 1 })); process.exit(0); }\nif (args[0] === 'threads') { console.log(JSON.stringify({ threads: [thread] })); process.exit(0); }\nconsole.error('unexpected gitcrawl args: ' + args.join(' '));\nprocess.exit(2);\n`,
  );
  chmodSync(mockGitcrawlPath, 0o755);

  return { dbPath, mockGitcrawlPath };
}

export const githubSignalsCommandScenario = {
  name: 'github-signals-command',
  description:
    'subscribes to a GitHub PR through the real TUI using a mock gitcrawl binary and sanitized gitcrawl DB fixture',
  testName: 'subscribes to a PR and renders GitHub Signals status in the real TUI',
  useOpenAIModel: true,
  aimockFixture: 'github-signals-command.json',
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
    writeFileSync(join(context.projectDir, '.gitcrawl-e2e-env.json'), JSON.stringify({ dbPath, mockGitcrawlPath }));

    writeFileSync(
      join(context.projectDir, '.mc-e2e-github-signals-entrypoint.ts'),
      `import { join } from 'node:path';\nimport { pathToFileURL } from 'node:url';\n\nconst mastracodeDir = ${JSON.stringify(context.mastracodeDir)};\nconst { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);\nconst { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);\nconst { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);\n\nprocess.on('SIGINT', () => process.exit(0));\nprocess.on('SIGTERM', () => process.exit(0));\n\nconst result = await createMastraCode({\n  cwd: process.cwd(),\n  disableMcp: true,\n  disableHooks: true,\n  unixSocketPubSub: false,\n});\n\nconst tui = new MastraTUI({\n  harness: result.harness,\n  hookManager: result.hookManager,\n  authStorage: result.authStorage,\n  mcpManager: result.mcpManager,\n  appName: 'Mastra Code',\n  version: getCurrentVersion(),\n  inlineQuestions: true,\n  githubSignals: result.githubSignals,\n});\n\nvoid tui.run().catch(error => {\n  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');\n  process.exit(1);\n});\n`,
    );
  },
  env({ projectDir }) {
    const { dbPath, mockGitcrawlPath } = JSON.parse(
      readFileSync(join(projectDir, '.gitcrawl-e2e-env.json'), 'utf8'),
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
    return join(projectDir, '.mc-e2e-github-signals-entrypoint.ts');
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 2) throw new Error(`Expected 2 AIMock requests, received ${requests.length}`);
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project: mastra/i, terminal);

    terminal.submit('/new');
    await runtime.waitForScreenText(/Ready for new conversation/i, terminal);

    terminal.submit('Create a GitHub Signals e2e thread.');
    await runtime.waitForScreenText(/GitHub Signals thread ready/i, terminal);

    terminal.submit(`/github subscribe ${prFixture.owner}/${prFixture.repo}#${prFixture.number}`);
    await runtime.waitForScreenText(/Subscribed to mastra-ai\/mastra#17637/i, terminal, 30_000);
    await runtime.waitForScreenText(/notification from github/i, terminal, 30_000);
    await runtime.waitForScreenText(/CI: failure/i, terminal);

    terminal.submit('/github debug');
    await runtime.waitForScreenText(/GitHub Signals debug for/i, terminal);
    await runtime.waitForScreenText(/1 subscription/i, terminal);
    await runtime.waitForScreenText(/mastra-ai\/mastra#17637 sync=success/i, terminal);
    await runtime.waitForScreenText(/ci=failure/i, terminal);
    runtime.printScreen('github subscription debug status', terminal);
  },
} satisfies McE2eScenario;

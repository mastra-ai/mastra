import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { StorageThreadType } from '@mastra/core/memory';
import type { SendNotificationSignalInput } from '@mastra/core/notifications';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GithubSignals } from './index.js';
import type { GithubSubscriptionMode } from './index.js';

const folders: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

// Actual Gitcrawl SQLite layout; only the external GitHub sync/threads CLI is scripted.
function fixture(mode: GithubSubscriptionMode) {
  const dir = mkdtempSync(join(tmpdir(), 'github-comments-'));
  folders.push(dir);
  const db = join(dir, 'gitcrawl.db');
  vi.stubEnv('GITCRAWL_DB_PATH', db);
  const sql = (input: string) => execFileSync('sqlite3', [db, input], { encoding: 'utf8' });
  const quote = (value: unknown) => `'${String(value).replaceAll("'", "''")}'`;
  sql(`
    create table repositories (id integer, owner text, name text);
    create table threads (id integer, repo_id integer, number integer, state text, closed_at_gh text, merged_at_gh text);
    create table pull_request_details (thread_id integer, head_sha text, head_ref text, mergeable_state text, raw_json text);
    create table pull_request_checks (thread_id integer, name text, status text, conclusion text, workflow_name text, details_url text, completed_at text, started_at text, fetched_at text, raw_json text);
    create table pull_request_review_threads (thread_id integer, review_thread_id text, path text, line integer, is_resolved integer, first_comment_updated_at text, first_comment_created_at text, fetched_at text, comments_json text);
    create table comments (thread_id integer, author_login text, author_type text, is_bot integer, body text, updated_at_gh text, created_at_gh text, raw_json text);
    insert into repositories values (1, 'mastra-ai', 'mastra');
    insert into threads values (1, 1, 29096, 'open', null, null);
    insert into pull_request_details values (1, null, null, 'clean', '{}');
  `);
  const command = join(dir, 'gitcrawl');
  writeFileSync(
    command,
    `#!/usr/bin/env node
if (process.argv[2] === 'threads') console.log(JSON.stringify({threads:[{number:29096,title:'Review delivery',state:'open',updated_at_gh:'2026-11-12T20:40:00Z',content_hash:'unchanged'}]}));
else console.log('{}');
`,
    { mode: 0o755 },
  );
  let thread: StorageThreadType = {
    id: 'subscriber',
    resourceId: 'resource',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      mastra: {
        githubSignals: {
          subscriptions: [
            {
              owner: 'mastra-ai',
              repo: 'mastra',
              number: 29096,
              mode,
              subscribedAt: '2026-11-12T20:00:00Z',
              updatedAt: '2026-11-12T20:00:00Z',
              lastSubscribeSignalId: 'subscribe',
            },
          ],
        },
      },
    },
  };
  const delivered: SendNotificationSignalInput[] = [];
  const permissionLookups: string[] = [];
  const createProvider = () => {
    const provider = new GithubSignals({
      gitcrawlCommand: command,
      threadStore: {
        async getThreadById() {
          return thread;
        },
        async saveThread({ thread: next }) {
          thread = next;
          return next;
        },
      },
      permissionResolver: {
        async getPermission(_owner, _repo, user) {
          permissionLookups.push(user);
          return user === 'maintainer' ? 'write' : 'read';
        },
      },
    });
    provider.addAgent({
      sendSignal() {
        return { accepted: true };
      },
      async sendNotificationSignal(input) {
        delivered.push(...(Array.isArray(input) ? input : [input]));
        return { accepted: true };
      },
    });
    return provider;
  };
  let provider = createProvider();
  const poll = async () => {
    await provider.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId! });
    const subscription = (
      thread.metadata?.mastra as { githubSignals: { subscriptions: { lastSnapshotError?: string }[] } }
    ).githubSignals.subscriptions[0]!;
    expect(subscription.lastSnapshotError).toBeUndefined();
  };
  function comment(
    id: string,
    body: string,
    at = '2026-11-12T20:41:53Z',
    author = 'coderabbitai[bot]',
    createdAt = at,
  ) {
    sql(
      `insert into comments values (1, ${quote(author)}, ${quote(author.endsWith('[bot]') ? 'Bot' : 'User')}, ${author.endsWith('[bot]') ? 1 : 0}, ${quote(body)}, ${quote(at)}, ${quote(createdAt)}, ${quote(JSON.stringify({ html_url: `https://github.com/mastra-ai/mastra/pull/29096#issuecomment-${id}` }))})`,
    );
  }
  function inline(comments: { id: string; body: string; author?: string; at?: string }[]) {
    const nodes = comments.map(c => ({
      id: c.id,
      body: c.body,
      author: { login: c.author ?? 'coderabbitai[bot]', __typename: c.author ? 'User' : 'Bot' },
      path: 'src/index.ts',
      createdAt: c.at ?? '2026-11-12T20:41:53Z',
      updatedAt: c.at ?? '2026-11-12T20:41:53Z',
      url: `https://github.com/mastra-ai/mastra/pull/29096#discussion_r${c.id}`,
    }));
    sql(
      `delete from pull_request_review_threads; insert into pull_request_review_threads values (1, 'thread-1', 'src/index.ts', 42, 0, '2026-11-12T20:41:53Z', '2026-11-12T20:41:53Z', '2026-11-12T20:41:56Z', ${quote(JSON.stringify(nodes))})`,
    );
  }
  return {
    poll,
    comment,
    inline,
    sql,
    delivered,
    permissionLookups,
    restart() {
      provider = createProvider();
    },
  };
}

describe.each(['working', 'review'] as const)('%s subscriber receives every finding (r192)', mode => {
  it('caps a burst, reports the overflow count and does not replay it after restart', async () => {
    const f = fixture(mode);
    await f.poll();
    f.delivered.length = 0;
    for (let i = 0; i < 25; i++) f.comment(`burst-${i}`, `Fix burst finding ${i}.`);
    await f.poll();
    const comments = f.delivered.filter(n => n.kind === 'pull-request-activity');
    expect(comments).toHaveLength(10);
    expect(new Set(comments.map(n => n.coalesceKey)).size).toBe(10);
    expect(f.delivered.find(n => n.kind === 'pull-request-comments-collapsed')).toMatchObject({
      summary: expect.stringContaining('15 more authorized review comments'),
      attributes: expect.objectContaining({ commentCount: 25, collapsedCommentCount: 15 }),
    });
    f.restart();
    f.delivered.length = 0;
    await f.poll();
    expect(f.delivered).toHaveLength(0);
  }, 30_000);

  it('delivers a newly discovered identity at the same timestamp without replaying siblings', async () => {
    const f = fixture(mode);
    await f.poll();
    f.delivered.length = 0;
    f.comment('first', 'First finding.');
    await f.poll();
    expect(f.delivered.filter(n => n.kind === 'pull-request-activity')).toHaveLength(1);
    f.restart();
    f.delivered.length = 0;
    f.comment('second', 'Second finding.');
    await f.poll();
    expect(f.delivered.filter(n => n.kind === 'pull-request-activity').map(n => n.summary)).toEqual([
      expect.stringContaining('Second finding.'),
    ]);
  }, 30_000);

  it('authorizes each author, caches permission checks and keeps noisy bot messages hidden', async () => {
    const f = fixture(mode);
    await f.poll();
    f.delivered.length = 0;
    f.comment('outside', 'Untrusted finding.', undefined, 'outsider');
    f.comment('allowed', 'Maintainer finding.', undefined, 'maintainer');
    f.comment('allowed-2', 'Another maintainer finding.', undefined, 'maintainer');
    f.comment('noise', '## Review skipped\nNo actionable comments were generated.');
    await f.poll();
    const comments = f.delivered.filter(n => n.kind === 'pull-request-activity');
    expect(comments).toHaveLength(2);
    expect(comments.every(n => n.summary?.includes('maintainer'))).toBe(true);
    expect(f.permissionLookups.filter(user => user === 'maintainer')).toHaveLength(1);
    expect(f.permissionLookups).toContain('outsider');
  }, 30_000);

  it('delivers a reply on a previously observed resolved thread without re-delivering the first comment', async () => {
    const f = fixture(mode);
    f.inline([{ id: 'old', body: 'Old finding.', at: '2026-11-12T20:40:00Z' }]);
    await f.poll();
    f.delivered.length = 0;
    f.inline([
      { id: 'old', body: 'Old finding.', at: '2026-11-12T20:40:00Z' },
      { id: 'reply', body: 'Please also fix the reply case.', author: 'maintainer' },
    ]);
    f.sql('update pull_request_review_threads set is_resolved=1');
    await f.poll();
    const comments = f.delivered.filter(n => n.kind === 'pull-request-activity');
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({
      summary: expect.stringContaining(
        'maintainer commented on mastra-ai/mastra#29096 at src/index.ts:42: Please also fix the reply case.',
      ),
    });
  }, 30_000);
  it('delivers findings hidden behind a later edit to the CodeRabbit summary', async () => {
    const f = fixture(mode);
    f.comment('summary', 'Summary of the walkthrough', '2026-11-12T20:40:00Z');
    await f.poll();
    f.delivered.length = 0;
    f.comment('finding-1', 'Fix the missing authorization check.');
    f.comment('finding-2', 'Handle the rejected promise too.', '2026-11-12T20:41:54Z');
    f.sql("update comments set updated_at_gh='2026-11-12T20:41:56Z' where body='Summary of the walkthrough'");
    await f.poll();
    expect(f.delivered.map(n => n.summary).join('\n')).toContain('Fix the missing authorization check.');
    expect(f.delivered.map(n => n.summary).join('\n')).toContain('Handle the rejected promise too.');
    expect(f.delivered.map(n => n.summary).join('\n')).not.toContain('Summary of the walkthrough');
  }, 30_000);

  it('delivers inline comments and replies with author, file, line and text', async () => {
    const f = fixture(mode);
    await f.poll();
    f.delivered.length = 0;
    f.inline([
      { id: '1', body: 'Validate before writing.' },
      { id: '2', body: 'This also affects retries.', author: 'maintainer' },
    ]);
    await f.poll();
    const text = f.delivered.map(n => n.summary).join('\n');
    expect(text).toContain('coderabbitai[bot]');
    expect(text).toContain('src/index.ts:42');
    expect(text).toContain('Validate before writing.');
    expect(text).toContain('maintainer');
    expect(text).toContain('This also affects retries.');
    const findings = f.delivered.filter(n => n.kind === 'pull-request-activity');
    expect(new Set(findings.map(n => n.coalesceKey)).size).toBe(2);
    f.restart();
    f.delivered.length = 0;
    await f.poll();
    expect(f.delivered).toHaveLength(0);
  }, 30_000);

  it('delivers an authorized bot finding when CI is unknown', async () => {
    const f = fixture(mode);
    await f.poll();
    f.delivered.length = 0;
    f.comment('new', 'Fix this bug before merging.');
    await f.poll();
    expect(f.delivered.map(n => n.summary).join('\n')).toContain('Fix this bug before merging.');
  }, 30_000);
});

import { afterEach, describe, expect, it, vi } from 'vitest';

const execFileAsync = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  const execFile = () => undefined;
  Object.defineProperty(execFile, Symbol.for('nodejs.util.promisify.custom'), { value: execFileAsync });
  return { ...actual, execFile };
});

import { GitcrawlSyncClient } from './index.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('GitcrawlSyncClient review snapshots', () => {
  it('uses a submitted review timestamp when comment columns are empty', async () => {
    let commentsSql = '';
    execFileAsync.mockImplementation(async (file: string, args: string[]) => {
      if (file === 'gitcrawl') {
        return {
          stdout: JSON.stringify({
            threads: [
              {
                number: 24246,
                title: 'Authorize bot reviews',
                state: 'open',
                html_url: 'https://github.com/mastra-ai/mastra/pull/24246',
                updated_at_gh: '2026-09-17T05:18:20Z',
                content_hash: 'content-hash',
              },
            ],
          }),
          stderr: '',
        };
      }

      const sql = args[2] ?? '';
      if (sql.includes('select t.state')) {
        return { stdout: JSON.stringify([{ state: 'open' }]), stderr: '' };
      }
      if (sql.includes('select d.head_sha')) {
        return { stdout: JSON.stringify([{}]), stderr: '' };
      }
      if (sql.includes('from pull_request_checks')) {
        return { stdout: '[]', stderr: '' };
      }
      if (sql.includes('from pull_request_review_threads')) {
        return { stdout: JSON.stringify([{ unresolved_count: 0 }]), stderr: '' };
      }
      if (sql.includes('from comments c')) {
        commentsSql = sql;
        const supportsSubmittedReviews = sql.includes("json_extract(c.raw_json, '$.submitted_at')");
        return {
          stdout: JSON.stringify(
            supportsSubmittedReviews
              ? [
                  {
                    author_login: 'yoko-reviewer[bot]',
                    author_type: 'Bot',
                    is_bot: 1,
                    body: 'Net verdict from me: approve.',
                    html_url: 'https://github.com/mastra-ai/mastra/pull/24246#pullrequestreview-5231412913',
                    updated_at: '2026-09-17T05:18:20Z',
                  },
                ]
              : [],
          ),
          stderr: '',
        };
      }
      throw new Error(`Unexpected command: ${file} ${args.join(' ')}`);
    });

    const snapshot = await new GitcrawlSyncClient().getPullRequestSnapshot({
      owner: 'mastra-ai',
      repo: 'mastra',
      number: 24246,
    });

    expect(commentsSql).toContain("json_extract(c.raw_json, '$.submitted_at')");
    expect(snapshot).toMatchObject({
      latestCommentAuthor: 'yoko-reviewer[bot]',
      latestCommentIsBot: true,
      latestCommentBody: 'Net verdict from me: approve.',
      latestCommentUrl: 'https://github.com/mastra-ai/mastra/pull/24246#pullrequestreview-5231412913',
      latestCommentUpdatedAt: '2026-09-17T05:18:20Z',
    });
  });
});

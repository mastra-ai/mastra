import { describe, expect, it, vi } from 'vitest';

vi.mock('./acceptance-labels.js', () => ({
  resolveRepository: vi.fn(async () => ({ installationId: 9, slug: 'acme/app' })),
}));

import type { FactoryReviewStatusEvent } from '../../rules/dispatcher.js';
import { createGithubReviewStatusReporter } from './review-status-reporter.js';

const BOT = 'factory[bot]';
const HEAD = 'a'.repeat(40);
const REVIEWED = 'b'.repeat(40);
const startedAt = new Date('2026-11-05T10:00:00Z');

function card(metadata: Record<string, unknown>, type = 'pull-request') {
  return {
    id: 'item-1',
    externalSource: { integrationId: 'github', type, externalId: 'github-pr:7' },
    workItem: { metadata: { githubRepositoryId: 42, githubPullRequestNumber: 7 } },
    metadata: { pullRequestHeadSha: HEAD, ...metadata },
  };
}

function setup(item: ReturnType<typeof card> | null) {
  const comments: Array<{ id: string; author: string; body: string; createdAt: string }> = [];
  const versionControl = {
    listComments: vi.fn(async () => ({ comments: [...comments], nextCursor: null })),
    createComment: vi.fn(async ({ body }: { body: string }) => {
      const comment = { id: String(comments.length + 1), url: 'u', author: BOT, body, createdAt: '', updatedAt: '' };
      comments.push(comment);
      return comment;
    }),
    updateComment: vi.fn(async ({ commentId, body }: { commentId: string; body: string }) => {
      const comment = comments.find(entry => entry.id === commentId)!;
      comment.body = body;
      return comment;
    }),
    deleteComment: vi.fn(async () => {}),
    listReviewComments: vi.fn(async () => ({
      comments: [
        { id: 'r1', author: BOT, path: 'a.ts', replyToId: null, createdAt: '2026-11-05T10:01:00Z' },
        { id: 'r2', author: BOT, path: 'a.ts', replyToId: 'r1', createdAt: '2026-11-05T10:02:00Z' },
        { id: 'r3', author: BOT, path: 'b.ts', replyToId: null, createdAt: '2026-11-05T09:00:00Z' },
      ],
      nextCursor: null,
    })),
  };
  const report = createGithubReviewStatusReporter({
    github: { versionControl: versionControl as never, isFactoryCommentAuthor: login => login === BOT },
    sourceControl: {} as never,
    workItems: { get: async () => item as never },
    reviewerName: 'Shipyard',
    gifUrl: 'https://assets.test/reviewing.gif',
  });
  return { report, versionControl, comments };
}

function event(phase: FactoryReviewStatusEvent['phase'], extra: Partial<FactoryReviewStatusEvent> = {}) {
  return {
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    workItemId: 'item-1',
    run: 'decision-1',
    requestedAt: new Date('2026-11-05T09:59:00Z'),
    generation: 0,
    attempt: 1,
    phase,
    ...extra,
  } satisfies FactoryReviewStatusEvent;
}

describe('createGithubReviewStatusReporter', () => {
  it('reports measured stats and the verdict this run recorded', async () => {
    const { report, comments } = setup(
      card({ reviewVerdict: 'request changes', reviewedHeadSha: REVIEWED, reviewedAt: '2026-11-05T10:03:00Z' }),
    );
    await report(event('reviewing', { startedAt }));
    expect(comments[0]!.body).toContain('Shipyard is reviewing this pull request');
    expect(comments[0]!.body).toContain('aaaaaaa');

    await report(event('completed', { endedAt: new Date('2026-11-05T10:04:05Z') }));
    const body = comments[0]!.body;
    expect(body).toContain('Review complete: changes requested');
    expect(body).toContain('bbbbbbb');
    expect(body).toContain('4m 5s');
    // r1 only: r2 is a reply, r3 predates this run.
    expect(body).toContain('1 across 1 file');
  });

  it('does not claim an older verdict as this run’s', async () => {
    const { report, comments } = setup(
      card({ reviewVerdict: 'approve', reviewedHeadSha: REVIEWED, reviewedAt: '2026-11-04T10:00:00Z' }),
    );
    await report(event('reviewing', { startedAt }));
    await report(event('completed', { endedAt: new Date('2026-11-05T10:01:00Z') }));
    expect(comments[0]!.body).toContain('Review finished');
    expect(comments[0]!.body).not.toContain('approved');
    expect(comments[0]!.body).not.toContain('bbbbbbb');
  });

  it('skips cards that are not GitHub pull requests and swallows provider errors', async () => {
    const issue = setup(card({}, 'issue'));
    await issue.report(event('queued'));
    expect(issue.versionControl.listComments).not.toHaveBeenCalled();

    const down = setup(card({}));
    down.versionControl.listComments.mockRejectedValueOnce(new Error('502'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(down.report(event('queued'))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

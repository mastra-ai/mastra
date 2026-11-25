import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./acceptance-labels.js', () => ({
  resolveRepository: vi.fn(async () => ({ installationId: 9, slug: 'acme/app' })),
}));

import type { FactoryReviewStatusEvent } from '../../rules/dispatcher.js';
import {
  createGithubReviewStatusReporter,
  DEFAULT_REVIEW_STATUS_GIF_DARK_URL,
  DEFAULT_REVIEW_STATUS_GIF_URL,
  reviewStatusAnimationFromEnv,
} from './review-status-reporter.js';

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

function setup(
  item: ReturnType<typeof card> | null,
  options: {
    checks?: boolean;
    checkError?: Error | ((input: Record<string, unknown>) => Error | undefined);
    now?: () => number;
  } = {},
) {
  const checks: Array<Record<string, unknown>> = [];
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
    ...(options.checks
      ? {
          publishCommitCheck: vi.fn(async (input: Record<string, unknown>) => {
            const error = typeof options.checkError === 'function' ? options.checkError(input) : options.checkError;
            if (error) throw error;
            checks.push(input);
            return {
              id: String(checks.length),
              name: input.name,
              headSha: input.headSha,
              status: input.status,
              url: null,
            };
          }),
        }
      : {}),
  };
  const report = createGithubReviewStatusReporter({
    github: { versionControl: versionControl as never, isFactoryCommentAuthor: login => login === BOT },
    sourceControl: {} as never,
    workItems: { get: async () => item as never },
    reviewerName: 'Shipyard',
    ...(options.now ? { now: options.now } : {}),
    gifUrl: 'https://assets.test/reviewing.gif',
    gifDarkUrl: 'https://assets.test/reviewing-dark.gif',
  });
  return { report, versionControl, comments, checks };
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
    expect(comments[0]!.body).toContain(
      '<source media="(prefers-color-scheme: dark)" srcset="https://assets.test/reviewing-dark.gif">',
    );
    expect(comments[0]!.body).toContain('<img src="https://assets.test/reviewing.gif"');

    await report(event('completed', { endedAt: new Date('2026-11-05T10:04:05Z') }));
    const body = comments[0]!.body;
    expect(body).toContain('Review complete: changes requested');
    expect(body).toContain(
      `<sub>Reviewed [\`bbbbbbb\`](https://github.com/acme/app/commit/${REVIEWED}) · took 4m 5s</sub>`,
    );
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
    expect(comments[0]!.body).toContain(
      '<sub>Started on [`aaaaaaa`](https://github.com/acme/app/commit/' + 'a'.repeat(40) + ') · took 1m 0s</sub>',
    );
    expect(comments[0]!.body).not.toContain('Reviewed');
  });

  it('shows the verdict that covered a queued re-review, which never started a run of its own', async () => {
    const { report, comments } = setup(
      card({ reviewVerdict: 'request changes', reviewedHeadSha: REVIEWED, reviewedAt: '2026-11-05T10:03:00Z' }),
    );
    await report(event('queued'));
    expect(comments[0]!.body).toContain('Review queued');

    const requestedAt = event('queued').requestedAt;
    await report(event('completed', { startedAt: requestedAt, endedAt: new Date('2026-11-05T10:03:00Z') }));
    expect(comments).toHaveLength(1);
    expect(comments[0]!.body).toContain('Review complete: changes requested');
    expect(comments[0]!.body).toContain(
      `<sub>Reviewed [\`bbbbbbb\`](https://github.com/acme/app/commit/${REVIEWED}) · took 4m 0s</sub>`,
    );
  });

  it('reports on the pull request attached to an issue card', async () => {
    const issue = {
      id: 'item-1',
      externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:3' },
      workItem: {
        metadata: { githubRepositoryId: 42, githubIssueNumber: 3 },
        sources: [
          { integrationId: 'github', sourceType: 'issue', externalId: 'issue:github-issue:3', metadata: {} },
          {
            integrationId: 'github',
            sourceType: 'pull-request',
            externalId: 'pull-request:github-pr:7',
            state: 'open',
            metadata: { githubRepositoryId: 42, githubPullRequestNumber: 7 },
          },
        ],
      },
      metadata: { pullRequestHeadSha: HEAD, openPullRequestNumber: 7 },
    };
    const { report, comments, versionControl } = setup(issue as never);
    await report(event('reviewing', { startedAt }));
    expect(versionControl.createComment).toHaveBeenCalledWith(expect.objectContaining({ pullRequestId: '7' }));
    expect(comments[0]!.body).toContain('Shipyard is reviewing this pull request');
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

describe('the review check', () => {
  const NEWER = 'c'.repeat(40);
  const verdict = { reviewVerdict: 'approve', reviewedHeadSha: HEAD, reviewedAt: '2026-11-05T10:03:00Z' };
  const summary = (checks: Array<Record<string, unknown>>) =>
    checks.map(check => [check.status, check.headSha, check.title]);

  it('follows a run from queued to approved in the Checks tab', async () => {
    const { report, checks } = setup(card(verdict), { checks: true });

    await report(event('queued'));
    await report(event('reviewing', { startedAt }));
    await report(event('completed', { startedAt, endedAt: new Date('2026-11-05T10:04:00Z') }));

    expect(summary(checks)).toEqual([
      ['in-progress', HEAD, 'Review queued'],
      ['in-progress', HEAD, 'Reviewing'],
      ['success', HEAD, 'Approved'],
    ]);
    expect(checks.every(check => check.name === 'Shipyard review')).toBe(true);
    expect(checks[2]).toMatchObject({
      connection: { type: 'app-installation', installationId: 9, orgId: 'org-1' },
      sourceId: 'acme/app',
    });
    expect(checks[2]!.summary).toContain('Took 4m 0s');
    expect(checks[2]!.summary).toContain('(u)');
  });

  it.each([
    ['request changes', 'Changes requested'],
    [undefined, 'Review finished'],
  ])('never fails the check for a finished review (verdict %s)', async (reviewVerdict, title) => {
    const { report, checks } = setup(
      card({ reviewVerdict, reviewedHeadSha: HEAD, reviewedAt: '2026-11-05T10:03:00Z' }),
      { checks: true },
    );
    await report(event('reviewing', { startedAt }));
    await report(event('completed', { startedAt, endedAt: new Date('2026-11-05T10:04:00Z') }));

    expect(checks.at(-1)).toMatchObject({ status: 'neutral', title });
  });

  it('keeps a failed or cancelled run from failing a required check', async () => {
    const { report, checks } = setup(card({}), { checks: true });
    await report(event('reviewing', { startedAt }));
    await report(event('retrying', { attempt: 2, generation: 1, reason: 'model timed out' }));
    await report(event('failed', { attempt: 2, generation: 1, reason: 'model timed out', endedAt: new Date() }));

    expect(summary(checks.slice(1))).toEqual([
      ['in-progress', HEAD, 'Retrying the review (attempt 2)'],
      ['neutral', HEAD, 'Review failed'],
    ]);
    expect(checks[2]!.summary).toContain('model timed out');

    const cancelled = setup(card({}), { checks: true });
    await cancelled.report(event('reviewing', { startedAt }));
    await cancelled.report(event('cancelled', { startedAt, endedAt: new Date() }));
    expect(cancelled.checks.at(-1)).toMatchObject({ status: 'neutral', title: 'Review cancelled' });
  });

  it('ends a run on the commit its check is on, not a head pushed since', async () => {
    const item = card({});
    const { report, checks } = setup(item, { checks: true });
    await report(event('queued'));
    item.metadata.pullRequestHeadSha = NEWER;
    await report(event('cancelled', { endedAt: new Date() }));

    expect(summary(checks)).toEqual([
      ['in-progress', HEAD, 'Review queued'],
      ['neutral', HEAD, 'Review cancelled'],
    ]);
  });

  it('closes the check a run left on an older commit when it moves to a newer one', async () => {
    const item = card({ reviewVerdict: 'approve', reviewedHeadSha: NEWER, reviewedAt: '2026-11-05T10:03:00Z' });
    const { report, checks } = setup(item, { checks: true });
    await report(event('reviewing', { startedAt }));
    item.metadata.pullRequestHeadSha = NEWER;
    await report(event('completed', { startedAt, endedAt: new Date('2026-11-05T10:04:00Z') }));

    expect(summary(checks)).toEqual([
      ['in-progress', HEAD, 'Reviewing'],
      ['success', NEWER, 'Approved'],
      ['skipped', HEAD, 'Moved to another commit'],
    ]);
  });

  it('closes the check of a run a newer one replaced, even when the older run never reports its end', async () => {
    const item = card({});
    const { report, checks } = setup(item, { checks: true });
    await report(event('reviewing', { startedAt }));
    item.metadata.pullRequestHeadSha = NEWER;
    await report(event('queued', { run: 'decision-2', requestedAt: new Date('2026-11-05T10:01:00Z') }));
    // The older run's end is stale against the newer run's comment.
    await report(event('cancelled', { startedAt, endedAt: new Date() }));

    expect(summary(checks)).toEqual([
      ['in-progress', HEAD, 'Reviewing'],
      ['in-progress', NEWER, 'Review queued'],
      ['skipped', HEAD, 'Superseded by a newer review'],
    ]);
  });

  it("closes a replaced run's check even when the pull request head is unknown", async () => {
    const item = card({});
    const { report, checks } = setup(item, { checks: true });
    await report(event('reviewing', { startedAt }));
    item.metadata.pullRequestHeadSha = null;
    await report(event('queued', { run: 'decision-2', requestedAt: new Date('2026-11-05T10:01:00Z') }));

    expect(summary(checks)).toEqual([
      ['in-progress', HEAD, 'Reviewing'],
      ['skipped', HEAD, 'Superseded by a newer review'],
    ]);
  });

  it('closes the check of an attempt a retry moved to a newer commit', async () => {
    const item = card({});
    const { report, checks } = setup(item, { checks: true });
    await report(event('reviewing', { startedAt }));
    item.metadata.pullRequestHeadSha = NEWER;
    await report(event('retrying', { attempt: 2, generation: 1, reason: 'model timed out' }));

    expect(summary(checks)).toEqual([
      ['in-progress', HEAD, 'Reviewing'],
      ['in-progress', NEWER, 'Retrying the review (attempt 2)'],
      ['skipped', HEAD, 'Moved to another commit'],
    ]);
  });

  it('still publishes the check when closing the one on the older commit fails', async () => {
    const item = card({});
    const { report, checks } = setup(item, {
      checks: true,
      checkError: input => (input.status === 'skipped' ? new Error('network down') : undefined),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await report(event('reviewing', { startedAt }));
    item.metadata.pullRequestHeadSha = NEWER;
    await report(event('queued', { run: 'decision-2', requestedAt: new Date('2026-11-05T10:01:00Z') }));
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();

    expect(summary(checks).at(-1)).toEqual(['in-progress', NEWER, 'Review queued']);
  });

  it('publishes no check for a step the comment refused as stale', async () => {
    const { report, checks } = setup(card({}), { checks: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await report(event('reviewing', { startedAt, run: 'decision-2', requestedAt: new Date('2026-11-05T10:00:00Z') }));
    await report(event('queued'));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();

    expect(checks).toHaveLength(1);
    expect(checks[0]!.title).toBe('Reviewing');
  });

  it('keeps the comment when the check cannot be published', async () => {
    const { report, comments } = setup(card({}), { checks: true, checkError: new Error('network down') });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await report(event('reviewing', { startedAt }));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('could not publish the review check'),
      expect.objectContaining({ message: 'network down' }),
    );
    warn.mockRestore();

    expect(comments).toHaveLength(1);
    expect(comments[0]!.body).toContain('Shipyard is reviewing this pull request');
  });

  it('stops publishing in-progress checks for an hour once an installation refuses them, but still ends reviews', async () => {
    let now = 0;
    const refused = Object.assign(new Error('Resource not accessible by integration'), { status: 403 });
    const { report, versionControl } = setup(card({}), { checks: true, checkError: refused, now: () => now });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await report(event('queued'));
    await report(event('reviewing', { startedAt }));
    expect(versionControl.publishCommitCheck).toHaveBeenCalledTimes(1);
    await report(event('cancelled', { startedAt, endedAt: new Date() }));
    expect(versionControl.publishCommitCheck).toHaveBeenCalledTimes(2);

    await report(event('queued', { run: 'decision-2', requestedAt: new Date('2026-11-05T10:05:00Z') }));
    expect(versionControl.publishCommitCheck).toHaveBeenCalledTimes(2);
    now += 60 * 60 * 1000 + 1;
    await report(event('reviewing', { startedAt, run: 'decision-2', requestedAt: new Date('2026-11-05T10:05:00Z') }));
    expect(versionControl.publishCommitCheck).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it("pauses in-progress checks when a self-managed app lacks the 'checks: write' permission", async () => {
    const missing = new Error(
      'github cannot publish commit checks: the GitHub App lacks the "checks: write" permission; nothing was published.',
    );
    const { report, versionControl } = setup(card({}), { checks: true, checkError: missing });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await report(event('queued'));
    await report(event('reviewing', { startedAt }));
    expect(versionControl.publishCommitCheck).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('keeps publishing checks after a rate-limit refusal', async () => {
    const limited = Object.assign(new Error('API rate limit exceeded for installation'), { status: 403 });
    const { report, versionControl } = setup(card({}), { checks: true, checkError: limited });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await report(event('queued'));
    await report(event('reviewing', { startedAt }));
    expect(versionControl.publishCommitCheck).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe('reviewStatusAnimationFromEnv', () => {
  it('serves both theme variants from the repository by default', () => {
    expect(reviewStatusAnimationFromEnv({})).toEqual({
      gifUrl: DEFAULT_REVIEW_STATUS_GIF_URL,
      gifDarkUrl: DEFAULT_REVIEW_STATUS_GIF_DARK_URL,
    });
    for (const url of [DEFAULT_REVIEW_STATUS_GIF_URL, DEFAULT_REVIEW_STATUS_GIF_DARK_URL]) {
      const path = url.split('/mastra-ai/mastra/main/mastracode/factory/')[1]!;
      expect(existsSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)))).toBe(true);
    }
  });

  it('never pairs a self-hosted image with a stock variant', () => {
    expect(reviewStatusAnimationFromEnv({ FACTORY_REVIEW_STATUS_GIF_URL: ' https://a.test/l.gif ' })).toEqual({
      gifUrl: 'https://a.test/l.gif',
    });
    expect(
      reviewStatusAnimationFromEnv({
        FACTORY_REVIEW_STATUS_GIF_URL: 'https://a.test/l.gif',
        FACTORY_REVIEW_STATUS_GIF_DARK_URL: 'https://a.test/d.gif',
      }),
    ).toEqual({ gifUrl: 'https://a.test/l.gif', gifDarkUrl: 'https://a.test/d.gif' });
    expect(reviewStatusAnimationFromEnv({ FACTORY_REVIEW_STATUS_GIF_DARK_URL: 'https://a.test/d.gif' })).toEqual({
      gifUrl: DEFAULT_REVIEW_STATUS_GIF_URL,
      gifDarkUrl: DEFAULT_REVIEW_STATUS_GIF_DARK_URL,
    });
  });
});

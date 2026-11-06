import { describe, expect, it } from 'vitest';
import type { PullRequestComment, PullRequestRef } from '../../capabilities/version-control.js';
import {
  parseReviewStatusState,
  renderReviewStatusComment,
  REVIEW_STATUS_COMMENT_MARKER,
} from './review-status-comment.js';
import type { ReviewStatusState } from './review-status-comment.js';
import { publishReviewStatus } from './review-status.js';
import type { ReviewStatusStep } from './review-status.js';

const ref: PullRequestRef = {
  connection: { type: 'app-installation', installationId: 1 },
  sourceId: 'acme/app',
  pullRequestId: '7',
};
const BOT = 'factory[bot]';
const isFactory = (login: string | null | undefined) => login === BOT;

function fakeComments(initial: PullRequestComment[] = [], pageSize = 2) {
  let comments = [...initial];
  let nextId = 1000;
  const calls = { created: 0, updated: 0, deleted: [] as string[] };
  const port = {
    async listComments({ cursor }: { cursor?: string }) {
      const start = Number(cursor ?? 0);
      const page = comments.slice(start, start + pageSize);
      return { comments: page, nextCursor: start + pageSize < comments.length ? String(start + pageSize) : null };
    },
    async createComment({ body }: { body: string }) {
      calls.created++;
      const comment = comment_(String(nextId++), BOT, body);
      comments.push(comment);
      return comment;
    },
    async updateComment({ commentId, body }: { commentId: string; body: string }) {
      calls.updated++;
      comments = comments.map(comment => (comment.id === commentId ? { ...comment, body } : comment));
      return comments.find(comment => comment.id === commentId)!;
    },
    async deleteComment({ commentId }: { commentId: string }) {
      calls.deleted.push(commentId);
      comments = comments.filter(comment => comment.id !== commentId);
    },
  };
  return { port: port as never, calls, all: () => comments };
}

function comment_(id: string, author: string, body: string): PullRequestComment {
  return {
    id,
    url: `https://github.test/c/${id}`,
    author,
    body,
    createdAt: '2026-11-05T10:00:00Z',
    updatedAt: '2026-11-05T10:00:00Z',
  };
}

function state(overrides: Partial<ReviewStatusState> = {}): ReviewStatusState {
  return {
    run: 'decision-1',
    requestedAt: '2026-11-05T10:00:00.000Z',
    generation: 0,
    attempt: 1,
    phase: 'queued',
    ...overrides,
  };
}

function step(overrides: Partial<ReviewStatusState> = {}, extra: Partial<ReviewStatusStep> = {}): ReviewStatusStep {
  return { state: state(overrides), reviewerName: 'Shipyard', gifUrl: 'https://example.test/r.gif', ...extra };
}

function existing(id: string, recorded: ReviewStatusState, author = BOT): PullRequestComment {
  return comment_(id, author, renderReviewStatusComment({ state: recorded, reviewerName: 'Shipyard', gifUrl: 'x' }));
}

describe('publishReviewStatus', () => {
  it('creates the comment on the first step', async () => {
    const store = fakeComments([comment_('1', 'human', 'hello')]);
    const result = await publishReviewStatus(store.port, ref, step(), isFactory);
    expect(result).toMatchObject({ action: 'created' });
    expect(store.all()).toHaveLength(2);
  });

  it('edits the same comment in place through the run', async () => {
    const store = fakeComments();
    await publishReviewStatus(store.port, ref, step(), isFactory);
    await publishReviewStatus(
      store.port,
      ref,
      step({ phase: 'reviewing', startedAt: '2026-11-05T10:01:00.000Z', head: 'c'.repeat(40) }),
      isFactory,
    );
    let seenStartedAt: string | undefined;
    const result = await publishReviewStatus(
      store.port,
      ref,
      step(
        { phase: 'completed' },
        {
          stats: async recorded => {
            seenStartedAt = recorded.startedAt;
            return { verdict: 'approve', durationMs: 60_000 };
          },
        },
      ),
      isFactory,
    );
    expect(result).toMatchObject({ action: 'updated' });
    expect(store.calls).toMatchObject({ created: 1, updated: 2 });
    expect(seenStartedAt).toBe('2026-11-05T10:01:00.000Z');
    const [only] = store.all();
    expect(only!.body).toContain('Review complete: approved');
    expect(parseReviewStatusState(only!.body)).toMatchObject({ phase: 'completed', head: 'c'.repeat(40) });
  });

  it('drops a duplicate delivery of a step it already shows', async () => {
    const store = fakeComments([existing('5', state({ phase: 'reviewing' }))]);
    const result = await publishReviewStatus(store.port, ref, step({ phase: 'reviewing' }), isFactory);
    expect(result).toEqual({ action: 'stale', commentId: '5' });
    expect(store.calls.updated).toBe(0);
  });

  it('drops a late completion from an older run after a re-review took over', async () => {
    const newer = state({ run: 'decision-2', requestedAt: '2026-11-05T11:00:00.000Z', phase: 'reviewing' });
    const store = fakeComments([existing('5', newer)]);
    let statsRead = false;
    const result = await publishReviewStatus(
      store.port,
      ref,
      step({ phase: 'completed' }, { stats: async () => ((statsRead = true), {}) }),
      isFactory,
    );
    expect(result).toEqual({ action: 'stale', commentId: '5' });
    expect(statsRead).toBe(false);
    expect(parseReviewStatusState(store.all()[0]!.body)).toEqual(newer);
  });

  it('starts a new attempt clean so it never reports an earlier attempt’s timing', async () => {
    const startedAt = '2026-11-05T10:01:00.000Z';
    const store = fakeComments([existing('5', state({ phase: 'reviewing', startedAt, head: 'c'.repeat(40) }))]);
    await publishReviewStatus(store.port, ref, step({ generation: 1, attempt: 2, phase: 'queued' }), isFactory);
    expect(parseReviewStatusState(store.all()[0]!.body)?.startedAt).toBeUndefined();

    // A re-claim that dies before it posts queued must not inherit the lost attempt's start either.
    const lost = fakeComments([existing('5', state({ phase: 'reviewing', startedAt, head: 'c'.repeat(40) }))]);
    let seen: ReviewStatusState | undefined;
    await publishReviewStatus(
      lost.port,
      ref,
      step({ attempt: 2, phase: 'failed' }, { stats: async recorded => ((seen = recorded), {}) }),
      isFactory,
    );
    expect(seen?.startedAt).toBeUndefined();
    expect(seen?.head).toBeUndefined();
  });

  it('keeps the start time when a re-claim only ends the run an earlier attempt started', async () => {
    const startedAt = '2026-11-05T10:01:00.000Z';
    const store = fakeComments([existing('5', state({ phase: 'reviewing', startedAt, head: 'c'.repeat(40) }))]);
    let seen: ReviewStatusState | undefined;
    await publishReviewStatus(
      store.port,
      ref,
      step(
        { attempt: 2, phase: 'completed' },
        { continuesRun: true, stats: async recorded => ((seen = recorded), {}) },
      ),
      isFactory,
    );
    expect(seen).toMatchObject({ attempt: 2, phase: 'completed', startedAt, head: 'c'.repeat(40) });
    expect(store.all()[0]!.body).not.toContain('continuesRun');
  });

  it('lets a re-review take over the comment and forget the old start time', async () => {
    const store = fakeComments([existing('5', state({ phase: 'completed', startedAt: '2026-11-05T10:01:00.000Z' }))]);
    await publishReviewStatus(
      store.port,
      ref,
      step({ run: 'decision-2', requestedAt: '2026-11-05T11:00:00.000Z' }),
      isFactory,
    );
    const recorded = parseReviewStatusState(store.all()[0]!.body);
    expect(recorded).toMatchObject({ run: 'decision-2', phase: 'queued' });
    expect(recorded?.startedAt).toBeUndefined();
  });

  it('keeps the oldest Factory comment and deletes duplicates from a creation race', async () => {
    const store = fakeComments([
      existing('9', state()),
      existing('3', state()),
      existing('4', state(), 'someone-else'),
      comment_('6', BOT, 'unrelated factory comment'),
    ]);
    await publishReviewStatus(store.port, ref, step({ phase: 'reviewing' }), isFactory);
    expect(store.calls.deleted).toEqual(['9']);
    expect(store.all().map(comment => comment.id)).toEqual(['3', '4', '6']);
    expect(parseReviewStatusState(store.all()[0]!.body)?.phase).toBe('reviewing');
    expect(store.all()[1]!.body).toContain(REVIEW_STATUS_COMMENT_MARKER);
  });

  it('does not open a comment just to say a run that never showed progress was cancelled or finished', async () => {
    const store = fakeComments();
    expect(await publishReviewStatus(store.port, ref, step({ phase: 'cancelled' }), isFactory)).toEqual({
      action: 'skipped',
    });
    expect(await publishReviewStatus(store.port, ref, step({ phase: 'completed' }), isFactory)).toEqual({
      action: 'skipped',
    });
    expect(store.calls.created).toBe(0);
    await publishReviewStatus(store.port, ref, step({ phase: 'failed' }), isFactory);
    expect(store.calls.created).toBe(1);
  });
});

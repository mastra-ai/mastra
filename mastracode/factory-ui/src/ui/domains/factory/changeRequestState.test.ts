import { describe, expect, it } from 'vitest';

import { changeRequestStatus } from './changeRequestState';
import type { CardChangeRequest } from './changeRequestState';
import type { PullRequestSubscription } from './services/githubSubscriptions';

const URL_42 = 'https://github.com/acme/app/pull/42';

function request(overrides: Partial<CardChangeRequest> = {}): CardChangeRequest {
  return {
    url: URL_42,
    provider: 'github',
    number: 42,
    state: 'open',
    metadata: {},
    syncedAt: Date.parse('2026-07-20T10:00:00.000Z'),
    ...overrides,
  };
}

function subscription(status: PullRequestSubscription['status'], updatedAt?: string): PullRequestSubscription {
  return { id: 'subscription-42', repoFullName: 'Acme/App', pullRequestNumber: 42, status, url: URL_42, updatedAt };
}

describe('changeRequestStatus', () => {
  it('reads the source alone when no subscription matches', () => {
    expect(changeRequestStatus(request())).toBe('open');
    expect(changeRequestStatus(request({ metadata: { draft: true } }))).toBe('draft');
    expect(changeRequestStatus(request({ provider: 'gitlab', state: 'opened' }))).toBe('open');
    expect(changeRequestStatus(request({ state: 'closed' }))).toBe('closed');
  });

  it('leaves an unknown state unknown, never guessing open or from the board stage', () => {
    expect(changeRequestStatus(request({ state: undefined, syncedAt: undefined }))).toBeUndefined();
  });

  it('takes the subscription when the source never said', () => {
    expect(
      changeRequestStatus(request({ state: undefined, syncedAt: undefined }), [
        subscription('open', '2026-07-19T10:00:00.000Z'),
      ]),
    ).toBe('open');
  });

  it('takes the subscription when it heard from the code host after the source synced', () => {
    expect(changeRequestStatus(request(), [subscription('closed', '2026-07-21T10:00:00.000Z')])).toBe('closed');
  });

  it('keeps the source when it synced after the subscription', () => {
    expect(changeRequestStatus(request(), [subscription('closed', '2026-07-19T10:00:00.000Z')])).toBe('open');
  });

  it('takes the subscription of an older server, which sends no update time', () => {
    expect(changeRequestStatus(request(), [subscription('closed')])).toBe('closed');
  });

  it('treats a merge as final, whichever side heard of it', () => {
    expect(changeRequestStatus(request({ state: 'merged' }), [subscription('open', '2026-07-21T10:00:00.000Z')])).toBe(
      'merged',
    );
    expect(changeRequestStatus(request(), [subscription('merged', '2026-07-19T10:00:00.000Z')])).toBe('merged');
  });

  it('keeps a known close when subscribing again reopens the subscription', () => {
    expect(changeRequestStatus(request({ state: 'closed' }), [subscription('open', '2026-07-21T10:00:00.000Z')])).toBe(
      'closed',
    );
  });

  it('keeps a draft through an open subscription', () => {
    expect(
      changeRequestStatus(request({ metadata: { draft: true } }), [subscription('open', '2026-07-21T10:00:00.000Z')]),
    ).toBe('draft');
  });

  it('hears a subscription whose URL differs only by a trailing slash or letter case', () => {
    expect(
      changeRequestStatus(request({ url: 'https://github.com/Acme/App/pull/42/' }), [
        subscription('merged', '2026-07-21T10:00:00.000Z'),
      ]),
    ).toBe('merged');
  });

  it("never takes another repository's status for a request without a URL that shares its number", () => {
    const otherRepository = {
      ...subscription('merged', '2026-07-21T10:00:00.000Z'),
      repoFullName: 'acme/docs',
      url: 'https://github.com/acme/docs/pull/42',
    };
    expect(changeRequestStatus(request({ url: undefined }), [otherRepository])).toBe('open');
    expect(changeRequestStatus(request({ url: undefined, state: undefined }), [otherRepository])).toBeUndefined();
  });
});

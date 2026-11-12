import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { Card } from '../storage/domains/work-items/base.js';
import { boardSnapshot, hashedBody, matchesEtag, scopedSnapshot } from './board-snapshot.js';

/** The validator a browser sends back. A collision here would answer 304 for a board that changed. */
function cacheDigest(text: string): string {
  return createHash('sha256').update(text).digest('base64url');
}

const noCards: readonly Card[] = [];

describe('board listing cache validators', () => {
  it('names an activity answer with SHA-256 so a changed body is not a 304', () => {
    const body = { created: 2, completed: 1 };
    const json = JSON.stringify(body);
    const answer = hashedBody(body);

    expect(answer.json).toBe(json);
    expect(answer.etag).toBe(`W/"${cacheDigest(json)}"`);
    expect(matchesEtag(answer.etag, answer.etag)).toBe(true);
    // A client that stored the validator without the weak prefix still matches.
    expect(matchesEtag(`"${cacheDigest(json)}"`, answer.etag)).toBe(true);
    expect(hashedBody({ created: 3, completed: 1 }).etag).not.toBe(answer.etag);
  });

  it('changes the scoped listing validator when session activity changes and the cards do not', () => {
    const cardsJson = JSON.stringify(noCards.map(card => card));
    const rest = JSON.stringify({ runningSessionIds: ['session-a'], parkedSessionIds: [] as string[] });
    const listing = scopedSnapshot(noCards, card => card, ['session-a'], []);

    expect(listing.etag).toBe(`W/"${cacheDigest(cardsJson)}.${cacheDigest(rest)}"`);
    expect(scopedSnapshot(noCards, card => card, ['session-b'], []).etag).not.toBe(listing.etag);
    expect(matchesEtag(listing.etag, listing.etag)).toBe(true);
  });

  it('includes running and parked sessions in the full-board validator', () => {
    const rest = JSON.stringify({
      runningSessionIds: ['session-a'],
      parkedSessionIds: ['session-b'],
      cursor: 'cursor-1',
    });
    const listing = boardSnapshot(noCards, card => card, ['session-a'], ['session-b'], 'cursor-1');

    expect(listing.etag.startsWith('W/"')).toBe(true);
    expect(listing.etag.endsWith(`.${cacheDigest(rest)}"`)).toBe(true);
    expect(listing.json).toContain('"runningSessionIds":["session-a"]');
  });
});

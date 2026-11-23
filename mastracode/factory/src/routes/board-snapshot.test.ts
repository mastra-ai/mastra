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

  it('changes the scoped listing validator when the total changes and the cards do not', () => {
    const cardsJson = JSON.stringify(noCards.map(card => card));
    const listing = scopedSnapshot(noCards, card => card, 3);

    expect(listing.etag).toBe(`W/"${cacheDigest(cardsJson)}.${cacheDigest(JSON.stringify({ total: 3 }))}"`);
    expect(scopedSnapshot(noCards, card => card, 4).etag).not.toBe(listing.etag);
    expect(matchesEtag(listing.etag, listing.etag)).toBe(true);
  });

  it('answers a scoped listing with nothing beside the cards as JSON', () => {
    expect(JSON.parse(scopedSnapshot(noCards, card => card).json)).toEqual({ workItems: [] });
  });

  it('includes the cursor in the full-board validator', () => {
    const listing = boardSnapshot(noCards, card => card, 'cursor-1');

    expect(listing.etag.startsWith('W/"')).toBe(true);
    expect(listing.etag.endsWith(`.${cacheDigest(JSON.stringify({ cursor: 'cursor-1' }))}"`)).toBe(true);
    expect(JSON.parse(listing.json)).toEqual({ workItems: [], cursor: 'cursor-1' });
  });
});

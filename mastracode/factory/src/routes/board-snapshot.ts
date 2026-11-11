import { createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip as gzipCallback } from 'node:zlib';

import type { Card } from '../storage/domains/work-items/base.js';

const gzip = promisify(gzipCallback);

interface CardsJson {
  /** Names the cards in the ETag. */
  id: string;
  json: string;
  latest?: BoardSnapshot;
}

export interface BoardSnapshot {
  etag: string;
  json: string;
  gzipped(): Promise<Buffer>;
}

// Keyed on the list a caller keeps per board version: `listShared` returns one frozen array until
// a card changes, so a new version or an evicted list drops its entry with it.
const cardsJson = new WeakMap<readonly Card[], CardsJson>();

/**
 * The listing's wire body for one board version and its run activity. Every tab
 * polling an unchanged board shares one serialization and one gzip, and its
 * ETag lets the browser revalidate instead of downloading the board again.
 */
export function boardSnapshot(
  items: readonly Card[],
  toWire: (item: Card) => unknown,
  runningSessionIds: readonly string[],
  parkedSessionIds: readonly string[],
): BoardSnapshot {
  // Random per cached list, so an ETag from before a restart never matches a different board.
  return snapshot(items, toWire, runningSessionIds, parkedSessionIds, () => randomUUID());
}

/**
 * The wire body for the cards a scoped listing picked. Its ETag names the cards by a hash of
 * their body, not by the board version: a write to a card outside the scope leaves it unchanged,
 * so the tab gets a 304. A caller that passes the same list again shares its serialization.
 */
export function scopedSnapshot(
  items: readonly Card[],
  toWire: (item: Card) => unknown,
  runningSessionIds: readonly string[],
  parkedSessionIds: readonly string[],
): BoardSnapshot {
  return snapshot(items, toWire, runningSessionIds, parkedSessionIds, sha1);
}

function snapshot(
  items: readonly Card[],
  toWire: (item: Card) => unknown,
  runningSessionIds: readonly string[],
  parkedSessionIds: readonly string[],
  cardsId: (json: string) => string,
): BoardSnapshot {
  let cards = cardsJson.get(items);
  if (!cards) {
    const json = JSON.stringify(items.map(toWire));
    cards = { id: cardsId(json), json };
    cardsJson.set(items, cards);
  }
  const etag = `W/"${cards.id}.${sha1(JSON.stringify([runningSessionIds, parkedSessionIds]))}"`;
  if (cards.latest?.etag === etag) return cards.latest;

  const json = listingJson(cards.json, runningSessionIds, parkedSessionIds);
  let gzipped: Promise<Buffer> | undefined;
  // zlib runs on the libuv pool, off the event loop.
  cards.latest = { etag, json, gzipped: () => (gzipped ??= gzip(json)) };
  return cards.latest;
}

function sha1(text: string): string {
  return createHash('sha1').update(text).digest('base64url');
}

function listingJson(cards: string, runningSessionIds: readonly string[], parkedSessionIds: readonly string[]): string {
  return `{"workItems":${cards},"runningSessionIds":${JSON.stringify(runningSessionIds)},"parkedSessionIds":${JSON.stringify(parkedSessionIds)}}`;
}

/** Whether an `If-None-Match` header names this ETag (weak comparison, as for GET). */
export function matchesEtag(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const bare = (tag: string) => tag.trim().replace(/^W\//, '');
  return ifNoneMatch.split(',').some(tag => tag.trim() === '*' || bare(tag) === bare(etag));
}

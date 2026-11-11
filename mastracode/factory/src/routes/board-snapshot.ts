import { createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip as gzipCallback } from 'node:zlib';

import type { Card } from '../storage/domains/work-items/base.js';

const gzip = promisify(gzipCallback);

interface CardsJson {
  /** Random per cached list, so an ETag from before a restart never matches a different board. */
  id: string;
  json: string;
  latest?: BoardSnapshot;
}

export interface BoardSnapshot {
  etag: string;
  json: string;
  gzipped(): Promise<Buffer>;
}

// Keyed on the list `listShared` returns: one frozen array per board version, so a new
// version or an evicted list drops its entry with it.
const cardsJson = new WeakMap<readonly Card[], CardsJson>();

// Each card's JSON, per converter. `listShared` keeps the frozen object of every card a write did
// not touch, so the body of a new board version encodes only the cards that changed.
const cardJson = new WeakMap<(item: Card) => unknown, WeakMap<Card, string>>();

function encodeCards(items: readonly Card[], toWire: (item: Card) => unknown): string {
  let encoded = cardJson.get(toWire);
  if (!encoded) cardJson.set(toWire, (encoded = new WeakMap()));
  const parts = items.map(item => {
    let json = encoded.get(item);
    if (json === undefined) encoded.set(item, (json = JSON.stringify(toWire(item)) ?? 'null'));
    return json;
  });
  return `[${parts.join(',')}]`;
}

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
  let cards = cardsJson.get(items);
  if (!cards) {
    cards = { id: randomUUID(), json: encodeCards(items, toWire) };
    cardsJson.set(items, cards);
  }
  const activity = JSON.stringify([runningSessionIds, parkedSessionIds]);
  const etag = `W/"${cards.id}.${createHash('sha1').update(activity).digest('base64url')}"`;
  if (cards.latest?.etag === etag) return cards.latest;

  const json = `{"workItems":${cards.json},"runningSessionIds":${JSON.stringify(runningSessionIds)},"parkedSessionIds":${JSON.stringify(parkedSessionIds)}}`;
  let gzipped: Promise<Buffer> | undefined;
  // zlib runs on the libuv pool, off the event loop.
  cards.latest = { etag, json, gzipped: () => (gzipped ??= gzip(json)) };
  return cards.latest;
}

/** Whether an `If-None-Match` header names this ETag (weak comparison, as for GET). */
export function matchesEtag(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const bare = (tag: string) => tag.trim().replace(/^W\//, '');
  return ifNoneMatch.split(',').some(tag => tag.trim() === '*' || bare(tag) === bare(etag));
}

import { createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip as gzipCallback } from 'node:zlib';

import type { Card } from '../storage/domains/work-items/base.js';
import { boardCheck } from '../work-items/board-check.js';

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
  cursor?: string,
): BoardSnapshot {
  // Random per cached list, so an ETag from before a restart never matches a different board.
  return snapshot(items, toWire, runningSessionIds, parkedSessionIds, () => randomUUID(), { cursor });
}

/**
 * The wire body for the cards a scoped listing picked. Its ETag names the cards by a hash of
 * their body, not by the board version: a write to a card outside the scope leaves it unchanged,
 * so the tab gets a 304. A caller that passes the same list again shares its serialization.
 * `total` is how many cards matched when `items` is only the first of them.
 */
export function scopedSnapshot(
  items: readonly Card[],
  toWire: (item: Card) => unknown,
  runningSessionIds: readonly string[],
  parkedSessionIds: readonly string[],
  total?: number,
): BoardSnapshot {
  return snapshot(items, toWire, runningSessionIds, parkedSessionIds, sha1, { total });
}

/** What moved on a board, for the one reader whose cursor it answers: nothing of it is kept. */
export function movedBody(body: unknown): Pick<BoardSnapshot, 'json' | 'gzipped'> {
  const json = JSON.stringify(body);
  return { json, gzipped: () => gzip(json) };
}

/**
 * A computed answer's wire body, named by a hash of itself: a reader that kept it revalidates
 * instead of downloading it again.
 */
export function hashedBody(body: unknown): BoardSnapshot {
  const json = JSON.stringify(body);
  return { etag: `W/"${sha1(json)}"`, json, gzipped: () => gzip(json) };
}

/**
 * An answer whose `names` hold the version of every card body `bodies` adds: its ETag is a hash of
 * `names`, and the bodies are serialized only for a reader that does not hold the answer.
 */
export function namedBody(names: object, bodies?: () => object): BoardSnapshot {
  const named = JSON.stringify(names);
  let whole: string | undefined;
  const json = () => (whole ??= bodies ? JSON.stringify({ ...names, ...bodies() }) : named);
  return {
    // An answer with bodies is not one a reader of the names alone holds.
    etag: `W/"${sha1(named)}${bodies ? '.bodies' : ''}"`,
    get json() {
      return json();
    },
    gzipped: () => gzip(json()),
  };
}

const checks = new WeakMap<readonly Card[], string>();

/** {@link boardCheck} of a cached list, computed once for every reader that sends its cursor. */
export function listCheck(items: readonly Card[]): string {
  let check = checks.get(items);
  if (check === undefined) checks.set(items, (check = boardCheck(items)));
  return check;
}

function snapshot(
  items: readonly Card[],
  toWire: (item: Card) => unknown,
  runningSessionIds: readonly string[],
  parkedSessionIds: readonly string[],
  cardsId: (json: string) => string,
  more: { total?: number; cursor?: string },
): BoardSnapshot {
  let cards = cardsJson.get(items);
  if (!cards) {
    const json = JSON.stringify(items.map(toWire));
    cards = { id: cardsId(json), json };
    cardsJson.set(items, cards);
  }
  // Everything the body holds beside the cards: a 304 must never hide a change to any of it.
  const rest = JSON.stringify({ runningSessionIds, parkedSessionIds, ...more });
  const etag = `W/"${cards.id}.${sha1(rest)}"`;
  if (cards.latest?.etag === etag) return cards.latest;

  const json = `{"workItems":${cards.json},${rest.slice(1)}`;
  let gzipped: Promise<Buffer> | undefined;
  // zlib runs on the libuv pool, off the event loop.
  cards.latest = { etag, json, gzipped: () => (gzipped ??= gzip(json)) };
  return cards.latest;
}

/** Names a text: a reader holding another text holds another name. */
export function sha1(text: string): string {
  return createHash('sha1').update(text).digest('base64url');
}

/** Whether an `If-None-Match` header names this ETag (weak comparison, as for GET). */
export function matchesEtag(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const bare = (tag: string) => tag.trim().replace(/^W\//, '');
  return ifNoneMatch.split(',').some(tag => tag.trim() === '*' || bare(tag) === bare(etag));
}

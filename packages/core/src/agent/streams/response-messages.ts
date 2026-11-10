import type { StepFinishPayload } from '../../stream/types';

type ResponseMessage = NonNullable<StepFinishPayload['messages']>['nonUser'][number];

/**
 * Every this many step-finish events, a producer sends its whole list
 * (`from: 0`), so a reader that missed a diff (a lost delivery, a live-only
 * transport that joined mid-run) recovers within that many steps.
 */
export const RESPONSE_MESSAGES_FULL_LIST_INTERVAL = 8;

/**
 * A step's response messages as published on a run's stream topic: the run's
 * list from index `from` on, replacing whatever a reader holds from there.
 * Earlier entries can change between steps (a step's assistant message grows,
 * a retried attempt is rolled back), so this is not just the new messages.
 */
export interface ResponseMessagesDiff {
  /** Identifies the publisher; each producer (e.g. each resumed segment of a run) numbers its own diffs. */
  producer: string;
  /** Increases by one per published step-finish of the producer. */
  seq: number;
  from: number;
  messages: ResponseMessage[];
}

/** What a producer remembers about the response messages it has published. */
export interface ResponseMessagesCursor {
  producer: string;
  seq: number;
  fingerprints: string[];
}

/**
 * The diff to publish for `messages`, the run's response messages so far, and
 * the cursor to keep for the next one. The first diff of a producer, and every
 * {@link RESPONSE_MESSAGES_FULL_LIST_INTERVAL}th one, holds the whole list.
 */
export function diffResponseMessages(
  cursor: ResponseMessagesCursor | { producer: string },
  messages: ResponseMessage[],
): { diff: ResponseMessagesDiff; cursor: ResponseMessagesCursor } {
  const fingerprints = messages.map(fingerprint);
  const seq = 'seq' in cursor ? cursor.seq + 1 : 0;
  let from = 0;
  if ('seq' in cursor && seq % RESPONSE_MESSAGES_FULL_LIST_INTERVAL !== 0) {
    const sent = cursor.fingerprints;
    while (from < sent.length && from < fingerprints.length && sent[from] === fingerprints[from]) from++;
  }
  const { producer } = cursor;
  return { diff: { producer, seq, from, messages: messages.slice(from) }, cursor: { producer, seq, fingerprints } };
}

/** The response messages a reader rebuilt from the diffs it applied. */
export interface ResponseMessagesReplay {
  messages: ResponseMessage[];
  /** Producer and `seq` of the last diff applied; unset when the next diff must hold the whole list. */
  producer?: string;
  seq?: number;
}

/**
 * Apply a step-finish payload's response messages to what a reader holds.
 * Returns the step's full list, or undefined when the payload can't be applied:
 * the reader missed an earlier diff (no history, a lost or reordered delivery)
 * or got a late copy of one it already applied. A reader that missed a diff
 * waits for the producer's next whole list instead of guessing. Payloads from
 * producers that publish the whole list (`_durableResponseMessages`) replace
 * what the reader holds.
 */
export function applyResponseMessages(
  replay: ResponseMessagesReplay,
  payload: { _durableResponseMessagesDiff?: ResponseMessagesDiff; _durableResponseMessages?: ResponseMessage[] },
): ResponseMessage[] | undefined {
  const diff = payload._durableResponseMessagesDiff;
  if (!diff) {
    if (!Array.isArray(payload._durableResponseMessages)) return undefined;
    Object.assign(replay, { messages: payload._durableResponseMessages, producer: undefined, seq: undefined });
    return replay.messages;
  }
  const sameProducer = replay.producer === diff.producer && replay.seq !== undefined;
  // A late or repeated delivery of a diff this reader is already past.
  if (sameProducer && diff.seq <= replay.seq!) return undefined;
  if (diff.from === 0) {
    Object.assign(replay, { messages: [...diff.messages], producer: diff.producer, seq: diff.seq });
    return replay.messages;
  }
  // A diff of a producer whose whole list this reader hasn't seen (e.g. the previous segment's
  // publisher, delivered late) says nothing about the list it holds.
  if (replay.producer !== diff.producer) return undefined;
  if (!sameProducer || diff.seq !== replay.seq! + 1 || diff.from > replay.messages.length) {
    replay.seq = undefined;
    return undefined;
  }
  replay.messages = [...replay.messages.slice(0, diff.from), ...diff.messages];
  replay.seq = diff.seq;
  return replay.messages;
}

/**
 * Fold the step-finish events of a run log, in order, into a reader's starting
 * state. It doesn't filter by claim generation: plain Agent logs carry none.
 */
export function replayResponseMessages(events: { type?: string; data?: unknown }[]): ResponseMessagesReplay {
  const replay: ResponseMessagesReplay = { messages: [] };
  for (const event of events) {
    const chunk = event.data as { type?: string; payload?: Parameters<typeof applyResponseMessages>[1] } | undefined;
    if (event.type === 'chunk' && chunk?.type === 'step-finish' && chunk.payload) {
      applyResponseMessages(replay, chunk.payload);
    }
  }
  return replay;
}

/** 53-bit string hash (cyrb53) with the length, to tell messages apart without keeping them. */
function fingerprint(message: ResponseMessage): string {
  const text = JSON.stringify(message) ?? '';
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}:${text.length}`;
}

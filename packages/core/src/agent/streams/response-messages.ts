import type { StepFinishPayload } from '../../stream/types';

type ResponseMessage = NonNullable<StepFinishPayload['messages']>['nonUser'][number];

/**
 * A step's response messages as published on a run's stream topic: the run's
 * list from index `from` on, replacing whatever a reader holds from there.
 * Earlier entries can change between steps (a step's assistant message grows,
 * a retried attempt is rolled back), so this is not just the new messages.
 */
export interface ResponseMessagesDiff {
  /** Identifies the publisher, e.g. one execution of a run; each producer numbers its own diffs. */
  producer: string;
  /** Increases by one per published step-finish of the producer. */
  seq: number;
  from: number;
  /** Identifies the list this diff applies to (absent when `from` is 0). */
  base?: string;
  /** Identifies the list that applying this diff gives. */
  hash: string;
  messages: ResponseMessage[];
}

/** What a producer remembers about the response messages it has published. */
export interface ResponseMessagesCursor {
  producer: string;
  seq: number;
  fingerprints: string[];
  /** Size of the last whole list it sent (JSON characters). */
  wholeListSize?: number;
  /** Size of the diffs it sent since then. */
  sentSinceWholeList?: number;
}

/**
 * The diff to publish for `messages`, the run's response messages so far, and
 * the cursor to keep for the next one.
 *
 * A producer's first diff holds the whole list (`from: 0`), and so does the
 * next one once the diffs sent since the last whole list add up to its size.
 * A reader that missed a diff (a lost delivery) recovers at the next whole
 * list, while whole lists cost at most about as much as the diffs: the log
 * stays proportional to the run's messages instead of growing with the square
 * of its steps.
 */
export function diffResponseMessages(
  cursor: ResponseMessagesCursor | { producer: string },
  messages: ResponseMessage[],
): { diff: ResponseMessagesDiff; cursor: ResponseMessagesCursor } {
  const fingerprints = messages.map(message => hashString(JSON.stringify(message) ?? ''));
  const hash = listHash(fingerprints);
  const { producer } = cursor;
  const sent = 'seq' in cursor ? cursor : undefined;
  const seq = sent ? sent.seq + 1 : 0;
  const wholeList = !sent || (sent.sentSinceWholeList ?? 0) >= (sent.wholeListSize ?? 0);
  let from = 0;
  if (!wholeList) {
    while (
      from < sent!.fingerprints.length &&
      from < fingerprints.length &&
      sent!.fingerprints[from] === fingerprints[from]
    ) {
      from++;
    }
  }
  const size = fingerprints.slice(from).reduce((total, fingerprint) => total + fingerprintSize(fingerprint), 0);
  const diff: ResponseMessagesDiff = {
    producer,
    seq,
    from,
    ...(from > 0 ? { base: listHash(sent!.fingerprints) } : {}),
    hash,
    messages: messages.slice(from),
  };
  return {
    diff,
    cursor: {
      producer,
      seq,
      fingerprints,
      wholeListSize: wholeList ? size : sent!.wholeListSize,
      sentSinceWholeList: wholeList ? 0 : (sent!.sentSinceWholeList ?? 0) + size,
    },
  };
}

/** The response messages a reader rebuilt from the diffs it applied. */
export interface ResponseMessagesReplay {
  /** The list of the last diff applied. */
  messages: ResponseMessage[];
  /**
   * The list rebuilt per producer, with the hash and `seq` of its last diff, in
   * the order the producers first appeared. A run resumed in a new producer can
   * still get a late step-finish from the previous one; each producer's diffs
   * apply to its own list, so that event doesn't break the new producer's next
   * diff.
   */
  producers?: Map<string, { messages: ResponseMessage[]; hash: string; seq: number }>;
  /** Producers whose list was dropped for a newer one; their late events never take a newer one's place. */
  retired?: Set<string>;
}

/** Producers a reader keeps lists for: the run's current one and the one it resumed from. */
const KEPT_PRODUCERS = 2;

/**
 * Apply a step-finish payload's response messages to what a reader holds.
 * Returns the step's full list, or undefined when the payload can't be applied:
 * the reader doesn't hold the exact list the diff was made against (it missed
 * a diff, or a step was published twice with different content), or the diff
 * is a late copy of one it is already past. Such a reader reports nothing
 * until a diff fits its list or the producer's next whole list arrives,
 * instead of guessing. Payloads from producers that publish the whole list
 * (`_durableResponseMessages`) report it as is.
 */
export function applyResponseMessages(
  replay: ResponseMessagesReplay,
  payload: { _durableResponseMessagesDiff?: ResponseMessagesDiff; _durableResponseMessages?: ResponseMessage[] },
): ResponseMessage[] | undefined {
  const diff = payload._durableResponseMessagesDiff;
  if (!diff) {
    if (!Array.isArray(payload._durableResponseMessages)) return undefined;
    replay.messages = payload._durableResponseMessages;
    return replay.messages;
  }
  if (replay.retired?.has(diff.producer)) return diff.from === 0 ? diff.messages : undefined;
  const producers = (replay.producers ??= new Map());
  const held = producers.get(diff.producer);
  if (held && diff.seq <= held.seq) {
    // A step-finish delivered twice still reports its list; anything older says nothing new.
    return diff.seq === held.seq && diff.hash === held.hash ? held.messages : undefined;
  }
  if (diff.from !== 0 && (!held || diff.base !== held.hash)) return undefined;
  const messages = [...(held?.messages.slice(0, diff.from) ?? []), ...diff.messages];
  producers.set(diff.producer, { messages, hash: diff.hash, seq: diff.seq });
  if (producers.size > KEPT_PRODUCERS) {
    const oldest = producers.keys().next().value!;
    producers.delete(oldest);
    (replay.retired ??= new Set()).add(oldest);
  }
  replay.messages = messages;
  return messages;
}

/**
 * A copy of a published step-finish payload with the run's full response
 * message list in `_durableResponseMessages`, rebuilt into `replay`, as readers
 * of the run (and its callers' public frames) see it.
 */
export function withRebuiltResponseMessages<T extends Parameters<typeof applyResponseMessages>[1]>(
  replay: ResponseMessagesReplay,
  payload: T,
): Omit<T, '_durableResponseMessagesDiff'> & { _durableResponseMessages?: ResponseMessage[] } {
  const { _durableResponseMessagesDiff, ...rest } = payload;
  // A reader that can't rebuild the list (it missed an earlier part) reports none for this step
  // rather than a list that may not match it.
  const messages = applyResponseMessages(replay, payload);
  return _durableResponseMessagesDiff || messages ? { ...rest, _durableResponseMessages: messages ?? [] } : rest;
}

/**
 * Fold the step-finish events of a run log, in order, into a reader's starting
 * state. Like a reader, it drops events of an execution that a newer claim
 * generation already superseded.
 */
export function replayResponseMessages(
  events: { type?: string; data?: unknown; generation?: number }[],
): ResponseMessagesReplay {
  const replay: ResponseMessagesReplay = { messages: [] };
  let floor: number | undefined;
  for (const event of events) {
    if (typeof event.generation === 'number') {
      if (floor !== undefined && event.generation < floor) continue;
      floor = event.generation;
    }
    const chunk = event.data as { type?: string; payload?: Parameters<typeof applyResponseMessages>[1] } | undefined;
    if (event.type === 'chunk' && chunk?.type === 'step-finish' && chunk.payload) {
      applyResponseMessages(replay, chunk.payload);
    }
  }
  return replay;
}

function listHash(fingerprints: string[]): string {
  return hashString(fingerprints.join(','));
}

/** The length of the JSON a fingerprint was taken of. */
function fingerprintSize(fingerprint: string): number {
  return Number(fingerprint.slice(fingerprint.lastIndexOf(':') + 1)) || 0;
}

/** 53-bit string hash (cyrb53) with the length, to tell values apart without keeping them. */
function hashString(text: string): string {
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

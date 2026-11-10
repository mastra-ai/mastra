import type { StepFinishPayload } from '../../stream/types';

type ResponseMessage = NonNullable<StepFinishPayload['messages']>['nonUser'][number];

/**
 * A step's response messages as published on a run's stream topic: the run's
 * list from index `from` on, replacing whatever a reader holds from there.
 * Earlier entries can change between steps (a step's assistant message grows,
 * a retried attempt is rolled back), so this is not just the new messages.
 */
export interface ResponseMessagesDiff {
  from: number;
  /** Increases by one per published step-finish of the producer that sent it. */
  seq: number;
  messages: ResponseMessage[];
}

/** What a producer remembers about the response messages it has published. */
export interface ResponseMessagesCursor {
  fingerprints: string[];
  seq: number;
}

/**
 * The diff to publish for `messages`, the run's response messages so far, and
 * the cursor to keep for the next one. Without a cursor the diff is the whole
 * list from index 0.
 */
export function diffResponseMessages(
  cursor: ResponseMessagesCursor | undefined,
  messages: ResponseMessage[],
): { diff: ResponseMessagesDiff; cursor: ResponseMessagesCursor } {
  const fingerprints = messages.map(fingerprint);
  const sent = cursor?.fingerprints ?? [];
  let from = 0;
  while (from < sent.length && from < fingerprints.length && sent[from] === fingerprints[from]) from++;
  const seq = cursor ? cursor.seq + 1 : 0;
  return { diff: { from, seq, messages: messages.slice(from) }, cursor: { fingerprints, seq } };
}

/** The response messages a reader rebuilt from the diffs it applied. */
export interface ResponseMessagesReplay {
  messages: ResponseMessage[];
  /** `seq` of the last diff applied; undefined when the next diff must start at index 0. */
  seq?: number;
}

/**
 * Apply a step-finish payload's response messages to what a reader holds.
 * Returns the step's full list, or undefined when the payload can't be applied
 * because the reader missed an earlier diff (no history, a lost or reordered
 * delivery). The reader then waits for the next full list instead of guessing.
 * Payloads from producers that publish the full list
 * (`_durableResponseMessages`) replace what the reader holds.
 */
export function applyResponseMessages(
  replay: ResponseMessagesReplay,
  payload: { _durableResponseMessagesDiff?: ResponseMessagesDiff; _durableResponseMessages?: ResponseMessage[] },
): ResponseMessage[] | undefined {
  const diff = payload._durableResponseMessagesDiff;
  if (!diff) {
    if (!Array.isArray(payload._durableResponseMessages)) return undefined;
    replay.messages = payload._durableResponseMessages;
    replay.seq = undefined;
    return replay.messages;
  }
  if (diff.from === 0) {
    replay.messages = diff.messages;
    replay.seq = diff.seq;
    return replay.messages;
  }
  // A step-finish delivered twice.
  if (replay.seq !== undefined && diff.seq <= replay.seq) return replay.messages;
  if (replay.seq === undefined || diff.seq !== replay.seq + 1 || diff.from > replay.messages.length) {
    replay.seq = undefined;
    return undefined;
  }
  replay.messages = [...replay.messages.slice(0, diff.from), ...diff.messages];
  replay.seq = diff.seq;
  return replay.messages;
}

/** Fold the step-finish events of a run log, in order, into a reader's starting state. */
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

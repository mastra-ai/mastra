import { accumulateGenUI, createGenUIState, extractGenUIEnvelopes } from './accumulator';
import type { AccumulateGenUIOptions, GenUIMessageLike } from './accumulator';
import type { GenUIState } from './types';

/**
 * Framework-agnostic GenUI session: derives surface state from a message list
 * and optional out-of-band envelopes (e.g. a workflow stream rendering into a
 * side panel), and notifies subscribers when it changes.
 *
 * `sync(messages)` is incremental. When the new message list only appends GenUI
 * events, only the new events are applied, so unchanged surfaces keep their
 * identity while text tokens stream. Any other change (history reload, edit,
 * regenerate) triggers a deterministic rebuild.
 */
export interface GenUISession {
  getState(): GenUIState;
  sync(messages: ReadonlyArray<GenUIMessageLike>): GenUIState;
  /** Apply an envelope that did not arrive as a message part. Survives rebuilds. */
  ingest(envelope: unknown): GenUIState;
  subscribe(listener: () => void): () => void;
  reset(): void;
}

const refKey = (ref: { messageId: string; partIndex: number; envelope: unknown }) => {
  const eventId = (ref.envelope as { eventId?: unknown } | undefined)?.eventId;
  return typeof eventId === 'string' ? `e:${eventId}` : `p:${ref.messageId}:${ref.partIndex}`;
};

export function createGenUISession(options: AccumulateGenUIOptions = {}): GenUISession {
  let state = createGenUIState();
  let appliedKeys: string[] = [];
  let external: unknown[] = [];
  const listeners = new Set<() => void>();

  const commit = (next: GenUIState) => {
    if (next !== state) {
      state = next;
      listeners.forEach(listener => listener());
    }
    return state;
  };

  const rebuild = (messageEnvelopes: unknown[]) => {
    let next = createGenUIState();
    for (const envelope of messageEnvelopes) next = accumulateGenUI(next, envelope, options);
    for (const envelope of external) next = accumulateGenUI(next, envelope, options);
    return next;
  };

  return {
    getState: () => state,
    sync(messages) {
      const refs = extractGenUIEnvelopes(messages);
      const keys = refs.map(refKey);
      const isAppendOnly = keys.length >= appliedKeys.length && appliedKeys.every((key, index) => keys[index] === key);
      const envelopes = refs.map(ref => ref.envelope);

      let next: GenUIState;
      if (isAppendOnly) {
        next = state;
        for (let index = appliedKeys.length; index < refs.length; index++) {
          next = accumulateGenUI(next, envelopes[index], options);
        }
      } else {
        next = rebuild(envelopes);
      }
      appliedKeys = keys;
      return commit(next);
    },
    ingest(envelope) {
      external = [...external, envelope];
      return commit(accumulateGenUI(state, envelope, options));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset() {
      appliedKeys = [];
      external = [];
      commit(createGenUIState());
    },
  };
}

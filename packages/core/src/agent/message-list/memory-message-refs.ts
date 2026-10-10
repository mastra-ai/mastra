import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import type { IMastraLogger } from '../../logger';
import type { MastraMemory } from '../../memory/memory';
import { stableStringify } from './cache/stable-stringify';
import { MessageList } from './message-list';
import type { MastraDBMessage, MemoryInfo, SerializedMessage, SerializedMessageListState } from './state';

/**
 * Stands in for a memory-recalled message in a persisted transcript. The
 * message already lives in memory storage, so the snapshot keeps only its id
 * plus a fingerprint of the stored version it replaced.
 */
export type MemoryMessageRef = { __ref: 'memory'; id: string; fingerprint: string };

/** A serialized transcript whose memory-recalled messages may be refs. */
export type DehydratedMessageListState = Omit<SerializedMessageListState, 'messages'> & {
  messages: Array<SerializedMessage | MemoryMessageRef>;
};

/** Loads stored messages by id. Resolves `undefined` when no store can answer. */
export type StoredMessageLoader = (ids: string[]) => Promise<MastraDBMessage[] | undefined>;

export function isMemoryMessageRef(value: unknown): value is MemoryMessageRef {
  return typeof value === 'object' && value !== null && (value as MemoryMessageRef).__ref === 'memory';
}

/** Loads messages through the memory instance's store, when it can list by id. */
export function createStoredMessageLoader(memory: MastraMemory | undefined): StoredMessageLoader {
  return async ids => {
    if (!memory) return undefined;
    const store = await memory.storage.getStore('memory');
    if (!store || typeof store.listMessagesById !== 'function') return undefined;
    return (await store.listMessagesById({ messageIds: ids })).messages;
  };
}

/**
 * Keeps memory-recalled messages out of persisted run transcripts.
 *
 * `dehydrate` swaps a recalled message for a {@link MemoryMessageRef} only
 * when it is byte-for-byte the stored row as a recall adds it — anything a
 * processor changed after recall stays inline, so resuming never trades the
 * run's view of a message for the stored one. `hydrate` restores refs, from
 * the rows this instance already verified or else from storage; a row edited
 * since is restored as stored and a deleted one is dropped, both logged at
 * debug level.
 *
 * One instance serves one run, so verified rows are reused across every
 * transcript the run persists.
 */
export class MemoryMessageRefs {
  /** id → the stored row normalized the way a recall adds it. */
  #stored = new Map<string, { canonical: string; fingerprint: string }>();
  /** Recalled ids that storage could not return; not retried on later stores. */
  #unavailable = new Set<string>();
  /** Ids a successful load did not return: deleted, so later restores skip the lookup. */
  #deleted = new Set<string>();
  #verifying: Promise<void> = Promise.resolve();

  /**
   * Loads the stored rows of recalled messages not yet verified, so
   * `dehydrate` can reference them. Best effort: a failed lookup only leaves
   * those messages inline. Calls run one at a time, so concurrent stores of
   * one run share a single lookup.
   */
  verify(state: SerializedMessageListState | undefined, load: StoredMessageLoader, logger?: IMastraLogger) {
    const run = this.#verifying.then(() => this.#verifyNow(state, load, logger));
    this.#verifying = run;
    return run;
  }

  async #verifyNow(state: SerializedMessageListState | undefined, load: StoredMessageLoader, logger?: IMastraLogger) {
    const pending = (state?.memoryMessages ?? []).filter(id => !this.#stored.has(id) && !this.#unavailable.has(id));
    if (pending.length === 0) return;
    try {
      const found = await this.#load(pending, state!.memoryInfo, load);
      for (const id of pending) {
        if (!found?.has(id)) this.#unavailable.add(id);
      }
    } catch (error) {
      for (const id of pending) this.#unavailable.add(id);
      logger?.warn('Could not verify recalled messages against memory storage; persisting them inline', { error });
    }
  }

  /** Replaces verified, unchanged recalled messages with refs. Never reads storage. */
  dehydrate(state: SerializedMessageListState): DehydratedMessageListState {
    if (this.#stored.size === 0 || !state?.memoryMessages?.length) return state;
    const recalled = new Set(state.memoryMessages);
    let replaced = false;
    const messages = state.messages.map(message => {
      if (!recalled.has(message.id)) return message;
      const stored = this.#stored.get(message.id);
      if (!stored || stableStringify(message) !== stored.canonical) return message;
      replaced = true;
      return { __ref: 'memory', id: message.id, fingerprint: stored.fingerprint } satisfies MemoryMessageRef;
    });
    return replaced ? { ...state, messages } : state;
  }

  /** Restores every ref in `state`, loading rows this instance has not verified. */
  async hydrate(
    state: DehydratedMessageListState,
    load: StoredMessageLoader,
    context: { logger?: IMastraLogger; runId?: string } = {},
  ): Promise<SerializedMessageListState> {
    if (!state?.messages?.some(isMemoryMessageRef)) return state as SerializedMessageListState;

    const refs = state.messages.filter(isMemoryMessageRef);
    const missing = refs.filter(ref => !this.#stored.has(ref.id) && !this.#deleted.has(ref.id)).map(ref => ref.id);
    if (missing.length > 0 && !(await this.#load(missing, state.memoryInfo, load))) {
      throw new MastraError({
        id: 'AGENT_MEMORY_MESSAGE_REF_UNRESOLVABLE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.SYSTEM,
        text: 'The run transcript references messages in memory storage, but no memory store that can load messages by id is available.',
        details: { runId: context.runId ?? '', messageIds: missing.join(',') },
      });
    }

    const messages: SerializedMessage[] = [];
    for (const message of state.messages) {
      if (!isMemoryMessageRef(message)) {
        messages.push(message);
        continue;
      }
      const stored = this.#stored.get(message.id);
      if (!stored) {
        context.logger?.debug('A recalled message was deleted from memory while the run was persisted; dropping it', {
          runId: context.runId,
          messageId: message.id,
        });
        continue;
      }
      if (stored.fingerprint !== message.fingerprint) {
        context.logger?.debug(
          'A recalled message changed in memory while the run was persisted; using the stored version',
          {
            runId: context.runId,
            messageId: message.id,
          },
        );
      }
      messages.push(JSON.parse(stored.canonical) as SerializedMessage);
    }
    return { ...state, messages };
  }

  /** Records the stored rows for `ids`. Resolves the ids found, or `undefined` without a store. */
  async #load(ids: string[], memoryInfo: MemoryInfo | null, load: StoredMessageLoader) {
    const rows = await load(ids);
    if (!rows) return undefined;
    const wanted = new Set(ids);
    const found = new Set<string>();
    for (const row of rows) {
      if (!wanted.has(row.id)) continue;
      const normalized = normalizeStoredMessage(row, memoryInfo);
      if (!normalized) continue;
      const canonical = stableStringify(normalized);
      this.#stored.set(row.id, { canonical, fingerprint: fingerprint(canonical) });
      this.#unavailable.delete(row.id);
      this.#deleted.delete(row.id);
      found.add(row.id);
    }
    for (const id of ids) {
      if (!found.has(id)) this.#deleted.add(id);
    }
    return found;
  }
}

/** The row as a recall would hold it: added on its own to a list for the same thread. */
function normalizeStoredMessage(row: MastraDBMessage, memoryInfo: MemoryInfo | null): SerializedMessage | undefined {
  const list = new MessageList({ threadId: memoryInfo?.threadId, resourceId: memoryInfo?.resourceId });
  list.add(row, 'memory');
  return list.serialize().messages.find(message => message.id === row.id);
}

/** 64-bit non-cryptographic hash (two 32-bit lanes); only detects edits. */
function fingerprint(value: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ char, 2654435761);
    h2 = Math.imul(h2 ^ char, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

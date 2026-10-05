/**
 * Lifecycle invariants for the observational memory fuzz harness.
 *
 * Mocked Observer and Reflector outputs embed the ids of the messages they cover as
 * `obs[<id>,<id>]`, so every message can be traced through buffering, activation, sync
 * observation, and reflection into the head's text.
 */
import type { MastraDBMessage } from '@mastra/core/agent';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';

export interface SavedMessage {
  id: string;
  createdAt: Date;
}

export interface AppendEvent {
  seq: number;
  cycleId: string;
  messageIds: string[];
  /** Head cursor read just before the append (ms), or null when unset. */
  cursorBefore: number | null;
  persisted: boolean;
}

export interface SyncCommitEvent {
  seq: number;
  /** Message ids this commit added to the head text. */
  messageIds: string[];
  /** Seq of the Observer read that produced them, when one matches. */
  readSeq: number | null;
}

/** One Observer call: the ids of the messages it was given. */
export interface ObserverReadEvent {
  seq: number;
  messageIds: string[];
}

export interface Violation {
  invariant: string;
  detail: string;
}

const ID_LIST = /obs\[([^\]]*)\]/g;

/** Every message id embedded in `text`, with repeats. */
export function idsIn(text: string | undefined): string[] {
  const ids: string[] = [];
  for (const match of (text ?? '').matchAll(ID_LIST)) {
    for (const id of match[1]!.split(',')) {
      if (id) ids.push(id);
    }
  }
  return ids;
}

export function observerOutput(messageIds: string[]): string {
  return `- obs[${messageIds.join(',')}]`;
}

export function reflectorOutput(observations: string): string {
  return `- reflected obs[${[...new Set(idsIn(observations))].join(',')}]`;
}

const time = (value: Date | string | undefined | null) => (value ? new Date(value).getTime() : null);

export interface LifecycleLedger {
  messages: SavedMessage[];
  appends: AppendEvent[];
  syncCommits: SyncCommitEvent[];
  observerReads: ObserverReadEvent[];
  nextSeq(): number;
}

export function createLedger(): LifecycleLedger {
  let seq = 0;
  return { messages: [], appends: [], syncCommits: [], observerReads: [], nextSeq: () => ++seq };
}

/**
 * Wraps the storage writes the invariants need to see. Reads the head cursor *before* each append
 * so a chunk covered by a later sync commit is not mistaken for one that was already covered.
 */
export function instrumentStorage(
  storage: MemoryStorage,
  ledger: LifecycleLedger,
  ids: { threadId: string; resourceId: string },
): void {
  const append = storage.updateBufferedObservations.bind(storage);
  storage.updateBufferedObservations = async input => {
    const head = await storage.getObservationalMemory(ids.threadId, ids.resourceId);
    const cursorBefore = time(head?.lastObservedAt);
    const result = await append(input);
    ledger.appends.push({
      seq: ledger.nextSeq(),
      cycleId: input.chunk.cycleId,
      messageIds: input.chunk.messageIds,
      cursorBefore,
      // Adapters that predate the result report nothing; that means the chunk was stored.
      persisted: result ? result.persisted : true,
    });
    return result;
  };

  const commit = storage.updateActiveObservations.bind(storage);
  storage.updateActiveObservations = async input => {
    // Read the ids now: InMemory returns live records, which the commit mutates.
    const before = idsIn((await storage.getObservationalMemory(ids.threadId, ids.resourceId))?.activeObservations);
    const result = await commit(input);
    if (!result || result.applied) {
      // The ids the commit added: committed text minus the head text it replaced (with repeats).
      const remaining = before;
      const added = idsIn(input.observations).filter(id => {
        const at = remaining.indexOf(id);
        if (at === -1) return true;
        remaining.splice(at, 1);
        return false;
      });
      const key = [...added].sort().join(',');
      const read = [...ledger.observerReads].reverse().find(r => [...r.messageIds].sort().join(',') === key);
      ledger.syncCommits.push({ seq: ledger.nextSeq(), messageIds: added, readSeq: read?.seq ?? null });
    }
    return result;
  };
}

/** Picks the messages the actor still sees raw, as OM does (`getUnobservedMessages`). */
export type ActorRawView = (messages: MastraDBMessage[], head: ObservationalMemoryRecord) => MastraDBMessage[];

/**
 * Checks the lifecycle invariants on the current state. `final` adds the checks that only hold
 * once all work has drained (no discarded work, actor-visible coverage, duplicate accounting);
 * it builds the actor's raw view from the stored messages with `final.actorRawView`, so markers,
 * the cursor, and observed ids all count exactly as they do for the actor.
 */
export async function checkInvariants(
  storage: MemoryStorage,
  ledger: LifecycleLedger,
  ids: { threadId: string; resourceId: string },
  state: { lastCursor: number | null },
  final: false | { actorRawView: ActorRawView },
): Promise<{ violations: Violation[]; explainedDuplicates: number; overlappingSyncDuplicates: number }> {
  const violations: Violation[] = [];
  const head = await storage.getObservationalMemory(ids.threadId, ids.resourceId);
  if (!head) {
    return {
      violations: [{ invariant: 'head', detail: 'no head record' }],
      explainedDuplicates: 0,
      overlappingSyncDuplicates: 0,
    };
  }
  const rows = await storage.getObservationalMemoryHistory(ids.threadId, ids.resourceId, 1_000);
  const cursor = time(head.lastObservedAt);
  const textIds = idsIn(head.activeObservations);
  const textIdSet = new Set(textIds);
  const chunks = head.bufferedObservationChunks ?? [];
  const chunkIds = new Set(chunks.flatMap(c => c.messageIds));
  const messageTime = new Map(ledger.messages.map(m => [m.id, m.createdAt.getTime()]));
  const isRaw = (id: string) => cursor === null || (messageTime.get(id) ?? 0) > cursor;

  // (1) Coverage: every message is raw (after the cursor), observed in the head text, or buffered on the head.
  for (const message of ledger.messages) {
    if (!isRaw(message.id) && !textIdSet.has(message.id) && !chunkIds.has(message.id)) {
      violations.push({ invariant: 'coverage', detail: `${message.id} is behind the cursor and not on the head` });
    }
  }

  // (3) Continuity: the head's chunks are in order.
  for (let i = 1; i < chunks.length; i++) {
    if (time(chunks[i]!.lastObservedAt)! < time(chunks[i - 1]!.lastObservedAt)!) {
      violations.push({ invariant: 'chunk-order', detail: `${chunks[i]!.cycleId} is before its predecessor` });
    }
  }

  // (4) No chunk is left on a retired record.
  for (const row of rows) {
    if (row.id !== head.id && (row.bufferedObservationChunks ?? []).length > 0) {
      violations.push({
        invariant: 'stranded-chunk',
        detail: `${row.bufferedObservationChunks!.map(c => c.cycleId).join(',')} on retired ${row.id}`,
      });
    }
  }

  // (5) The head cursor never moves backward.
  if (cursor !== null && state.lastCursor !== null && cursor < state.lastCursor) {
    violations.push({ invariant: 'cursor-backward', detail: `${state.lastCursor} -> ${cursor}` });
  }
  if (cursor !== null) state.lastCursor = Math.max(cursor, state.lastCursor ?? cursor);

  // (7) A chunk whose messages were all at or before the cursor when it was appended is never stored.
  const rangeOf = (append: AppendEvent) => {
    const times = append.messageIds.map(id => messageTime.get(id) ?? 0);
    return { min: Math.min(...times), max: Math.max(...times) };
  };
  for (const append of ledger.appends) {
    if (append.persisted && append.cursorBefore !== null && rangeOf(append).max <= append.cursorBefore) {
      violations.push({ invariant: 'covered-append-stored', detail: `${append.cycleId} was already observed` });
    }
  }

  let explainedDuplicates = 0;
  let overlappingSyncDuplicates = 0;
  if (final) {
    // (2) No discarded work: every stored chunk is buffered on the head or its messages are in the head text.
    for (const append of ledger.appends.filter(a => a.persisted)) {
      const onHead = chunks.some(c => c.cycleId === append.cycleId);
      if (!onHead && !append.messageIds.every(id => textIdSet.has(id))) {
        violations.push({ invariant: 'discarded-work', detail: `${append.cycleId} is neither buffered nor observed` });
      }
    }

    // (6) Actor-visible view: the messages the actor sees raw plus the head text hold every message
    // at least once.
    const stored = (await storage.listMessages({ threadId: ids.threadId, perPage: false })).messages;
    const actorRaw = new Set(final.actorRawView(stored, head).map(m => m.id));
    const counts = new Map<string, number>();
    for (const id of textIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const message of ledger.messages) {
      const seen = (counts.get(message.id) ?? 0) + (actorRaw.has(message.id) ? 1 : 0);
      if (seen === 0) {
        violations.push({ invariant: 'loss', detail: `${message.id} is missing from the actor-visible view` });
      } else if (seen > 1) {
        const explained = ledger.appends.some(append => {
          if (!append.persisted || !append.messageIds.includes(message.id)) return false;
          // The chunk was stored before a sync observation covered the same message...
          if (ledger.syncCommits.some(s => s.seq > append.seq && s.messageIds.includes(message.id))) return true;
          // ...or it was only partly covered when appended (it carried unobserved messages too), and
          // this message is in the covered part.
          const { max } = rangeOf(append);
          return (
            append.cursorBefore !== null &&
            max > append.cursorBefore &&
            (messageTime.get(message.id) ?? 0) <= append.cursorBefore
          );
        });
        // Two sync cycles (other instances or processes) observed the message concurrently: the later
        // commit's Observer read it before the earlier commit landed. The conditional commit turns
        // that race into a duplicate instead of overwriting the earlier commit (accepted; see
        // ARCHITECTURE.md).
        const commits = ledger.syncCommits.filter(c => c.messageIds.includes(message.id));
        const overlapping = commits.some(later =>
          commits.some(earlier => earlier.seq < later.seq && later.readSeq !== null && later.readSeq < earlier.seq),
        );
        if (explained) explainedDuplicates++;
        else if (overlapping) overlappingSyncDuplicates++;
        else violations.push({ invariant: 'unexplained-duplicate', detail: `${message.id} appears ${seen} times` });
      }
    }
  }

  return { violations, explainedDuplicates, overlappingSyncDuplicates };
}

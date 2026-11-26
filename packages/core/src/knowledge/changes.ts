import type { KnowledgeStorage } from '../storage/domains/knowledge/base';
import type { KnowledgeNote, KnowledgePage, KnowledgePin } from '../storage/domains/knowledge/pages';

/**
 * One committed write to a Knowledge store. Events carry ids only: a listener serving people (a UI
 * stream) must re-read the page under the viewer's read scope and drop what they can't read.
 * `scopeId` is the page's scope after the write; `fromScopeId` (move, and merge for the page merged
 * away) is its scope before. For notes and pins, read the page by `pageId`. Creating a scope emits one
 * `scope:create` for the scope itself, not for its child scopes or template pages, and template pages
 * added later to an existing scope emit nothing: re-list the scope on `scope:create`.
 * `dangerouslyReset()` emits nothing.
 * @experimental
 */
export type KnowledgeChangeEvent = {
  knowledgeId: string;
  at: Date;
} & (
  | { kind: 'scope'; op: 'create'; pageId: string; scopeId: string }
  | {
      kind: 'page';
      op: 'create' | 'update' | 'move' | 'merge' | 'delete';
      pageId: string;
      scopeId: string;
      /** For `move` and `merge`: the moved or merged-away page's scope before the write. */
      fromScopeId?: string;
      /** For `merge`: the page merged away (now deleted); `pageId` is the target. */
      sourceId?: string;
    }
  | { kind: 'note'; op: 'add' | 'restamp' | 'remove' | 'restore'; pageId: string; noteId: string }
  | { kind: 'pin'; op: 'add' | 'remove'; pageId: string }
);

/** @experimental */
export type KnowledgeChangeListener = (event: KnowledgeChangeEvent) => void;

type Change = {
  [K in KnowledgeChangeEvent['kind']]: Omit<Extract<KnowledgeChangeEvent, { kind: K }>, 'knowledgeId' | 'at'>;
}[KnowledgeChangeEvent['kind']];

const page = (op: 'create' | 'update' | 'delete') => (result: unknown) => {
  const { id, scopeId } = result as KnowledgePage;
  return { kind: 'page', op, pageId: id, scopeId } as Change;
};
const note = (op: 'add' | 'restamp' | 'remove' | 'restore') => (result: unknown) => {
  const { id, pageId } = result as KnowledgeNote;
  return { kind: 'note', op, pageId, noteId: id } as Change;
};

type Describe = (result: unknown, input: any, fromScopeId: string | undefined) => Change | null;

/** The page-store writes that emit, and the event each one's result maps to. */
const WRITES: Record<string, Describe> = {
  materializeScope: result => {
    const { scope, created } = result as { scope: KnowledgePage; created: boolean };
    return created ? { kind: 'scope', op: 'create', pageId: scope.id, scopeId: scope.id } : null;
  },
  createPage: page('create'),
  updatePage: page('update'),
  movePage: (result, _input, fromScopeId) => {
    const { id, scopeId } = result as KnowledgePage;
    return { kind: 'page', op: 'move', pageId: id, scopeId, fromScopeId };
  },
  deletePage: page('delete'),
  mergePages: (result, input: { sourceId: string }, fromScopeId) => {
    const { id, scopeId } = result as KnowledgePage;
    return { kind: 'page', op: 'merge', pageId: id, scopeId, sourceId: input.sourceId, fromScopeId };
  },
  addNote: note('add'),
  restampNote: note('restamp'),
  removeNote: note('remove'),
  restoreNote: note('restore'),
  addPinAudience: result => ({ kind: 'pin', op: 'add', pageId: (result as KnowledgePin).pageId }),
  removePinAudience: (result, input: { pageId: string }) => ({ kind: 'pin', op: 'remove', pageId: input.pageId }),
};

/** Writes whose event says where the page was before; the page id is read from the input. */
const MOVED_PAGE: Record<string, (input: any) => string> = {
  movePage: (input: { id: string }) => input.id,
  mergePages: (input: { sourceId: string }) => input.sourceId,
};

/**
 * A view {@link emitKnowledgeChanges} returned answers this key with the store it wraps, so helpers
 * that find a view by identity (`pgKnowledgeTransactionClient`) can look through it. `Symbol.for`, so
 * a store package reads it without importing a newer core.
 */
const UNWRAP = Symbol.for('mastra.knowledge.unwrap');

/** The adapter's own store or transaction view under one {@link emitKnowledgeChanges} returned. Writes through it emit nothing. */
export function unwrapKnowledgeStorage(storage: KnowledgeStorage): KnowledgeStorage {
  return (storage as KnowledgeStorage & { [UNWRAP]?: KnowledgeStorage })[UNWRAP] ?? storage;
}

/**
 * Wraps `storage` so each page-store write in {@link WRITES} calls `emit` after it resolves. Writes
 * on a `transaction` view are held until that transaction commits and dropped if it rolls back; a
 * nested `transaction` hands its writes to the outer one when it succeeds. While a nested
 * transaction is open, writes through any view of that transaction chain belong to the innermost
 * one (they run inside its savepoint), so they are kept or dropped with it. A chain tracks one
 * innermost transaction, so concurrent nested transactions opened in the same chain are not
 * supported: their events would cross. Every other member passes
 * through, bound to the real store so adapters' private fields keep working. Nothing extra happens
 * while `listening()` is false. Describing or emitting an event never fails a write that committed:
 * errors go to `onError`.
 */
export function emitKnowledgeChanges(
  storage: KnowledgeStorage,
  emit: (change: Change) => void,
  listening: () => boolean,
  onError: (error: unknown) => void,
  /** Shared by every view of one top-level transaction: where their writes report now. */
  chain?: { report: (change: Change) => void },
): KnowledgeStorage {
  const report = (change: Change) => (chain ? chain.report : emit)(change);
  return new Proxy(storage, {
    get(target, property) {
      if (property === UNWRAP) return target;
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;
      if (property === 'transaction') {
        return async (operation: (tx: KnowledgeStorage) => Promise<unknown>, ...rest: unknown[]) => {
          let held: Change[] = [];
          const hold = (change: Change) => void held.push(change);
          const shared = chain ?? { report: hold };
          const outer = shared.report;
          let result: unknown;
          try {
            result = await value.call(
              target,
              (tx: KnowledgeStorage) => {
                // A store may retry the operation (LibSQL does on a lock error); only the attempt that commits counts.
                held = [];
                shared.report = hold;
                return operation(emitKnowledgeChanges(tx, hold, listening, onError, shared));
              },
              ...rest,
            );
          } finally {
            shared.report = outer;
          }
          for (const change of held) {
            try {
              report(change);
            } catch (error) {
              onError(error);
            }
          }
          return result;
        };
      }
      const describe = typeof property === 'string' ? WRITES[property] : undefined;
      if (!describe) return value.bind(target);
      const moved = typeof property === 'string' ? MOVED_PAGE[property] : undefined;
      return async (input: unknown, ...rest: unknown[]) => {
        let fromScopeId: string | undefined;
        if (moved && listening()) {
          try {
            fromScopeId = (await target.getPage({ id: moved(input), read: 'all' }))?.scopeId;
          } catch (error) {
            onError(error);
          }
        }
        const result = await value.call(target, input, ...rest);
        if (!listening()) return result;
        try {
          const change = describe(result, input, fromScopeId);
          if (change) report(change);
        } catch (error) {
          onError(error);
        }
        return result;
      };
    },
  });
}

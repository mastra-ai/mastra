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
 * Wraps `storage` so each page-store write in {@link WRITES} calls `emit` after it resolves. Every
 * other member passes through, bound to the real store so adapters' private fields keep working.
 * Nothing extra happens while `listening()` is false. Describing or emitting an event never fails a
 * write that committed: errors go to `onError`.
 */
export function emitKnowledgeChanges(
  storage: KnowledgeStorage,
  emit: (change: Change) => void,
  listening: () => boolean,
  onError: (error: unknown) => void,
): KnowledgeStorage {
  return new Proxy(storage, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;
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
          if (change) emit(change);
        } catch (error) {
          onError(error);
        }
        return result;
      };
    },
  });
}

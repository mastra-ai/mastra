import type { KnowledgeStorage } from '../storage/domains/knowledge/base';
import type { KnowledgeNote, KnowledgePage, KnowledgePin } from '../storage/domains/knowledge/pages';

/**
 * One committed write to a Knowledge store. Events carry ids only: a listener serving people (a UI
 * stream) must re-read the page under the viewer's read scope and drop what they can't read.
 * `scopeId` is the page's scope after the write; for notes and pins, read the page by `pageId`.
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

const page = (op: 'create' | 'update' | 'move' | 'delete') => (result: unknown) => {
  const { id, scopeId } = result as KnowledgePage;
  return { kind: 'page', op, pageId: id, scopeId } as Change;
};
const note = (op: 'add' | 'restamp' | 'remove' | 'restore') => (result: unknown) => {
  const { id, pageId } = result as KnowledgeNote;
  return { kind: 'note', op, pageId, noteId: id } as Change;
};

/** The page-store writes that emit, and the event each one's result maps to. */
const WRITES: Record<string, (result: unknown, input: any) => Change | null> = {
  materializeScope: result => {
    const { scope, created } = result as { scope: KnowledgePage; created: boolean };
    return created ? { kind: 'scope', op: 'create', pageId: scope.id, scopeId: scope.id } : null;
  },
  createPage: page('create'),
  updatePage: page('update'),
  movePage: page('move'),
  deletePage: page('delete'),
  mergePages: (result, input: { sourceId: string }) => {
    const { id, scopeId } = result as KnowledgePage;
    return { kind: 'page', op: 'merge', pageId: id, scopeId, sourceId: input.sourceId };
  },
  addNote: note('add'),
  restampNote: note('restamp'),
  removeNote: note('remove'),
  restoreNote: note('restore'),
  addPinAudience: result => ({ kind: 'pin', op: 'add', pageId: (result as KnowledgePin).pageId }),
  removePinAudience: (result, input: { pageId: string }) => ({ kind: 'pin', op: 'remove', pageId: input.pageId }),
};

/**
 * Wraps `storage` so each page-store write in {@link WRITES} calls `emit` after it resolves. Every
 * other member passes through, bound to the real store so adapters' private fields keep working.
 */
export function emitKnowledgeChanges(storage: KnowledgeStorage, emit: (change: Change) => void): KnowledgeStorage {
  return new Proxy(storage, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;
      const describe = typeof property === 'string' ? WRITES[property] : undefined;
      if (!describe) return value.bind(target);
      return async (input: unknown, ...rest: unknown[]) => {
        const result = await value.call(target, input, ...rest);
        const change = describe(result, input);
        if (change) emit(change);
        return result;
      };
    },
  });
}

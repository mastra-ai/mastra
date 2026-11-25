import {
  KnowledgeConflictError,
  type Knowledge,
  type KnowledgePage,
  type KnowledgeStorage,
  type KnowledgeUpsertPageInput,
  type KnowledgeUpsertPageResult,
} from '@mastra/core/knowledge';
import { knowledgePagePath } from '@mastra/core/storage';
import type { DbClient } from '@mastra/pg';

export type PageMutations = Pick<KnowledgeStorage, 'transaction'>;

/** Guard native leaf writes while preserving scope, parent, and link handling. */
export async function upsertPageAtRevision(
  knowledge: Knowledge,
  storage: KnowledgeStorage,
  input: KnowledgeUpsertPageInput & { body: string },
  expected: Pick<KnowledgePage, 'id' | 'version'> | null,
  mutations: PageMutations = storage,
  postgres?: DbClient,
): Promise<KnowledgeUpsertPageResult> {
  const { scope: scopeAddress, path: keyPath } = input;
  const destination = `${scopeAddress}#${keyPath}`;
  const path = knowledgePagePath(keyPath);
  // Abort the native retry on a leaf conflict. The native upsert still manages scope, parent and link writes.
  const conflict = new Error(`Destination changed: ${destination}`);
  async function inWriteTransaction<T>(operation: (transaction: KnowledgeStorage) => Promise<T>) {
    // LibSQL acquires its write lock when opening the transaction view.
    if (!postgres) return mutations.transaction(operation);
    // The existing PostgreSQL writer transaction holds the lock through native writes and receipts.
    await postgres.none('LOCK TABLE public.mastra_knowledge_pages IN SHARE ROW EXCLUSIVE MODE');
    return operation(storage);
  }
  const createPage: KnowledgeStorage['createPage'] = async input => {
    if (expected) throw conflict;
    if (input.body === undefined) return storage.createPage(input); // Native parent scaffolding.
    try {
      return await inWriteTransaction(async transaction => {
        const [scope] = await transaction.getScopesByAddress([scopeAddress]);
        const parent =
          scope && path.length > 1
            ? await transaction.getPageByPath({ scopeId: scope.id, path: path.slice(0, -1), read: 'all' })
            : scope;
        if (parent?.id !== input.parentId) throw conflict;
        return transaction.createPage(input);
      });
    } catch (error) {
      if ((error as Error)?.name === 'KnowledgePageKeyConflictError') throw conflict;
      throw error;
    }
  };
  const updatePage: KnowledgeStorage['updatePage'] = async input => {
    if (!expected || input.id !== expected.id || input.expectedVersion !== expected.version) throw conflict;
    try {
      return await inWriteTransaction(async transaction => {
        // Moving an ancestor can change the destination without bumping the leaf version.
        const [scope] = await transaction.getScopesByAddress([scopeAddress]);
        const current = scope && (await transaction.getPageByPath({ scopeId: scope.id, path, read: 'all' }));
        if (current?.id !== expected.id || current.version !== expected.version) throw conflict;
        return transaction.updatePage(input);
      });
    } catch (error) {
      if (['KnowledgeNotFoundError', 'KnowledgeConflictError'].includes((error as Error)?.name)) throw conflict;
      throw error;
    }
  };
  const checkedStorage = new Proxy(storage, {
    get(target, property) {
      if (property === 'createPage') return createPage;
      if (property === 'updatePage') return updatePage;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  // Callers supply a private writer instance. Limit the guard to one native upsert.
  const getStorage = knowledge.getStorage;
  knowledge.getStorage = async () => checkedStorage;
  try {
    const result = await knowledge.upsertPage(input);
    if (
      result.status === 'unchanged' &&
      (!expected || result.page.id !== expected.id || result.page.version !== expected.version)
    )
      throw conflict;
    return result;
  } catch (error) {
    if (error === conflict) throw new KnowledgeConflictError(destination);
    throw error;
  } finally {
    knowledge.getStorage = getStorage;
  }
}

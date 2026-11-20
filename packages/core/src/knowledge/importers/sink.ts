import { KnowledgeUnsupportedCapabilityError } from '../../storage/domains/knowledge/base';
import type { KnowledgeStorage } from '../../storage/domains/knowledge/base';
import type {
  KnowledgeImporterBindingRecord,
  KnowledgeImporterChangeKind,
  KnowledgeImportersStorage,
} from '../../storage/domains/knowledge/importers';
import type { KnowledgePage, KnowledgeProvenance } from '../../storage/domains/knowledge/pages';
import { refreshKnowledgeLinksTo, syncKnowledgePageBodyLinks } from '../links';
import type {
  KnowledgeImportCounts,
  KnowledgeImportDeclaration,
  KnowledgeImportItem,
  KnowledgeImportRefusal,
  KnowledgeImportRefusalReason,
  KnowledgeImporterOp,
} from './types';

/**
 * Applies one flush's ops to pages and the node map, on a transaction view. Pages are found by id
 * through the node map, never adopted by path: the binding owns its anchor (the page it created at
 * its target) and the pages its nodes point at, and nothing else.
 *
 * @internal
 */

/** The body a page keeps when its item is gone at the source but pages are still nested under it. */
export const REMOVED_PARENT_BODY = 'Removed from the source. Kept because pages are still nested under it.';

/** Embedding work for after commit. */
export type KnowledgeImportEmbedJob = { kind: 'index'; pageId: string } | { kind: 'remove'; pageId: string };

export interface KnowledgeImportChange {
  sourceId: string;
  pageId: string | null;
  change: KnowledgeImporterChangeKind;
  title: string;
  path: string;
}

export interface KnowledgeImportSinkResult {
  counts: Omit<KnowledgeImportCounts, 'refused'>;
  refused: KnowledgeImportRefusal[];
  changes: KnowledgeImportChange[];
  embeds: KnowledgeImportEmbedJob[];
  /** Whether any op wrote a page or the node map: an empty or all-refused flush applies nothing. */
  applied: boolean;
}

/** A per-item refusal: its savepoint rolls back and the flush goes on. */
export class KnowledgeImportRefusalError extends Error {
  constructor(readonly reason: KnowledgeImportRefusalReason) {
    super(`Knowledge import op refused: ${reason}`);
    this.name = 'KnowledgeImportRefusalError';
  }
}

/** Splits `<scope>#<path>`; throws on a target the sink can't own. */
export function parseKnowledgeImportTarget(target: string): { scope: string; path: string[] } {
  const hash = target.indexOf('#');
  const scope = hash < 0 ? '' : target.slice(0, hash);
  const path = hash < 0 ? [] : target.slice(hash + 1).split('/');
  if (!scope || path.length === 0 || path.some(key => !key || /[#%]/.test(key))) {
    throw new TypeError(`Importer target "${target}" must be <scope>#<path> with non-empty keys.`);
  }
  return { scope, path };
}

/** Whether two targets' owned trees would overlap: same scope and one path a prefix of the other. */
export function knowledgeImportTargetsOverlap(a: string, b: string): boolean {
  const x = parseKnowledgeImportTarget(a);
  const y = parseKnowledgeImportTarget(b);
  if (x.scope !== y.scope) return false;
  const n = Math.min(x.path.length, y.path.length);
  return x.path.slice(0, n).every((key, i) => key === y.path[i]);
}

/**
 * A reversible page key for a source ID: `/`, `#`, `%`, `:` and `~` become `~` and two hex digits,
 * and an empty ID is `~`. As Platform's sink, so imported paths match.
 */
export function knowledgeImportKey(sourceId: string): string {
  if (!sourceId) return '~';
  return sourceId.replace(/[/#%:~]/g, char => `~${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

const live = (page: KnowledgePage | null): page is KnowledgePage => !!page && !page.deletedAt && !page.mergedInto;

/** Core errors that mean "this op can't land here", by name: an adapter may carry its own core copy. */
function refusalFor(error: unknown): KnowledgeImportRefusalReason | undefined {
  if (error instanceof KnowledgeImportRefusalError) return error.reason;
  switch ((error as Error | undefined)?.name) {
    case 'KnowledgePageKeyConflictError':
      return 'occupied';
    case 'KnowledgeMoveTooLargeError':
    case 'KnowledgeConflictError':
    case 'KnowledgeNotFoundError':
    case 'KnowledgePageHasChildrenError':
      return 'conflict';
    case 'KnowledgePageDepthError':
      return 'invalid';
    default:
      return undefined;
  }
}

/**
 * Link-index work for a page the flush just wrote. Unlike host writes, a failure isn't logged and
 * skipped: it rolls the whole flush back (no pages, nodes or receipt), and the runner resends it.
 * Only a store without a link index is let through.
 */
async function syncLinks(work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    if (error instanceof KnowledgeUnsupportedCapabilityError) return;
    throw error;
  }
}

/** The ops as the sink applies them: the last op per sourceId, upserts parent-first, then removes. */
function order(ops: KnowledgeImporterOp[]): KnowledgeImporterOp[] {
  const last = new Map<string, KnowledgeImporterOp>();
  for (const op of ops) {
    const id = op.op === 'remove' ? op.sourceId : op.item.sourceId;
    const before = last.get(id);
    // A declare after an upsert in the same flush keeps the upsert's body.
    if (op.op === 'declare' && before?.op === 'upsert') {
      last.delete(id);
      last.set(id, { op: 'upsert', item: { ...before.item, ...op.item } });
      continue;
    }
    last.delete(id);
    last.set(id, op);
  }
  const writes = [...last.values()].filter(op => op.op !== 'remove') as Exclude<
    KnowledgeImporterOp,
    { op: 'remove' }
  >[];
  const removes = [...last.values()].filter(op => op.op === 'remove');
  const pending = new Map(writes.map(op => [op.item.sourceId, op]));
  const sorted: KnowledgeImporterOp[] = [];
  const visit = (op: Exclude<KnowledgeImporterOp, { op: 'remove' }>, seen: Set<string>) => {
    if (!pending.has(op.item.sourceId) || seen.has(op.item.sourceId)) return;
    seen.add(op.item.sourceId);
    for (const dep of [op.item.parent, op.item.fallbackParent]) {
      const parent = dep ? pending.get(dep) : undefined;
      if (parent) visit(parent, seen);
    }
    pending.delete(op.item.sourceId);
    sorted.push(op);
  };
  for (const op of writes) visit(op, new Set());
  return [...sorted, ...removes];
}

export interface KnowledgeImportSinkInput {
  /** A transaction view. */
  storage: KnowledgeStorage;
  importers: KnowledgeImportersStorage;
  binding: KnowledgeImporterBindingRecord;
  /** The scope page of the binding's target, materialized before the flush. */
  scope: KnowledgePage;
  runId: string;
  ops: KnowledgeImporterOp[];
  provenance: KnowledgeProvenance;
}

export async function applyKnowledgeImportFlush(input: KnowledgeImportSinkInput): Promise<KnowledgeImportSinkResult> {
  const { storage, importers, binding, scope, provenance } = input;
  const target = parseKnowledgeImportTarget(binding.target);
  const result: KnowledgeImportSinkResult = {
    counts: { created: 0, updated: 0, unchanged: 0, moved: 0, removed: 0, stubbed: 0 },
    refused: [],
    changes: [],
    embeds: [],
    applied: false,
  };
  const ops = order(input.ops);
  if (ops.length === 0) return result;

  // The page's key path from its scope, or null when its chain is broken.
  const keyPath = async (page: KnowledgePage): Promise<{ keys: string[]; ids: string[] } | null> => {
    const keys: string[] = [];
    const ids: string[] = [];
    let at: KnowledgePage | null = page;
    while (at && !at.isScope) {
      if (!live(at) || at.key === undefined) return null;
      keys.unshift(at.key);
      ids.unshift(at.id);
      at = at.parentId ? await storage.getPage({ id: at.parentId, read: 'all' }) : null;
    }
    return at?.id === scope.id ? { keys, ids } : null;
  };
  const sameKeys = (a: string[], b: string[]) => a.length === b.length && a.every((key, i) => key === b[i]);

  // The anchor: pinned by id and by its configured path. Created by the first applying flush.
  const anchor = await (async (): Promise<KnowledgePage | KnowledgeImportRefusalReason> => {
    if (binding.anchorPageId) {
      const page = await storage.getPage({ id: binding.anchorPageId, read: 'all' });
      const path = live(page) ? await keyPath(page) : null;
      if (!page || !path) return 'conflict';
      await storage.lockPages(path.ids);
      const fresh = await storage.getPage({ id: page.id, read: 'all' });
      const freshPath = live(fresh) ? await keyPath(fresh) : null;
      return fresh && freshPath && sameKeys(freshPath.keys, target.path) ? fresh : 'conflict';
    }
    if (ops.every(op => op.op === 'remove')) return 'conflict';
    return storage.transaction(async tx => {
      // The pages that already exist along the configured path, from the scope down.
      const chain = async () => {
        const pages: KnowledgePage[] = [];
        for (let depth = 1; depth <= target.path.length; depth++) {
          const page = await tx.getPageByPath({ scopeId: scope.id, path: target.path.slice(0, depth), read: 'all' });
          if (!page) break;
          pages.push(page);
        }
        return pages;
      };
      // Lock the scope and that chain, then read it again: a container moved, renamed or removed
      // while we waited changes the chain, and we start over from a fresh read. Once it reads the
      // same under lock, nothing can be added under, moved or removed from it until commit.
      for (let round = 0; round < 3; round++) {
        const before = await chain();
        await tx.lockPages([scope.id, ...before.map(page => page.id)]);
        const locked = await chain();
        if (locked.length !== before.length || locked.some((page, i) => page.id !== before[i]!.id)) continue;
        if (locked.length === target.path.length) return 'occupied' as const;
        // Containers along the way are ordinary pages; only the last key is the binding's own.
        let parent: KnowledgePage = locked.at(-1) ?? scope;
        for (let depth = locked.length + 1; depth <= target.path.length; depth++) {
          const key = target.path[depth - 1]!;
          parent = await tx.createPage({ parentId: parent.id, key, name: key, provenance });
          result.embeds.push({ kind: 'index', pageId: parent.id });
        }
        if (!(await importers.setBindingAnchor({ bindingId: binding.id, expected: null, pageId: parent.id }))) {
          throw new KnowledgeImportRefusalError('conflict');
        }
        result.applied = true;
        return parent;
      }
      throw new KnowledgeImportRefusalError('conflict');
    });
  })().catch(error => {
    const reason = refusalFor(error);
    if (!reason) throw error;
    return reason;
  });

  if (typeof anchor === 'string') {
    for (const op of ops)
      result.refused.push({ sourceId: op.op === 'remove' ? op.sourceId : op.item.sourceId, reason: anchor });
    return result;
  }
  const anchorPath = target.path;

  // A page this binding owns, checked after locking: live, under the anchor, mapped back to the node.
  const owned = async (pageId: string, sourceId?: string): Promise<{ page: KnowledgePage; keys: string[] }> => {
    const read = async () => {
      const page = await storage.getPage({ id: pageId, read: 'all' });
      const path = live(page) ? await keyPath(page) : null;
      return page && path ? { page, path } : null;
    };
    const before = await read();
    if (!before) throw new KnowledgeImportRefusalError('conflict');
    await storage.lockPages(before.path.ids);
    const after = await read();
    const under =
      after && sameKeys(after.path.keys.slice(0, anchorPath.length), anchorPath) && after.path.ids.includes(anchor.id);
    if (!after || !under) throw new KnowledgeImportRefusalError('conflict');
    if (after.page.id !== anchor.id) {
      const node = await importers.getNodeByPage(after.page.id);
      if (!node || node.bindingId !== binding.id || (sourceId !== undefined && node.sourceId !== sourceId)) {
        throw new KnowledgeImportRefusalError('conflict');
      }
    }
    return { page: after.page, keys: after.path.keys };
  };

  // Another binding's pages: its anchor or one of its nodes. Read once per flush.
  let otherAnchors: Set<string> | undefined;
  /**
   * Locks the live subtree under a page this binding is about to move or stub, and refuses the op if
   * any page in that locked set belongs to another binding. Human pages are fine: they move with
   * their parent, as a human move would carry them. The set checked is the set a following
   * `movePage` moves, since nothing can join or leave it until commit.
   */
  const assertSubtreeOwned = async (pageId: string) => {
    otherAnchors ??= new Set(
      (await importers.listBindings()).flatMap(b => (b.id !== binding.id && b.anchorPageId ? [b.anchorPageId] : [])),
    );
    for (const id of await storage.lockSubtree(pageId)) {
      if (otherAnchors.has(id)) throw new KnowledgeImportRefusalError('conflict');
      const node = await importers.getNodeByPage(id);
      if (node && node.bindingId !== binding.id) throw new KnowledgeImportRefusalError('conflict');
    }
  };

  const nodeOf = async (sourceId: string | null | undefined) =>
    sourceId ? importers.getNode(binding.id, sourceId) : null;

  const ref = (keys: string[]) => `${target.scope}#${keys.join('/')}`;

  const renderBody = async (item: KnowledgeImportItem): Promise<{ body: string; unresolved: string[] }> => {
    const lines = new Set<string>();
    const unresolved: string[] = [];
    for (const link of item.links ?? []) {
      const node = await importers.getNode(binding.id, link.sourceId);
      const page = node ? await storage.getPage({ id: node.pageId, read: 'all' }) : null;
      const path = live(page) ? await keyPath(page) : null;
      if (!path) {
        unresolved.push(link.sourceId);
        continue;
      }
      lines.add(`- ${link.rel ? `${link.rel}: ` : ''}[[${ref(path.keys)}]]`);
    }
    const body = item.body.trim();
    return {
      body: lines.size ? [body, `Links:\n${[...lines].join('\n')}`].filter(Boolean).join('\n\n') : body,
      unresolved,
    };
  };

  const write = async (
    item: KnowledgeImportDeclaration & Partial<Pick<KnowledgeImportItem, 'body' | 'description' | 'links' | 'aliases'>>,
    hasBody: boolean,
  ) => {
    const existing = await importers.getNode(binding.id, item.sourceId);
    // Where it goes: its parent's page, else its holding item's page, else the anchor.
    const parentNode = (await nodeOf(item.parent)) ?? (await nodeOf(item.fallbackParent));
    const destination = parentNode
      ? await owned(parentNode.pageId, parentNode.sourceId)
      : { page: anchor, keys: anchorPath };
    if (existing && destination.page.id === existing.pageId) throw new KnowledgeImportRefusalError('invalid');

    const rendered = hasBody ? await renderBody(item as KnowledgeImportItem) : undefined;
    const fields = {
      name: item.title,
      ...(item.description !== undefined ? { description: item.description } : {}),
      ...(rendered ? { body: rendered.body } : {}),
    };
    const key = knowledgeImportKey(item.sourceId);
    let page: KnowledgePage;
    let change: KnowledgeImporterChangeKind | 'unchanged';
    let moved = false;
    let renamed = false;

    if (!existing) {
      page = await storage.createPage({
        parentId: destination.page.id,
        key,
        ...fields,
        body: fields.body ?? '',
        provenance,
      });
      change = 'created';
    } else {
      const current = await owned(existing.pageId, item.sourceId);
      page = current.page;
      if (page.parentId !== destination.page.id) {
        // A page can't move under its own subtree.
        if (
          destination.keys.length > current.keys.length &&
          sameKeys(destination.keys.slice(0, current.keys.length), current.keys)
        ) {
          throw new KnowledgeImportRefusalError('invalid');
        }
        await assertSubtreeOwned(page.id);
        page = await storage.movePage({
          id: page.id,
          expectedVersion: page.version,
          parentId: destination.page.id,
          provenance,
        });
        moved = true;
      }
      const same =
        fields.name === page.name &&
        (fields.description === undefined || fields.description === (page.description ?? '')) &&
        (fields.body === undefined || fields.body === (page.body ?? ''));
      if (!same) {
        renamed = fields.name !== page.name;
        page = await storage.updatePage({ id: page.id, expectedVersion: page.version, ...fields, provenance });
      }
      change = !same ? 'updated' : moved ? 'moved' : 'unchanged';
    }

    await importers.saveNode({
      bindingId: binding.id,
      sourceId: item.sourceId,
      pageId: page.id,
      kind: item.kind ?? existing?.kind ?? null,
      parentSourceId: item.parent ?? null,
      aliases: item.aliases ?? existing?.aliases ?? [],
      unresolvedLinks: rendered ? rendered.unresolved : (existing?.unresolvedLinks ?? []),
      stub: false,
    });

    if (change !== 'unchanged' || existing?.stub) {
      await syncLinks(async () => {
        await syncKnowledgePageBodyLinks(storage, page);
        if (change === 'created' || renamed || moved) {
          await refreshKnowledgeLinksTo(storage, [page], { withDescendants: moved });
        }
      });
    }
    return { page, change, moved };
  };

  // Removes child-first: deepest current page first, so a parent removed with its children is deleted, not stubbed.
  const depth = new Map<string, number>();
  for (const op of ops) {
    if (op.op !== 'remove') continue;
    const node = await importers.getNode(binding.id, op.sourceId);
    const page = node ? await storage.getPage({ id: node.pageId, read: 'all' }) : null;
    const path = live(page) ? await keyPath(page) : null;
    depth.set(op.sourceId, path?.keys.length ?? 0);
  }
  const writes = ops.filter(op => op.op !== 'remove');
  const removes = ops
    .filter((op): op is Extract<KnowledgeImporterOp, { op: 'remove' }> => op.op === 'remove')
    .sort((a, b) => depth.get(b.sourceId)! - depth.get(a.sourceId)!);

  for (const op of [...writes, ...removes]) {
    const sourceId = op.op === 'remove' ? op.sourceId : op.item.sourceId;
    const embeds: KnowledgeImportEmbedJob[] = [];
    try {
      await storage.transaction(async () => {
        if (op.op === 'remove') {
          const node = await importers.getNode(binding.id, sourceId);
          if (!node) return;
          const current = await owned(node.pageId, sourceId);
          // Stub or delete is decided on the locked subtree, which must hold no other binding's page.
          await assertSubtreeOwned(current.page.id);
          const children =
            (await storage.countChildPages({ parentIds: [current.page.id], read: 'all' }))[current.page.id] ?? 0;
          if (children > 0) {
            if (node.stub) return;
            const page = await storage.updatePage({
              id: current.page.id,
              expectedVersion: current.page.version,
              body: REMOVED_PARENT_BODY,
              provenance,
            });
            await importers.saveNode({ ...node, stub: true });
            await syncLinks(() => syncKnowledgePageBodyLinks(storage, page));
            embeds.push({ kind: 'index', pageId: page.id });
            result.counts.stubbed++;
            result.changes.push({
              sourceId,
              pageId: page.id,
              change: 'stubbed',
              title: page.name,
              path: ref(current.keys),
            });
          } else {
            const deleted = await storage.deletePage({
              id: current.page.id,
              expectedVersion: current.page.version,
              deletedBy: provenance.author,
            });
            await importers.deleteNode(binding.id, sourceId);
            await syncLinks(async () => {
              await syncKnowledgePageBodyLinks(storage, deleted);
              await refreshKnowledgeLinksTo(storage, [deleted]);
            });
            embeds.push({ kind: 'remove', pageId: deleted.id });
            result.counts.removed++;
            result.changes.push({
              sourceId,
              pageId: null,
              change: 'removed',
              title: deleted.name,
              path: ref(current.keys),
            });
          }
          result.applied = true;
          return;
        }
        const { page, change, moved } = await write(op.item, op.op === 'upsert');
        if (change === 'unchanged') {
          result.counts.unchanged++;
          return;
        }
        result.applied = true;
        if (change !== 'moved') embeds.push({ kind: 'index', pageId: page.id });
        if (change === 'created') result.counts.created++;
        else if (change === 'updated') result.counts.updated++;
        if (moved) result.counts.moved++;
        const path = await keyPath(page);
        result.changes.push({ sourceId, pageId: page.id, change, title: page.name, path: path ? ref(path.keys) : '' });
      });
      result.embeds.push(...embeds);
    } catch (error) {
      const reason = refusalFor(error);
      if (!reason) throw error;
      result.refused.push({ sourceId, reason });
    }
  }
  return result;
}

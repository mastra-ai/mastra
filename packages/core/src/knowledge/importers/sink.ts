import { randomUUID } from 'node:crypto';

import { KnowledgeUnsupportedCapabilityError } from '../../storage/domains/knowledge/base';
import type { KnowledgeStorage } from '../../storage/domains/knowledge/base';
import type {
  KnowledgeImporterBindingRecord,
  KnowledgeImporterChangeKind,
  KnowledgeImporterNodeLink,
  KnowledgeImporterNodeRecord,
  KnowledgeImportersStorage,
} from '../../storage/domains/knowledge/importers';
import type { KnowledgePage, KnowledgeProvenance } from '../../storage/domains/knowledge/pages';
import {
  KnowledgeLinkRefreshIncompleteError,
  MAX_KNOWLEDGE_LINK_REFRESH_SOURCES,
  knowledgeSubtree,
  refreshKnowledgeLinksTo,
  syncKnowledgePageBodyLinks,
} from '../links';
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
 * through the node map: the binding tracks its anchor (the folder at its target) and the pages its
 * nodes point at. A page already at a new item's path is taken over by that item's node, whoever
 * wrote it, and kept as a stub rather than deleted when the item is removed.
 *
 * @internal
 */

/** The body a page keeps when its item is gone at the source but pages are still nested under it. */
export const REMOVED_PARENT_BODY = 'Removed from the source. Kept because pages are still nested under it.';
export const REMOVED_FOLDER_BODY = 'Removed from the source. Kept because another importer writes under it.';
export const REMOVED_ADOPTED_BODY = 'Removed from the source. Kept because the page was here before the import.';
const REMOVED_BODIES = new Set([REMOVED_PARENT_BODY, REMOVED_FOLDER_BODY, REMOVED_ADOPTED_BODY]);
/** Heads the note that keeps the body a page had before an importer took it over. */
export const ORIGINAL_BODY_NOTE = 'The body this page had before an importer took it over:\n\n';
/** Every heading a kept-body note has been written with, newest first; removal recognizes them all. */
const ORIGINAL_BODY_NOTE_HEADINGS = [ORIGINAL_BODY_NOTE, 'Written by hand before an importer took over this page:\n\n'];
/**
 * Kept-body notes on a page have ids starting with this. Each takeover writes a new one and removes
 * the earlier, so removal finds the body from the latest takeover. Notes written before takeovers
 * had their own id used the prefix alone.
 */
const originalBodyNotePrefix = (pageId: string) => `knowledge-import-original:${pageId}`;

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
  /** Present when the flush ran a settle slice. */
  settle?: KnowledgeImportSettleResult;
}

/** Bounds for one settle slice (O3 §C, §C′): a slice never drains everything. */
export interface KnowledgeImportSettleBudget {
  /** The unsettled node to start after: where the last slice stopped. Null starts a pass. */
  after: string | null;
  /** Unsettled nodes examined at most. */
  candidates: number;
  /** Page moves at most. */
  moves: number;
  /** Epoch ms: the slice stops before the next candidate once this has passed. */
  until: number;
  /** Called as the slice starts, so a host can tell a timeout while settling from one before it. */
  onStart?: () => void;
}

export interface KnowledgeImportSettleResult {
  /** The pass isn't through the binding's unsettled nodes: another slice should run. */
  pending: boolean;
  /** Where the next slice starts; null when the pass ended and the next one starts over. */
  cursor: string | null;
  /** Moves and relinks this slice landed. */
  settled: number;
  /** The slice ran from the first unsettled node, so it saw every repair queued before it started. */
  fromStart: boolean;
}

/**
 * Host state key another binding's flush sets, to a fresh value, when it queues link repairs on
 * this binding's pages. Those pages may sort before this binding's saved settle cursor, so its next
 * slice starts the pass over when the value differs from {@link KNOWLEDGE_IMPORT_SETTLE_SEEN_KEY}.
 * The binding's own flushes never write this key, so a flush that read the state earlier can't undo it.
 */
export const KNOWLEDGE_IMPORT_SETTLE_RESTART_KEY = 'mastra:settle:restart';
/** The {@link KNOWLEDGE_IMPORT_SETTLE_RESTART_KEY} value the binding's settling last started over for. */
export const KNOWLEDGE_IMPORT_SETTLE_SEEN_KEY = 'mastra:settle:seen';

/** An unresolved link as the node map lists it, with its label. */
const encodeLink = (link: KnowledgeImporterNodeLink) => JSON.stringify([link.sourceId, link.rel]);
const LINKS_HEADING = 'Links:';

/**
 * The links section for these lines, or null for none. Lines are sorted, so a body written in one
 * flush and one completed by a later settle match.
 */
const linkSection = (lines: Iterable<string>): string | null => {
  const sorted = [...new Set(lines)].sort();
  return sorted.length ? `${LINKS_HEADING}\n${sorted.join('\n')}` : null;
};
const withSection = (text: string, section: string | null) =>
  section === null ? text : text ? `${text}\n\n${section}` : section;
/**
 * The source's own text in a body the sink wrote with `section` at its end, byte for byte; null when
 * the body no longer ends with that section, because someone edited the page since.
 */
const ownText = (body: string, section: string | null): string | null => {
  if (section === null) return body;
  if (body === section) return '';
  return body.endsWith(`\n\n${section}`) ? body.slice(0, body.length - section.length - 2) : null;
};

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
 * Only a store without a link index, and a refresh that landed but stopped at its cap (more than 100
 * linking pages, or more than 99 pages sharing a name), are let through: resending would stop at
 * the same cap every time.
 */
async function syncLinks(work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    if (error instanceof KnowledgeUnsupportedCapabilityError || error instanceof KnowledgeLinkRefreshIncompleteError) {
      return;
    }
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
  /** Run one settle slice after the ops. */
  settle?: KnowledgeImportSettleBudget;
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
  // An empty flush only settles, and there is nothing to settle before the anchor exists.
  if (ops.length === 0 && !(input.settle && binding.anchorPageId)) {
    if (input.settle) result.settle = { pending: false, cursor: null, settled: 0, fromStart: false };
    return result;
  }

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

  /**
   * Marks another binding's pages that link to `targets` for repair, and has its next settle slice
   * start the pass over: they may sort before its saved cursor.
   */
  const queueRepairs = async (bindingId: string, targets: string[]) => {
    await importers.markLinkingNodesUnsettled(bindingId, targets);
    if (bindingId !== binding.id) {
      await importers.setState(bindingId, { [KNOWLEDGE_IMPORT_SETTLE_RESTART_KEY]: randomUUID() });
    }
  };

  /**
   * Stops another binding tracking a page as its item, so this one can take it over: its node is
   * dropped and that binding's links to it are marked for repair. Says whether it was an item. A
   * page that is another binding's folder stays its folder: folders are shared, so taking one over
   * never stops that binding writing or removing under it.
   */
  const release = async (pageId: string) => {
    const node = await importers.getNodeByPage(pageId);
    if (!node) return false;
    await queueRepairs(node.bindingId, [node.sourceId]);
    await importers.deleteNode(node.bindingId, node.sourceId);
    return true;
  };

  // The anchor: pinned by id. A person may move it, and the binding keeps writing under it where
  // they put it. Gone (deleted, or moved into another scope), it is made again at the configured path
  // by the next flush that writes. Removals don't need it: they find their pages through the nodes.
  const anchor = await (async (): Promise<
    { page: KnowledgePage; keys: string[] } | KnowledgeImportRefusalReason | null
  > => {
    if (binding.anchorPageId) {
      const page = await storage.getPage({ id: binding.anchorPageId, read: 'all' });
      const path = live(page) ? await keyPath(page) : null;
      if (page && path) {
        await storage.lockPages(path.ids);
        const fresh = await storage.getPage({ id: page.id, read: 'all' });
        const freshPath = live(fresh) ? await keyPath(fresh) : null;
        if (fresh && freshPath) return { page: fresh, keys: freshPath.keys };
      }
      if (
        !(await importers.setBindingAnchor({ bindingId: binding.id, expected: binding.anchorPageId, pageId: null }))
      ) {
        throw new KnowledgeImportRefusalError('conflict');
      }
    }
    if (ops.every(op => op.op === 'remove')) return null;
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
        let parent: KnowledgePage = locked.at(-1) ?? scope;
        // A page already at the target, whoever wrote it, becomes the binding's folder too, its
        // body and children kept. It stays whatever it was to other bindings: their folder, or an
        // item they keep updating.
        // One of this binding's own items left there by a rebind stops being an item: a page can't
        // be both the folder and an item under it.
        if (locked.length === target.path.length) {
          const own = await importers.getNodeByPage(parent.id);
          if (own?.bindingId === binding.id) await importers.deleteNode(binding.id, own.sourceId);
        }
        // Containers along the way are ordinary pages; only the last key is the binding's own.
        for (let depth = locked.length + 1; depth <= target.path.length; depth++) {
          const key = target.path[depth - 1]!;
          parent = await tx.createPage({ parentId: parent.id, key, name: key, provenance });
          result.embeds.push({ kind: 'index', pageId: parent.id });
        }
        if (!(await importers.setBindingAnchor({ bindingId: binding.id, expected: null, pageId: parent.id }))) {
          throw new KnowledgeImportRefusalError('conflict');
        }
        result.applied = true;
        return { page: parent, keys: target.path };
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
  const anchorPath = anchor?.keys ?? [];

  /**
   * A page this binding owns, checked after locking: live, in the target's scope, mapped back to the
   * node. A person may have moved it out of the anchor, under anyone's pages: it is still the
   * binding's and is updated where they put it (`outside`).
   */
  const owned = async (
    pageId: string,
    sourceId?: string,
  ): Promise<{ page: KnowledgePage; keys: string[]; outside: boolean }> => {
    const read = async () => {
      const page = await storage.getPage({ id: pageId, read: 'all' });
      const path = live(page) ? await keyPath(page) : null;
      return page && path ? { page, path } : null;
    };
    const before = await read();
    if (!before) throw new KnowledgeImportRefusalError('conflict');
    await storage.lockPages(before.path.ids);
    const after = await read();
    if (!after) throw new KnowledgeImportRefusalError('conflict');
    const outside =
      !anchor ||
      !(sameKeys(after.path.keys.slice(0, anchorPath.length), anchorPath) && after.path.ids.includes(anchor.page.id));
    if (after.page.id !== anchor?.page.id) {
      const node = await importers.getNodeByPage(after.page.id);
      if (!node || node.bindingId !== binding.id || (sourceId !== undefined && node.sourceId !== sourceId)) {
        throw new KnowledgeImportRefusalError('conflict');
      }
    }
    return { page: after.page, keys: after.path.keys, outside };
  };

  const nodeOf = async (sourceId: string | null | undefined) =>
    sourceId ? importers.getNode(binding.id, sourceId) : null;

  // Someone deleted the node's page by hand, or moved it into another scope. The source is still the
  // source of truth, so the item is written again as if new at its configured path; a page in another
  // scope stays there as an ordinary page. A page merged into another is not gone: its content lives
  // on there.
  const gone = async (node: KnowledgeImporterNodeRecord) => {
    const page = await storage.getPage({ id: node.pageId, read: 'all' });
    return !page || (!!page.deletedAt && !page.mergedInto) || (live(page) && page.scopeId !== scope.id);
  };
  /**
   * Drops the node of a page that is gone, so its item is written again as new. Pages that linked to
   * it still name its old path: this binding's linking items are marked unsettled so a settle slice
   * renders their links section from wherever the item lands, and Knowledge's own link index is
   * refreshed for the old page's refs. Keep that refresh: the sink's own removal does the same, and
   * a page deleted without going through `removePage` would otherwise leave stale index rows.
   */
  /** A page's live kept-body notes, oldest first. */
  const keptBodyNotes = async (pageId: string) => {
    const prefix = originalBodyNotePrefix(pageId);
    const kept = [];
    let cursor: string | undefined;
    do {
      const out = await storage.listNotes({ pageId, read: 'all', ...(cursor ? { cursor } : {}) });
      kept.push(...out.notes.filter(note => note.id === prefix || note.id.startsWith(`${prefix}:`)));
      cursor = out.nextCursor;
    } while (cursor);
    return kept;
  };
  /**
   * Saves the body a page has as it is taken over, in place of any earlier takeover's. An empty body
   * keeps no note, so a removal stubs the page rather than bringing back a body a person cleared.
   */
  const keepBody = async (pageId: string, body: string) => {
    for (const earlier of await keptBodyNotes(pageId)) {
      await storage.removeNote({ id: earlier.id, deletedBy: provenance.author, provenance });
    }
    if (!body) return;
    await storage.addNote({
      id: `${originalBodyNotePrefix(pageId)}:${randomUUID()}`,
      pageId,
      text: ORIGINAL_BODY_NOTE + body,
      stampScopeIds: [scope.id],
      mentions: [],
      provenance,
    });
  };

  const forget = async (node: KnowledgeImporterNodeRecord) => {
    const old = await storage.getPage({ id: node.pageId, read: 'all' });
    await importers.markLinkingNodesUnsettled(binding.id, [node.sourceId]);
    await importers.deleteNode(binding.id, node.sourceId);
    if (old) await syncLinks(() => refreshKnowledgeLinksTo(storage, [old]));
  };
  const liveNodeOf = async (sourceId: string | null | undefined) => {
    const node = await nodeOf(sourceId);
    return node && !(await gone(node)) ? node : null;
  };

  const ref = (keys: string[]) => `${target.scope}#${keys.join('/')}`;

  // A link's line, or null while its target has no live page.
  const linkLine = async (link: KnowledgeImporterNodeLink): Promise<string | null> => {
    const node = await importers.getNode(binding.id, link.sourceId);
    const page = node ? await storage.getPage({ id: node.pageId, read: 'all' }) : null;
    const path = live(page) ? await keyPath(page) : null;
    return path ? `- ${link.rel ? `${link.rel}: ` : ''}[[${ref(path.keys)}]]` : null;
  };
  // The links section for where the links' targets are now, and the links still waiting on one.
  const renderLinks = async (links: KnowledgeImporterNodeLink[]) => {
    const lines: string[] = [];
    const unresolved: string[] = [];
    for (const link of links) {
      const line = await linkLine(link);
      if (line) lines.push(line);
      else unresolved.push(encodeLink(link));
    }
    return { section: linkSection(lines), unresolved };
  };
  type Rendered = { body: string; links: KnowledgeImporterNodeLink[]; section: string | null; unresolved: string[] };
  const renderBody = async (item: KnowledgeImportItem): Promise<Rendered> => {
    const links = (item.links ?? []).map(link => ({ sourceId: link.sourceId, rel: link.rel ?? null }));
    const { section, unresolved } = await renderLinks(links);
    return { body: withSection(item.body.trim(), section), links, section, unresolved };
  };
  /**
   * Writes a node's links section again from where its targets are now. Only the section the sink
   * wrote is replaced; the source's text before it stays byte for byte. A page edited past that
   * section is left as it is, with nothing left waiting, until the source sends it again.
   */
  const relink = async (
    node: KnowledgeImporterNodeRecord,
    current: KnowledgePage,
  ): Promise<{ page: KnowledgePage; changed: boolean; section: string | null; unresolved: string[] }> => {
    const text = ownText(current.body ?? '', node.linkSection);
    if (text === null) return { page: current, changed: false, section: node.linkSection, unresolved: [] };
    const { section, unresolved } = await renderLinks(node.links);
    const body = withSection(text, section);
    if (body === (current.body ?? '')) return { page: current, changed: false, section, unresolved };
    const page = await storage.updatePage({ id: current.id, expectedVersion: current.version, body, provenance });
    await syncLinks(() => syncKnowledgePageBodyLinks(storage, page));
    return { page, changed: true, section, unresolved };
  };
  // Away from its source parent: that parent hasn't arrived, or the page isn't under it yet.
  // A page a person moved out of the target is where they want it, not misplaced.
  const misplacedAt = async (node: KnowledgeImporterNodeRecord, page: KnowledgePage, outside: boolean) => {
    if (!node.parentSourceId || outside) return false;
    const parent = await nodeOf(node.parentSourceId);
    return !parent || page.parentId !== parent.pageId;
  };

  type Relinked = { sourceId: string; page: KnowledgePage; keys: string[] };
  /**
   * Moves an owned page, `self`'s, under `parentId`, then rewrites the links sections of this
   * binding's pages that link to it or to an imported page in its subtree. Generated links are
   * paths, so without this a linking page that isn't sent again would keep pointing at where they
   * were. Other bindings' pages can move with the subtree too: their linking pages are marked
   * unsettled, one statement per binding, and each binding's next settle slice rewrites them. Of
   * this binding's, all are marked unsettled in one statement; up to
   * {@link MAX_KNOWLEDGE_LINK_REFRESH_SOURCES} are rewritten here and the rest by the settle slices
   * that follow. `self` is left to the caller, which writes its body anyway. Returns the moved page
   * and the pages it rewrote; the caller counts them once its op lands.
   */
  // Set once a move leaves linking pages for settle to repair: they may sort before the settle
  // cursor, so a pass that reaches the end then starts again from the first unsettled node.
  let deferredLinkers = false;
  const moveOwned = async (
    self: string,
    page: KnowledgePage,
    parent: { page: KnowledgePage; keys: string[] },
  ): Promise<{ page: KnowledgePage; keys: string[]; relinked: Relinked[] }> => {
    const targets: string[] = [];
    const othersTargets = new Map<string, string[]>();
    // Locked first, so the subtree read here is the one `movePage` carries.
    await storage.lockSubtree(page.id);
    for (const p of await knowledgeSubtree(storage, page)) {
      const node = await importers.getNodeByPage(p.id);
      if (!node) continue;
      if (node.bindingId === binding.id) targets.push(node.sourceId);
      else othersTargets.set(node.bindingId, [...(othersTargets.get(node.bindingId) ?? []), node.sourceId]);
    }
    const moved = await storage.movePage({
      id: page.id,
      expectedVersion: page.version,
      parentId: parent.page.id,
      provenance,
    });
    const keys = [...parent.keys, moved.key!];

    const relinked: Relinked[] = [];
    for (const [other, theirs] of othersTargets) await queueRepairs(other, theirs);
    await importers.markLinkingNodesUnsettled(binding.id, targets);
    const linking = await importers.listLinkingNodes(binding.id, targets, {
      limit: MAX_KNOWLEDGE_LINK_REFRESH_SOURCES + 1,
    });
    if (linking.next || linking.items.filter(id => id !== self).length > MAX_KNOWLEDGE_LINK_REFRESH_SOURCES) {
      deferredLinkers = true;
    }
    for (const sourceId of linking.items.filter(id => id !== self).slice(0, MAX_KNOWLEDGE_LINK_REFRESH_SOURCES)) {
      const node = await importers.getNode(binding.id, sourceId);
      if (!node) continue;
      let current: Awaited<ReturnType<typeof owned>>;
      try {
        current = await owned(node.pageId, sourceId);
      } catch (error) {
        // It stays unsettled; a settle slice tries it again.
        if (!refusalFor(error)) throw error;
        deferredLinkers = true;
        continue;
      }
      const out = await relink(node, current.page);
      await importers.saveNode({
        ...node,
        linkSection: out.section,
        unresolvedLinks: out.unresolved,
        unsettled: (await misplacedAt(node, out.page, current.outside)) || out.unresolved.length > 0,
      });
      if (out.changed) relinked.push({ sourceId, page: out.page, keys: current.keys });
    }
    return { page: moved, keys, relinked };
  };
  const recordRelinked = (relinked: Relinked[], embeds: KnowledgeImportEmbedJob[]) => {
    for (const { sourceId, page, keys } of relinked) {
      result.applied = true;
      result.counts.updated++;
      embeds.push({ kind: 'index', pageId: page.id });
      result.changes.push({ sourceId, pageId: page.id, change: 'updated', title: page.name, path: ref(keys) });
    }
  };

  const write = async (
    item: KnowledgeImportDeclaration & Partial<Pick<KnowledgeImportItem, 'body' | 'description' | 'links' | 'aliases'>>,
    hasBody: boolean,
  ) => {
    let existing = await importers.getNode(binding.id, item.sourceId);
    if (existing && (await gone(existing))) {
      await forget(existing);
      existing = null;
    }
    // Where it goes: its parent's page, else its holding item's page, else the anchor. Placed
    // anywhere but under its parent, it waits for a settle slice to move it there.
    const sourceParent = await liveNodeOf(item.parent);
    const misplaced = !!item.parent && !sourceParent;
    const parentNode = sourceParent ?? (await liveNodeOf(item.fallbackParent));
    // A flush with writes always has an anchor.
    const destination = parentNode ? await owned(parentNode.pageId, parentNode.sourceId) : anchor!;
    if (existing && destination.page.id === existing.pageId) throw new KnowledgeImportRefusalError('invalid');

    let rendered: (Pick<Rendered, 'links' | 'section' | 'unresolved'> & { body?: string }) | undefined = hasBody
      ? await renderBody(item as KnowledgeImportItem)
      : undefined;
    let fields = {
      name: item.title,
      ...(item.description !== undefined ? { description: item.description } : {}),
      ...(rendered ? { body: rendered.body } : {}),
    };
    const key = knowledgeImportKey(item.sourceId);
    let page: KnowledgePage;
    let change: KnowledgeImporterChangeKind | 'unchanged';
    let moved = false;
    let renamed = false;
    let relinked: Relinked[] = [];
    let rewrote = false;
    let adopted = existing?.adopted ?? false;

    // A page someone else wrote at the item's path is taken over: it keeps its id and children, and
    // the item's fields replace its own. The page's earlier body is kept in a note on the page, and comes
    // back when the source removes the item. A page another binding imported is taken too, and that
    // binding stops tracking it; its next import writes the item again where it belongs. Only the
    // page found at the path is locked; when the path is empty, the unique key on (parent, key)
    // refuses a page created there concurrently.
    const held = existing
      ? null
      : await storage.getPageByPath({ scopeId: scope.id, path: [...destination.keys, key], read: 'all' });
    if (held) {
      await storage.lockPages([held.id]);
      const fresh = await storage.getPage({ id: held.id, read: 'all' });
      if (!live(fresh) || fresh.parentId !== destination.page.id || fresh.key !== key) {
        throw new KnowledgeImportRefusalError('occupied');
      }
      const imported = await release(fresh.id);
      renamed = fields.name !== fresh.name;
      // Saved whatever this op sends: a later upsert, not this one, may be what replaces the body.
      if (!imported) await keepBody(fresh.id, fresh.body ?? '');
      page = await storage.updatePage({ id: fresh.id, expectedVersion: fresh.version, ...fields, provenance });
      change = 'updated';
      adopted = true;
    } else if (!existing) {
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
      // An item sent again after its removal takes the page over again: the body it has now, which
      // someone may have edited since, is the one its next removal gives back.
      if (existing.stub && existing.adopted && !REMOVED_BODIES.has(page.body ?? '')) {
        await keepBody(page.id, page.body ?? '');
      }
      // A page a person moved out of the target stays where they put it.
      if (!current.outside && page.parentId !== destination.page.id) {
        // A page can't move under its own subtree.
        if (
          destination.keys.length > current.keys.length &&
          sameKeys(destination.keys.slice(0, current.keys.length), current.keys)
        ) {
          throw new KnowledgeImportRefusalError('invalid');
        }
        ({ page, relinked } = await moveOwned(item.sourceId, page, destination));
        moved = true;
        // Its own links into its subtree were rendered at the old path.
        if (hasBody) {
          rendered = await renderBody(item as KnowledgeImportItem);
          fields = { ...fields, body: rendered.body! };
        }
      }
      // A declare keeps the body, so its links section is written again here from where its targets
      // are now: it may be waiting on a repair a move deferred, and saving the node settles it.
      if (!hasBody) {
        const out = await relink(existing, page);
        page = out.page;
        rewrote = out.changed;
        rendered = { links: existing.links, section: out.section, unresolved: out.unresolved };
      }
      const same =
        fields.name === page.name &&
        (fields.description === undefined || fields.description === (page.description ?? '')) &&
        (fields.body === undefined || fields.body === (page.body ?? ''));
      if (!same) {
        renamed = fields.name !== page.name;
        page = await storage.updatePage({ id: page.id, expectedVersion: page.version, ...fields, provenance });
      }
      change = !same || rewrote ? 'updated' : moved ? 'moved' : 'unchanged';
    }

    await importers.saveNode({
      bindingId: binding.id,
      sourceId: item.sourceId,
      pageId: page.id,
      kind: item.kind ?? existing?.kind ?? null,
      parentSourceId: item.parent ?? null,
      aliases: item.aliases ?? existing?.aliases ?? [],
      unresolvedLinks: rendered ? rendered.unresolved : (existing?.unresolvedLinks ?? []),
      links: rendered ? rendered.links : (existing?.links ?? []),
      linkSection: rendered ? rendered.section : (existing?.linkSection ?? null),
      stub: false,
      adopted,
      unsettled: misplaced || (rendered ? rendered.unresolved : (existing?.unresolvedLinks ?? [])).length > 0,
    });

    if (change !== 'unchanged' || existing?.stub) {
      await syncLinks(async () => {
        await syncKnowledgePageBodyLinks(storage, page);
        if (change === 'created' || renamed || moved) {
          await refreshKnowledgeLinksTo(storage, [page], { withDescendants: moved });
        }
      });
    }
    return { page, change, moved, relinked };
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
          if (await gone(node)) {
            await forget(node);
            result.applied = true;
            return;
          }
          const current = await owned(node.pageId, sourceId);
          // Stub or delete is decided on the locked subtree: nothing can join or leave it until commit.
          await storage.lockSubtree(current.page.id);
          const children =
            (await storage.countChildPages({ parentIds: [current.page.id], read: 'all' }))[current.page.id] ?? 0;
          // A page the binding took over is never deleted, even as a leaf, and neither is a page that
          // is another binding's folder: that binding keeps writing under it.
          const folder = (await importers.listBindings()).some(
            other => other.id !== binding.id && other.anchorPageId === current.page.id,
          );
          if (children > 0 || node.adopted || folder) {
            if (node.stub) return;
            // A page it took over gets its earlier body back, as the note kept it.
            const note = node.adopted ? (await keptBodyNotes(current.page.id)).at(-1) : undefined;
            const heading = ORIGINAL_BODY_NOTE_HEADINGS.find(h => note?.text.startsWith(h));
            const original = heading ? note!.text.slice(heading.length) : note?.text;
            const page = await storage.updatePage({
              id: current.page.id,
              expectedVersion: current.page.version,
              body:
                original || (children > 0 ? REMOVED_PARENT_BODY : folder ? REMOVED_FOLDER_BODY : REMOVED_ADOPTED_BODY),
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
            // Its linkers drop the link when settling reaches them, wherever the saved cursor is.
            if ((await importers.listLinkingNodes(binding.id, [sourceId], { limit: 1 })).items.length > 0) {
              await importers.markLinkingNodesUnsettled(binding.id, [sourceId]);
              await importers.setState(binding.id, { [KNOWLEDGE_IMPORT_SETTLE_RESTART_KEY]: randomUUID() });
              deferredLinkers = true;
            }
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
        const { page, change, moved, relinked } = await write(op.item, op.op === 'upsert');
        recordRelinked(relinked, embeds);
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
  if (input.settle) {
    // Without its folder a binding can't tell which pages wait to move under a parent, so settling
    // waits for the next flush that writes and makes the folder again.
    if (anchor) {
      input.settle.onStart?.();
      result.settle = await settle(input.settle);
    } else {
      result.settle = { pending: false, cursor: null, settled: 0, fromStart: false };
    }
  }
  return result;

  /**
   * One settle slice (O3 §C, §C′): visits the binding's unsettled nodes after `budget.after`, each
   * in its own savepoint, moving a page under a source parent that has arrived since and writing
   * links whose targets now resolve. Stops at the candidate, move or time cap and leaves the rest
   * for the next slice. A node it can't settle (refused, or still waiting) is skipped and stays
   * unsettled; the pass ends when it reaches the last unsettled node.
   */
  async function settle(budget: KnowledgeImportSettleBudget): Promise<KnowledgeImportSettleResult> {
    let after = budget.after ?? undefined;
    const fromStart = after === undefined;
    let examined = 0;
    let moves = 0;
    let settled = 0;
    for (;;) {
      const page = await importers.listNodes(binding.id, {
        unsettled: true,
        ...(after !== undefined ? { after } : {}),
        limit: Math.max(1, budget.candidates - examined),
      });
      for (const node of page.items) {
        if (examined >= budget.candidates || moves >= budget.moves || Date.now() >= budget.until) {
          return { pending: true, cursor: resumeAt(), settled, fromStart };
        }
        examined++;
        after = node.sourceId;
        const embeds: KnowledgeImportEmbedJob[] = [];
        try {
          const outcome = await storage.transaction(() => settleNode(node.sourceId, embeds, moves < budget.moves));
          if (outcome.moved) moves++;
          if (outcome.moved || outcome.relinked) settled++;
          result.embeds.push(...embeds);
        } catch (error) {
          if (!refusalFor(error)) throw error;
        }
      }
      if (!page.next) {
        // Linker repairs this slice deferred may sit anywhere, even on nodes it already visited.
        if (deferredLinkers) {
          const behind = await importers.listNodes(binding.id, { unsettled: true, limit: 1 });
          if (behind.items.length > 0) return { pending: true, cursor: null, settled, fromStart };
        }
        return { pending: false, cursor: null, settled, fromStart };
      }
      if (examined >= budget.candidates) return { pending: true, cursor: resumeAt(), settled, fromStart };
    }

    // A slice that deferred linker repairs may have queued them behind its cursor; the next one
    // starts from the first unsettled node instead.
    function resumeAt() {
      return deferredLinkers ? null : (after ?? null);
    }
  }

  async function settleNode(
    sourceId: string,
    embeds: KnowledgeImportEmbedJob[],
    canMove: boolean,
  ): Promise<{ moved: boolean; relinked: boolean }> {
    const node = await importers.getNode(binding.id, sourceId);
    if (!node?.unsettled) return { moved: false, relinked: false };
    const current = await owned(node.pageId, sourceId);
    let { page, keys } = current;
    let moved = false;
    let relinked = false;

    const parent = current.outside ? null : await nodeOf(node.parentSourceId);
    let misplaced = !current.outside && !!node.parentSourceId && !parent;
    if (parent && canMove) {
      const destination = await owned(parent.pageId, parent.sourceId);
      if (page.parentId !== destination.page.id) {
        if (destination.keys.length > keys.length && sameKeys(destination.keys.slice(0, keys.length), keys)) {
          throw new KnowledgeImportRefusalError('invalid');
        }
        let rewrote: Relinked[];
        ({ page, keys, relinked: rewrote } = await moveOwned(sourceId, page, destination));
        recordRelinked(rewrote, embeds);
        moved = true;
        await syncLinks(() => refreshKnowledgeLinksTo(storage, [page], { withDescendants: true }));
      }
    } else if (parent) {
      misplaced = true;
    }

    // Its links section, for targets that arrived or moved since it was written.
    const out = await relink(node, page);
    page = out.page;
    if (out.changed) {
      relinked = true;
      embeds.push({ kind: 'index', pageId: page.id });
    }
    await importers.saveNode({
      ...node,
      linkSection: out.section,
      unresolvedLinks: out.unresolved,
      unsettled: misplaced || out.unresolved.length > 0,
    });
    if (moved || relinked) {
      result.applied = true;
      if (moved) result.counts.moved++;
      if (relinked) result.counts.updated++;
      result.changes.push({
        sourceId,
        pageId: page.id,
        change: relinked ? 'updated' : 'moved',
        title: page.name,
        path: ref(keys),
      });
    }
    return { moved, relinked };
  }
}

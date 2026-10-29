import {
  createKnowledgePagesCoreLoader,
  inspectKnowledgePagesSchema,
  knowledgeSearchWords,
  KNOWLEDGE_PAGES_SCHEMA_VERSION,
  KNOWLEDGE_RESETTABLE_TABLE_NAMES,
  knowledgePageKeyProblem,
  knowledgePagesResetMessage,
} from '@internal/core/knowledge-compat';
import type { KnowledgePagesSchemaInspection } from '@internal/core/knowledge-compat';
import { coreFeatures } from '@mastra/core/features';
import { createKnowledgeUlid, KnowledgeConflictError, KnowledgeNotFoundError } from '@mastra/core/storage';
import type {
  AddKnowledgeNoteInput,
  CreateKnowledgePageInput,
  KnowledgeNote,
  KnowledgeNoteListOutput,
  KnowledgePage,
  KnowledgePageActivityAction,
  KnowledgePageActivityEvent,
  KnowledgePageListOutput,
  KnowledgePageSearchHit,
  KnowledgePageTemplateInput,
  KnowledgePageStore,
  KnowledgePin,
  KnowledgeProvenance,
  KnowledgeReadScope,
  MaterializeKnowledgeScopeInput,
  MaterializeKnowledgeScopeResult,
  MergeKnowledgePagesInput,
  MoveKnowledgePageInput,
  SearchKnowledgePagesInput,
  UpdateKnowledgePageInput,
} from '@mastra/core/storage';
import type { ClientSession, Collection, Document, Filter } from 'mongodb';

import type { MongoDBConnector } from '../../connectors/MongoDBConnector';

const loadPagesCore = createKnowledgePagesCoreLoader(coreFeatures, () => import('@mastra/core/storage'));

const DEFAULT_LIST_LIMIT = 50;
const MONGO_DUPLICATE_KEY = 11000;

export const MONGO_KNOWLEDGE_PAGES_COLLECTIONS = {
  pages: 'mastra_knowledge_pages',
  notes: 'mastra_knowledge_notes',
  pins: 'mastra_knowledge_pins',
  activity: 'mastra_knowledge_activity',
  state: 'mastra_knowledge_access_state',
} as const;

export interface MongoKnowledgePagesBounds {
  assertKnowledgePageDescriptionWithinBound(description: string | undefined): void;
  assertKnowledgeNoteTextWithinBound(text: string): void;
}

/** Thrown when existing Knowledge collections can't be used as schema 4 without a reset. */
export class MongoKnowledgeResetRequiredError extends Error {
  readonly inspection: Extract<KnowledgePagesSchemaInspection, { status: 'incompatible-reset-required' }>;

  constructor(inspection: Extract<KnowledgePagesSchemaInspection, { status: 'incompatible-reset-required' }>) {
    super(knowledgePagesResetMessage(inspection.reason));
    this.name = 'KnowledgeSchemaResetRequiredError';
    this.inspection = inspection;
  }
}

type Session = ClientSession | undefined;
type Row = Document;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === MONGO_DUPLICATE_KEY;
}

function encodeCursor(parts: string[]): string {
  return Buffer.from(JSON.stringify(parts)).toString('base64url');
}

function decodeCursor(cursor: string): [string, string] {
  try {
    const parts: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(parts) && parts.length === 2 && parts.every(part => typeof part === 'string')) {
      return parts as [string, string];
    }
  } catch {
    // fall through
  }
  throw new Error('Invalid Knowledge cursor');
}

function clampLimit(limit: number | undefined, max: number): number {
  const value = limit ?? DEFAULT_LIST_LIMIT;
  if (!Number.isInteger(value) || value < 1) throw new Error('Knowledge list limit must be a positive integer');
  return Math.min(value, max);
}

const live = { deletedAt: { $exists: false } } as const;
const notScope = { isScope: { $ne: true } } as const;

/** Unique-while-live page key per parent; unset on delete so the key can be reused. */
function activeKeyOf(parentId: string, key: string): string {
  return `${parentId}\u0000${key}`;
}

/** Pipeline stage recomputing `activeKey` for pages that have a live key after their parent changed. */
function recomputeActiveKey(parentId: string): Document {
  return {
    $set: {
      activeKey: {
        $cond: [
          { $and: [{ $eq: [{ $type: '$key' }, 'string'] }, { $eq: [{ $type: '$deletedAt' }, 'missing'] }] },
          { $concat: [parentId, '\u0000', '$key'] },
          '$$REMOVE',
        ],
      },
    },
  };
}

function toPage(row: Row): KnowledgePage {
  return {
    id: String(row.id),
    scopeId: String(row.scopeId),
    parentId: row.parentId == null ? null : String(row.parentId),
    isScope: row.isScope === true,
    ...(row.address == null ? {} : { address: String(row.address) }),
    ...(row.declaration == null ? {} : { declaration: String(row.declaration) }),
    ...(row.key == null ? {} : { key: String(row.key) }),
    position: String(row.position),
    name: String(row.name),
    ...(row.description == null ? {} : { description: String(row.description) }),
    ...(row.body == null ? {} : { body: String(row.body) }),
    version: Number(row.version),
    ...(row.mergedInto == null ? {} : { mergedInto: String(row.mergedInto) }),
    createdBy: row.createdBy as KnowledgeProvenance,
    updatedBy: row.updatedBy as KnowledgeProvenance,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    ...(row.deletedAt == null ? {} : { deletedAt: new Date(row.deletedAt) }),
    ...(row.deletedBy == null ? {} : { deletedBy: String(row.deletedBy) }),
  };
}

function toNote(row: Row): KnowledgeNote {
  return {
    id: String(row.id),
    pageId: String(row.pageId),
    text: String(row.text),
    ...(row.when == null ? {} : { when: new Date(row.when) }),
    stampScopeIds: [...((row.stampScopeIds as string[] | undefined) ?? [])].sort(),
    mentions: [...((row.mentions as string[] | undefined) ?? [])].sort(),
    provenance: row.provenance as KnowledgeProvenance,
    version: Number(row.version),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    ...(row.deletedAt == null ? {} : { deletedAt: new Date(row.deletedAt) }),
    ...(row.deletedBy == null ? {} : { deletedBy: String(row.deletedBy) }),
  };
}

function toPin(row: Row): KnowledgePin {
  return {
    id: String(row.id),
    pageId: String(row.pageId),
    audience: [...((row.audience as string[] | undefined) ?? [])],
    createdBy: String(row.createdBy),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

const noProjection = { projection: { _id: 0 } } as const;

/**
 * MongoDB implementation of the schema-4 {@link KnowledgePageStore}.
 *
 * Notes embed their stamps and mentions and carry two denormalized copies of page scope
 * (`pageScopeId`, `mentionScopeIds`); activity events carry `pageScopeId`. Moves and merges rewrite
 * those copies in the same transaction as the page rows, so a read is one indexed filter against the
 * set of readable scope ids resolved from the read scope (never a per-address query).
 */
export class MongoKnowledgePages implements KnowledgePageStore {
  readonly #connector: MongoDBConnector;
  readonly #bounds: () => Promise<MongoKnowledgePagesBounds>;

  constructor(options: { connector: MongoDBConnector; bounds: () => Promise<MongoKnowledgePagesBounds> }) {
    this.#connector = options.connector;
    this.#bounds = options.bounds;
  }

  #c(name: keyof typeof MONGO_KNOWLEDGE_PAGES_COLLECTIONS): Promise<Collection<Document>> {
    return this.#connector.getCollection(MONGO_KNOWLEDGE_PAGES_COLLECTIONS[name]) as Promise<Collection<Document>>;
  }

  #tx<T>(operation: (session: Session) => Promise<T>): Promise<T> {
    return this.#connector.withTransaction(operation);
  }

  // Schema ---------------------------------------------------------------------------------------

  async inspectSchema(): Promise<KnowledgePagesSchemaInspection> {
    const names: string[] = [];
    for (const name of KNOWLEDGE_RESETTABLE_TABLE_NAMES) {
      if (await this.#connector.collectionExists(name)) names.push(name);
    }
    return this.#inspectNames(names);
  }

  async #inspectNames(collectionNames: string[]): Promise<KnowledgePagesSchemaInspection> {
    const tableNames = collectionNames.filter(name => name.startsWith('mastra_knowledge_'));
    let schemaVersion: number | undefined;
    if (tableNames.includes(MONGO_KNOWLEDGE_PAGES_COLLECTIONS.state)) {
      const state = await (await this.#c('state')).findOne({ id: 'knowledge' });
      schemaVersion = typeof state?.schemaVersion === 'number' ? state.schemaVersion : undefined;
    }
    return inspectKnowledgePagesSchema({ tableNames, schemaVersion });
  }

  async init(): Promise<void> {
    const inspection = await this.inspectSchema();
    if (inspection.status === 'incompatible-reset-required') throw new MongoKnowledgeResetRequiredError(inspection);
    const [pages, notes, pins, activity, state] = await Promise.all([
      this.#c('pages'),
      this.#c('notes'),
      this.#c('pins'),
      this.#c('activity'),
      this.#c('state'),
    ]);
    await Promise.all([
      pages.createIndex({ id: 1 }, { unique: true }),
      pages.createIndex({ address: 1 }, { unique: true, partialFilterExpression: { isScope: true } }),
      pages.createIndex(
        { activeKey: 1 },
        { unique: true, partialFilterExpression: { activeKey: { $type: 'string' } } },
      ),
      pages.createIndex({ parentId: 1, position: 1, id: 1 }),
      pages.createIndex({ scopeId: 1, name: 1, id: 1 }),
      pages.createIndex({ canonicalName: 1, scopeId: 1 }),
      pages.createIndex({ isScope: 1, declaration: 1, parentId: 1 }),
      notes.createIndex({ id: 1 }, { unique: true }),
      notes.createIndex({ pageId: 1, createdAt: 1, id: 1 }),
      notes.createIndex({ mentions: 1 }),
      notes.createIndex({ pageScopeId: 1 }),
      notes.createIndex({ stampScopeIds: 1 }),
      pins.createIndex({ id: 1 }, { unique: true }),
      pins.createIndex({ pageId: 1 }, { unique: true }),
      pins.createIndex({ audience: 1 }),
      activity.createIndex({ id: 1 }, { unique: true }),
      activity.createIndex({ pageScopeId: 1, createdAt: -1, id: -1 }),
      activity.createIndex({ pageId: 1, createdAt: -1, id: -1 }),
    ]);
    await state.updateOne(
      { id: 'knowledge' },
      { $setOnInsert: { id: 'knowledge', schemaVersion: KNOWLEDGE_PAGES_SCHEMA_VERSION } },
      { upsert: true },
    );
  }

  /** Drops exactly the Knowledge collections (never Memory's) and recreates schema 4. */
  async reset(): Promise<void> {
    for (const name of KNOWLEDGE_RESETTABLE_TABLE_NAMES) {
      const collection = (await this.#connector.getCollection(name)) as Collection<Document>;
      try {
        await collection.drop();
      } catch (error) {
        if ((error as { codeName?: string }).codeName !== 'NamespaceNotFound') throw error;
      }
    }
    await this.init();
  }

  // Read scope -------------------------------------------------------------------------------------

  /** The ids of every scope page the read scope can see; `null` means everything. */
  async #readable(read: KnowledgeReadScope, session?: Session): Promise<string[] | null> {
    if (read === 'all') return null;
    const any: Filter<Document>[] = [];
    if (read.addresses.length) any.push({ address: { $in: read.addresses } });
    // Anchored, case-sensitive and escaped: a binary prefix match, never a case-folded one.
    for (const entry of read.prefixes) {
      any.push({ declaration: entry.declaration, address: { $regex: `^${escapeRegex(entry.prefix)}` } });
    }
    for (const entry of read.children) any.push({ declaration: entry.declaration, parentId: entry.parentId });
    if (!any.length) return [];
    const pages = await this.#c('pages');
    const rows = await pages.find({ isScope: true, $or: any }, { projection: { _id: 0, id: 1 }, session }).toArray();
    return rows.map(row => String(row.id));
  }

  #inScopes(field: string, ids: string[] | null): Filter<Document> {
    return ids === null ? {} : { [field]: { $in: ids } };
  }

  #visibleNotes(ids: string[] | null): Filter<Document> {
    if (ids === null) return {};
    return {
      pageScopeId: { $in: ids },
      stampScopeIds: { $in: ids },
      mentionScopeIds: { $not: { $elemMatch: { $nin: ids } } },
    };
  }

  // Helpers --------------------------------------------------------------------------------------

  async #page(id: string, session?: Session): Promise<KnowledgePage | null> {
    const row = await (await this.#c('pages')).findOne({ id }, { ...noProjection, session });
    return row ? toPage(row) : null;
  }

  async #requireLivePage(id: string, session?: Session): Promise<KnowledgePage> {
    const page = await this.#page(id, session);
    if (!page || page.deletedAt) throw new KnowledgeNotFoundError('page', id);
    return page;
  }

  async #log(
    session: Session,
    event: {
      action: KnowledgePageActivityAction;
      scopeId: string;
      pageScopeId?: string;
      pageId: string;
      noteId?: string;
      provenance: KnowledgeProvenance;
      at: Date;
    },
  ): Promise<void> {
    await (
      await this.#c('activity')
    ).insertOne(
      {
        id: createKnowledgeUlid(),
        action: event.action,
        scopeId: event.scopeId,
        pageScopeId: event.pageScopeId ?? event.scopeId,
        pageId: event.pageId,
        ...(event.noteId ? { noteId: event.noteId } : {}),
        provenance: event.provenance,
        createdAt: event.at,
      },
      { session },
    );
  }

  async #lastPosition(parentId: string | null, session?: Session): Promise<string | undefined> {
    const row = await (
      await this.#c('pages')
    )
      .find({ parentId, ...live }, { projection: { _id: 0, position: 1 }, session })
      .sort({ position: -1 })
      .limit(1)
      .next();
    return row ? String(row.position) : undefined;
  }

  /**
   * Ordinary descendants of `rootId`, level by level. Stops counting once the live total passes the
   * move cap, so an oversize subtree is reported without being walked to the end.
   */
  async #subtree(
    rootId: string,
    session?: Session,
    find?: string,
  ): Promise<{
    ids: string[];
    live: number;
    maxDepth: number;
    found: boolean;
    truncated: boolean;
  }> {
    const core = await loadPagesCore();
    const pages = await this.#c('pages');
    const ids: string[] = [];
    let liveCount = 0;
    let maxDepth = 0;
    let frontier = [rootId];
    while (frontier.length) {
      const rows = await pages
        .find(
          { parentId: { $in: frontier }, ...notScope },
          { projection: { _id: 0, id: 1, depth: 1, deletedAt: 1 }, session },
        )
        .toArray();
      frontier = [];
      for (const row of rows) {
        const id = String(row.id);
        if (find !== undefined && id === find) return { ids, live: liveCount, maxDepth, found: true, truncated: false };
        ids.push(id);
        frontier.push(id);
        if (row.deletedAt == null) {
          liveCount++;
          maxDepth = Math.max(maxDepth, Number(row.depth));
        }
      }
      if (liveCount > core.MAX_KNOWLEDGE_MOVE_PAGES)
        return { ids, live: liveCount, maxDepth, found: false, truncated: true };
    }
    return { ids, live: liveCount, maxDepth, found: false, truncated: false };
  }

  /** Refuses before any write when a live arriving page's key is already live under `parentId`. */
  async #assertNoKeyConflicts(keys: string[], parentId: string, session?: Session, exceptId?: string): Promise<void> {
    const core = await loadPagesCore();
    if (!keys.length) return;
    const clash = await (
      await this.#c('pages')
    ).findOne(
      { ...live, parentId, key: { $in: keys }, ...(exceptId ? { id: { $ne: exceptId } } : {}) },
      { projection: { _id: 0, key: 1 }, session },
    );
    if (clash) throw new core.KnowledgePageKeyConflictError(String(clash.key), parentId);
  }

  /** Recomputes the denormalized scope of every page a note mentions, for notes touching `pageIds`. */
  async #refreshMentionScopes(pageIds: string[], session?: Session): Promise<void> {
    if (!pageIds.length) return;
    const notes = await this.#c('notes');
    const pages = await this.#c('pages');
    const affected = await notes
      .find({ mentions: { $in: pageIds } }, { projection: { _id: 0, id: 1, mentions: 1 }, session })
      .toArray();
    for (const note of affected) {
      const mentioned = await pages
        .find({ id: { $in: note.mentions as string[] } }, { projection: { _id: 0, scopeId: 1 }, session })
        .toArray();
      await notes.updateOne(
        { id: note.id },
        { $set: { mentionScopeIds: [...new Set(mentioned.map(page => String(page.scopeId)))] } },
        { session },
      );
    }
  }

  // Scopes ---------------------------------------------------------------------------------------

  async materializeScope(input: MaterializeKnowledgeScopeInput): Promise<MaterializeKnowledgeScopeResult> {
    // A racing materialization can lose a unique-index or write-conflict race; the retry re-reads
    // what the winner created and only adds what is still missing.
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.#materializeScopeOnce(input);
      } catch (error) {
        const core = await loadPagesCore();
        const raced =
          error instanceof core.KnowledgePageKeyConflictError ||
          error instanceof KnowledgeConflictError ||
          isDuplicateKey(error) ||
          (error as { hasErrorLabel?: (label: string) => boolean })?.hasErrorLabel?.('TransientTransactionError');
        if (!raced || attempt >= 4) throw error;
      }
    }
  }

  async #materializeScopeOnce(input: MaterializeKnowledgeScopeInput): Promise<MaterializeKnowledgeScopeResult> {
    const bounds = await this.#bounds();
    bounds.assertKnowledgePageDescriptionWithinBound(input.description);
    for (const child of input.children ?? []) bounds.assertKnowledgePageDescriptionWithinBound(child.description);
    const checkTemplates = (templates: KnowledgePageTemplateInput[]) => {
      for (const template of templates) {
        bounds.assertKnowledgePageDescriptionWithinBound(template.description);
        checkTemplates(template.pages ?? []);
      }
    };
    checkTemplates(input.pages ?? []);

    return this.#tx(async session => {
      const now = new Date();
      let scope = await this.#scopeByAddress(input.address, session);
      let created = false;
      let parentConflict: MaterializeKnowledgeScopeResult['parentConflict'];

      if (!scope) {
        if (input.parentId) await this.#requireLivePage(input.parentId, session);
        scope = await this.#insertScope(session, {
          address: input.address,
          declaration: input.declaration,
          name: input.name,
          description: input.description,
          parentId: input.parentId ?? null,
          provenance: input.provenance,
          at: now,
        });
        created = true;
      } else if (input.parentId && scope.parentId === null) {
        // Late link: the first non-null parent wins; the conditional update makes it atomic.
        await this.#requireLivePage(input.parentId, session);
        const linked = await (
          await this.#c('pages')
        ).findOneAndUpdate(
          { id: scope.id, parentId: null },
          { $set: { parentId: input.parentId } },
          { returnDocument: 'after', projection: { _id: 0 }, session },
        );
        const current = linked ?? (await this.#scopeByAddress(input.address, session))!;
        scope = toPage(current);
        if (!linked && input.parentId !== scope.parentId) {
          parentConflict = { existingParentId: scope.parentId, requestedParentId: input.parentId };
        }
      } else if (input.parentId !== undefined && (input.parentId ?? null) !== scope.parentId) {
        parentConflict = { existingParentId: scope.parentId, requestedParentId: input.parentId ?? null };
      }

      for (const child of input.children ?? []) {
        if (await this.#scopeByAddress(child.address, session)) continue;
        await this.#insertScope(session, {
          address: child.address,
          declaration: child.declaration,
          name: child.name,
          description: child.description,
          parentId: scope.id,
          provenance: input.provenance,
          at: now,
        });
      }

      await this.#materializeTemplates(session, scope, input.pages ?? [], input.provenance, now);

      return { scope, created, ...(parentConflict ? { parentConflict } : {}) };
    });
  }

  async #materializeTemplates(
    session: Session,
    parent: KnowledgePage,
    templates: KnowledgePageTemplateInput[],
    provenance: KnowledgeProvenance,
    at: Date,
  ): Promise<void> {
    const pages = await this.#c('pages');
    for (const template of templates) {
      const problem = knowledgePageKeyProblem(template.key);
      if (problem) throw new Error(problem);
      const existing = await pages.findOne(
        { parentId: parent.id, key: template.key, ...live },
        { ...noProjection, session },
      );
      const page = existing
        ? toPage(existing)
        : await this.#insertPage(session, {
            parent,
            key: template.key,
            name: template.name,
            description: template.description,
            provenance,
            at,
          });
      if (template.pages?.length) await this.#materializeTemplates(session, page, template.pages, provenance, at);
    }
  }

  async #scopeByAddress(address: string, session?: Session): Promise<KnowledgePage | null> {
    const row = await (await this.#c('pages')).findOne({ isScope: true, address }, { ...noProjection, session });
    return row ? toPage(row) : null;
  }

  async #insertScope(
    session: Session,
    input: {
      address: string;
      declaration: string;
      name: string;
      description?: string;
      parentId: string | null;
      provenance: KnowledgeProvenance;
      at: Date;
    },
  ): Promise<KnowledgePage> {
    const core = await loadPagesCore();
    const id = createKnowledgeUlid();
    const doc = {
      id,
      scopeId: id,
      parentId: input.parentId,
      isScope: true,
      address: input.address,
      declaration: input.declaration,
      position: core.knowledgePositionBetween(await this.#lastPosition(input.parentId, session)),
      name: input.name,
      canonicalName: core.canonicalKnowledgeName(input.name),
      ...(input.description === undefined ? {} : { description: input.description }),
      depth: 0,
      version: 1,
      createdBy: input.provenance,
      updatedBy: input.provenance,
      createdAt: input.at,
      updatedAt: input.at,
    };
    try {
      await (await this.#c('pages')).insertOne({ ...doc }, { session });
    } catch (error) {
      if (isDuplicateKey(error)) throw new KnowledgeConflictError(input.address);
      throw error;
    }
    await this.#log(session, {
      action: 'scope-created',
      scopeId: id,
      pageId: id,
      provenance: input.provenance,
      at: input.at,
    });
    return toPage(doc);
  }

  async getScopesByAddress(addresses: string[]): Promise<KnowledgePage[]> {
    if (addresses.length === 0) return [];
    const rows = await (
      await this.#c('pages')
    )
      .find({ isScope: true, address: { $in: addresses } }, noProjection)
      .toArray();
    const byAddress = new Map(rows.map(row => [String(row.address), toPage(row)]));
    return [...new Set(addresses)].flatMap(address => byAddress.get(address) ?? []);
  }

  async listChildScopes(input: {
    parentId: string | null;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgePageListOutput> {
    const core = await loadPagesCore();
    const limit = clampLimit(input.limit, core.MAX_KNOWLEDGE_PAGE_LIST_LIMIT);
    const filter: Filter<Document> = { isScope: true, parentId: input.parentId, ...live };
    if (input.cursor) {
      const [position, id] = decodeCursor(input.cursor);
      filter.$or = [{ position: { $gt: position } }, { position, id: { $gt: id } }];
    }
    const rows = await (
      await this.#c('pages')
    )
      .find(filter, noProjection)
      .sort({ position: 1, id: 1 })
      .limit(limit + 1)
      .toArray();
    return this.#pageOutput(rows, limit, page => [page.position, page.id]);
  }

  #pageOutput(rows: Row[], limit: number, cursorOf: (page: KnowledgePage) => string[]): KnowledgePageListOutput {
    const pages = rows.slice(0, limit).map(toPage);
    const last = pages[pages.length - 1];
    return { pages, ...(rows.length > limit && last ? { nextCursor: encodeCursor(cursorOf(last)) } : {}) };
  }

  // Pages ----------------------------------------------------------------------------------------

  async getPage(input: { id: string; read: KnowledgeReadScope }): Promise<KnowledgePage | null> {
    const ids = await this.#readable(input.read);
    const row = await (
      await this.#c('pages')
    ).findOne({ id: input.id, ...this.#inScopes('scopeId', ids) }, noProjection);
    return row ? toPage(row) : null;
  }

  async getPageByPath(input: {
    scopeId: string;
    path: string[];
    read: KnowledgeReadScope;
  }): Promise<KnowledgePage | null> {
    if (!input.path.length) return null;
    const ids = await this.#readable(input.read);
    const pages = await this.#c('pages');
    let page: KnowledgePage | undefined;
    let parentId = input.scopeId;
    for (const key of input.path) {
      const filter: Filter<Document> = { parentId, key, ...live, ...notScope, ...this.#inScopes('scopeId', ids) };
      const row = await pages.findOne(filter, noProjection);
      if (!row) return null;
      page = toPage(row);
      parentId = page.id;
    }
    return page ?? null;
  }

  async findPagesByName(input: {
    name: string;
    read: KnowledgeReadScope;
    scopeId?: string;
    limit?: number;
  }): Promise<KnowledgePage[]> {
    const core = await loadPagesCore();
    const limit = clampLimit(input.limit, core.MAX_KNOWLEDGE_PAGE_LIST_LIMIT);
    const ids = await this.#readable(input.read);
    const filter: Filter<Document> = { canonicalName: core.canonicalKnowledgeName(input.name), ...live };
    this.#scopeFilter(filter, input.scopeId, ids);
    const rows = await (
      await this.#c('pages')
    )
      .find(filter, noProjection)
      .sort({ createdAt: -1, id: -1 })
      .limit(limit)
      .toArray();
    return rows.map(toPage);
  }

  /** Adds the home-scope constraint: the explicit scope, intersected with what the read scope allows. */
  #scopeFilter(filter: Filter<Document>, scopeId: string | undefined, ids: string[] | null): void {
    if (scopeId !== undefined) {
      if (ids !== null && !ids.includes(scopeId)) filter.scopeId = { $in: [] };
      else filter.scopeId = scopeId;
    } else if (ids !== null) {
      filter.scopeId = { $in: ids };
    }
  }

  async listChildPages(input: {
    parentId: string;
    read: KnowledgeReadScope;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgePageListOutput> {
    const core = await loadPagesCore();
    const limit = clampLimit(input.limit, core.MAX_KNOWLEDGE_PAGE_LIST_LIMIT);
    const ids = await this.#readable(input.read);
    const filter: Filter<Document> = {
      parentId: input.parentId,
      ...notScope,
      ...live,
      ...this.#inScopes('scopeId', ids),
    };
    if (input.cursor) {
      const [position, id] = decodeCursor(input.cursor);
      filter.$or = [{ position: { $gt: position } }, { position, id: { $gt: id } }];
    }
    const rows = await (
      await this.#c('pages')
    )
      .find(filter, noProjection)
      .sort({ position: 1, id: 1 })
      .limit(limit + 1)
      .toArray();
    return this.#pageOutput(rows, limit, page => [page.position, page.id]);
  }

  async listPages(input: {
    read: KnowledgeReadScope;
    scopeId?: string;
    namePrefix?: string;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgePageListOutput> {
    const core = await loadPagesCore();
    const limit = clampLimit(input.limit, core.MAX_KNOWLEDGE_PAGE_LIST_LIMIT);
    const ids = await this.#readable(input.read);
    const filter: Filter<Document> = { ...notScope, ...live };
    this.#scopeFilter(filter, input.scopeId, ids);
    if (input.namePrefix) {
      filter.canonicalName = { $regex: `^${escapeRegex(core.canonicalKnowledgeName(input.namePrefix))}` };
    }
    if (input.cursor) {
      const [name, id] = decodeCursor(input.cursor);
      filter.$or = [{ name: { $gt: name } }, { name, id: { $gt: id } }];
    }
    const rows = await (
      await this.#c('pages')
    )
      .find(filter, noProjection)
      .sort({ name: 1, id: 1 })
      .limit(limit + 1)
      .toArray();
    return this.#pageOutput(rows, limit, page => [page.name, page.id]);
  }

  async createPage(input: CreateKnowledgePageInput): Promise<KnowledgePage> {
    const bounds = await this.#bounds();
    bounds.assertKnowledgePageDescriptionWithinBound(input.description);
    if (input.key !== undefined) {
      const problem = knowledgePageKeyProblem(input.key);
      if (problem) throw new Error(problem);
    }
    return this.#tx(async session => {
      const parent = await this.#requireLivePage(input.parentId, session);
      return this.#insertPage(session, {
        id: input.id,
        parent,
        key: input.key,
        name: input.name,
        description: input.description,
        body: input.body,
        position: input.position,
        provenance: input.provenance,
        at: new Date(),
      });
    });
  }

  async #insertPage(
    session: Session,
    input: {
      id?: string;
      parent: KnowledgePage;
      key?: string;
      name: string;
      description?: string;
      body?: string;
      position?: string;
      provenance: KnowledgeProvenance;
      at: Date;
    },
  ): Promise<KnowledgePage> {
    const core = await loadPagesCore();
    const id = input.id ?? createKnowledgeUlid();
    const scopeId = input.parent.isScope ? input.parent.id : input.parent.scopeId;
    const depth = input.parent.isScope ? 1 : (await this.#depthOf(input.parent.id, session)) + 1;
    if (depth > core.MAX_KNOWLEDGE_PAGE_DEPTH) throw new core.KnowledgePageDepthError(id);
    const doc = {
      id,
      scopeId,
      parentId: input.parent.id,
      isScope: false,
      ...(input.key === undefined ? {} : { key: input.key, activeKey: activeKeyOf(input.parent.id, input.key) }),
      position: input.position ?? core.knowledgePositionBetween(await this.#lastPosition(input.parent.id, session)),
      name: input.name,
      canonicalName: core.canonicalKnowledgeName(input.name),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.body === undefined ? {} : { body: input.body }),
      depth,
      version: 1,
      createdBy: input.provenance,
      updatedBy: input.provenance,
      createdAt: input.at,
      updatedAt: input.at,
    };
    try {
      await (await this.#c('pages')).insertOne({ ...doc }, { session });
    } catch (error) {
      if (isDuplicateKey(error)) {
        if (input.key) throw new core.KnowledgePageKeyConflictError(input.key, input.parent.id);
        throw new KnowledgeConflictError(id);
      }
      throw error;
    }
    await this.#log(session, {
      action: 'page-created',
      scopeId,
      pageId: id,
      provenance: input.provenance,
      at: input.at,
    });
    return toPage(doc);
  }

  async #depthOf(id: string, session?: Session): Promise<number> {
    const row = await (await this.#c('pages')).findOne({ id }, { projection: { _id: 0, depth: 1 }, session });
    return Number(row?.depth ?? 0);
  }

  async updatePage(input: UpdateKnowledgePageInput): Promise<KnowledgePage> {
    const core = await loadPagesCore();
    const bounds = await this.#bounds();
    bounds.assertKnowledgePageDescriptionWithinBound(input.description);
    return this.#tx(async session => {
      const page = await this.#requireLivePage(input.id, session);
      if (page.version !== input.expectedVersion) throw new KnowledgeConflictError(input.id);
      const now = new Date();
      const set: Document = { updatedAt: now, updatedBy: input.provenance };
      const unset: Document = {};
      if (input.name !== undefined) {
        set.name = input.name;
        set.canonicalName = core.canonicalKnowledgeName(input.name);
      }
      if (input.description !== undefined) {
        if (input.description === '') unset.description = '';
        else set.description = input.description;
      }
      if (input.body !== undefined) set.body = input.body;
      const updated = await (
        await this.#c('pages')
      ).findOneAndUpdate(
        { id: input.id, version: input.expectedVersion, ...live },
        { $set: set, $inc: { version: 1 }, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
        { returnDocument: 'after', projection: { _id: 0 }, session },
      );
      if (!updated) throw new KnowledgeConflictError(input.id);
      await this.#log(session, {
        action: 'page-updated',
        scopeId: page.scopeId,
        pageId: page.id,
        provenance: input.provenance,
        at: now,
      });
      return toPage(updated);
    });
  }

  /** Rewrites everything that follows a page's home scope to `scopeId`, for the pages in `moved`. */
  async #rehome(moved: string[], scopeId: string, depthDelta: number, session: Session): Promise<void> {
    const pages = await this.#c('pages');
    const descendants = moved.slice(1);
    if (descendants.length) {
      await pages.updateMany(
        { id: { $in: descendants } },
        [{ $set: { scopeId, depth: { $add: ['$depth', depthDelta] } } }],
        { session },
      );
    }
    await (
      await this.#c('notes')
    ).updateMany({ pageId: { $in: moved } }, { $set: { pageScopeId: scopeId } }, { session });
    await (
      await this.#c('activity')
    ).updateMany({ pageId: { $in: moved } }, { $set: { pageScopeId: scopeId } }, { session });
  }

  async movePage(input: MoveKnowledgePageInput): Promise<KnowledgePage> {
    const core = await loadPagesCore();
    return this.#tx(async session => {
      const page = await this.#requireLivePage(input.id, session);
      if (page.version !== input.expectedVersion) throw new KnowledgeConflictError(input.id);
      if (page.isScope) throw new Error(`Knowledge scope page ${input.id} can't be moved`);
      if (input.parentId === input.id)
        throw new Error(`Knowledge page ${input.id} can't move under itself or its own subtree`);
      const tree = await this.#subtree(input.id, session, input.parentId);
      if (tree.found) throw new Error(`Knowledge page ${input.id} can't move under itself or its own subtree`);
      const parent = await this.#requireLivePage(input.parentId, session);
      if (tree.live + 1 > core.MAX_KNOWLEDGE_MOVE_PAGES)
        throw new core.KnowledgeMoveTooLargeError(input.id, tree.live + 1);
      const newScopeId = parent.isScope ? parent.id : parent.scopeId;
      const newDepth = parent.isScope ? 1 : (await this.#depthOf(parent.id, session)) + 1;
      const delta = newDepth - (await this.#depthOf(page.id, session));
      if (page.key) await this.#assertNoKeyConflicts([page.key], parent.id, session, page.id);
      if (tree.maxDepth + delta > core.MAX_KNOWLEDGE_PAGE_DEPTH || newDepth > core.MAX_KNOWLEDGE_PAGE_DEPTH) {
        throw new core.KnowledgePageDepthError(input.id);
      }
      const position = input.position ?? core.knowledgePositionBetween(await this.#lastPosition(parent.id, session));
      const now = new Date();
      let updated: Row | null;
      try {
        await this.#rehome([page.id, ...tree.ids], newScopeId, delta, session);
        updated = await (
          await this.#c('pages')
        ).findOneAndUpdate(
          { id: input.id, version: input.expectedVersion },
          {
            $set: {
              parentId: parent.id,
              scopeId: newScopeId,
              ...(page.key ? { activeKey: activeKeyOf(parent.id, page.key) } : {}),
              depth: newDepth,
              position,
              updatedAt: now,
              updatedBy: input.provenance,
            },
            $inc: { version: 1 },
          },
          { returnDocument: 'after', projection: { _id: 0 }, session },
        );
      } catch (error) {
        if (isDuplicateKey(error)) throw new KnowledgeConflictError(page.key ? `${parent.id}#${page.key}` : input.id);
        throw error;
      }
      if (!updated) throw new KnowledgeConflictError(input.id);
      await this.#refreshMentionScopes([page.id, ...tree.ids], session);
      await this.#log(session, {
        action: 'page-moved',
        scopeId: newScopeId,
        pageId: input.id,
        provenance: input.provenance,
        at: now,
      });
      return toPage(updated);
    });
  }

  async mergePages(input: MergeKnowledgePagesInput): Promise<KnowledgePage> {
    const core = await loadPagesCore();
    return this.#tx(async session => {
      if (input.sourceId === input.targetId)
        throw new Error(`Knowledge page ${input.sourceId} can't merge into itself or its own subtree`);
      const source = await this.#requireLivePage(input.sourceId, session);
      const target = await this.#requireLivePage(input.targetId, session);
      if (source.version !== input.sourceVersion) throw new KnowledgeConflictError(input.sourceId);
      if (source.isScope || target.isScope) throw new Error("Knowledge scope pages can't be merged");
      const tree = await this.#subtree(source.id, session, target.id);
      if (tree.found) {
        throw new Error(`Knowledge page ${source.id} can't merge into itself or its own subtree`);
      }
      if (tree.live > core.MAX_KNOWLEDGE_MOVE_PAGES) throw new core.KnowledgeMoveTooLargeError(source.id, tree.live);
      // Source's children become target's children, one level below the target.
      const delta = (await this.#depthOf(target.id, session)) - (await this.#depthOf(source.id, session));
      const arriving = await (
        await this.#c('pages')
      )
        .find(
          { parentId: source.id, ...live, ...notScope, key: { $type: 'string' } },
          { projection: { _id: 0, key: 1 }, session },
        )
        .toArray();
      await this.#assertNoKeyConflicts(
        arriving.map(row => String(row.key)),
        target.id,
        session,
      );
      if (tree.maxDepth > 0 && tree.maxDepth + delta > core.MAX_KNOWLEDGE_PAGE_DEPTH) {
        throw new core.KnowledgePageDepthError(source.id);
      }
      const now = new Date();
      const pages = await this.#c('pages');
      const notes = await this.#c('notes');
      try {
        if (tree.ids.length) {
          await pages.updateMany(
            { id: { $in: tree.ids } },
            [{ $set: { scopeId: target.scopeId, depth: { $add: ['$depth', delta] } } }],
            { session },
          );
          await notes.updateMany({ pageId: { $in: tree.ids } }, { $set: { pageScopeId: target.scopeId } }, { session });
          await (
            await this.#c('activity')
          ).updateMany({ pageId: { $in: tree.ids } }, { $set: { pageScopeId: target.scopeId } }, { session });
        }
        await pages.updateMany(
          { parentId: source.id, ...notScope },
          [{ $set: { parentId: target.id } }, recomputeActiveKey(target.id)],
          { session },
        );
      } catch (error) {
        if (isDuplicateKey(error)) throw new KnowledgeConflictError(source.id);
        throw error;
      }
      await notes.updateMany(
        { pageId: source.id },
        { $set: { pageId: target.id, pageScopeId: target.scopeId } },
        { session },
      );
      await notes.updateMany(
        { mentions: source.id },
        [
          {
            $set: {
              mentions: {
                $setUnion: [
                  {
                    $map: { input: '$mentions', in: { $cond: [{ $eq: ['$$this', source.id] }, target.id, '$$this'] } },
                  },
                ],
              },
            },
          },
        ],
        { session },
      );
      await this.#refreshMentionScopes([target.id, ...tree.ids], session);

      const pins = await this.#c('pins');
      const sourcePin = await pins.findOne({ pageId: source.id }, { ...noProjection, session });
      if (sourcePin) {
        await this.#upsertPinAudience(
          session,
          target.id,
          (sourcePin.audience as string[]) ?? [],
          String(sourcePin.createdBy),
          now,
        );
        await pins.deleteOne({ id: sourcePin.id }, { session });
      }

      const deleted = await pages.updateOne(
        { id: source.id, version: input.sourceVersion },
        {
          $set: {
            deletedAt: now,
            deletedBy: input.provenance.author,
            mergedInto: target.id,
            scopeId: target.scopeId,
            updatedAt: now,
            updatedBy: input.provenance,
          },
          $unset: { activeKey: '' },
          $inc: { version: 1 },
        },
        { session },
      );
      if (deleted.matchedCount === 0) throw new KnowledgeConflictError(input.sourceId);
      await (
        await this.#c('activity')
      ).updateMany({ pageId: source.id }, { $set: { pageScopeId: target.scopeId } }, { session });
      await this.#log(session, {
        action: 'page-merged',
        scopeId: target.scopeId,
        pageScopeId: target.scopeId,
        pageId: source.id,
        provenance: input.provenance,
        at: now,
      });
      return (await this.#page(target.id, session))!;
    });
  }

  async deletePage(input: { id: string; expectedVersion: number; deletedBy: string }): Promise<KnowledgePage> {
    const core = await loadPagesCore();
    return this.#tx(async session => {
      const page = await this.#requireLivePage(input.id, session);
      if (page.version !== input.expectedVersion) throw new KnowledgeConflictError(input.id);
      if (page.isScope) throw new Error(`Knowledge scope page ${input.id} can't be deleted`);
      const pages = await this.#c('pages');
      if (await pages.findOne({ parentId: input.id, ...live }, { projection: { id: 1 }, session })) {
        throw new core.KnowledgePageHasChildrenError(input.id);
      }
      const now = new Date();
      const updated = await pages.findOneAndUpdate(
        { id: input.id, version: input.expectedVersion, ...live },
        {
          $set: { deletedAt: now, deletedBy: input.deletedBy, updatedAt: now, updatedBy: { author: input.deletedBy } },
          $unset: { activeKey: '' },
          $inc: { version: 1 },
        },
        { returnDocument: 'after', projection: { _id: 0 }, session },
      );
      if (!updated) throw new KnowledgeConflictError(input.id);
      await (await this.#c('pins')).deleteOne({ pageId: input.id }, { session });
      await this.#log(session, {
        action: 'page-deleted',
        scopeId: page.scopeId,
        pageId: page.id,
        provenance: { author: input.deletedBy },
        at: now,
      });
      return toPage(updated);
    });
  }

  // Notes ----------------------------------------------------------------------------------------

  async getNote(input: {
    id: string;
    read: KnowledgeReadScope;
    includeDeleted?: boolean;
  }): Promise<KnowledgeNote | null> {
    const ids = await this.#readable(input.read);
    const filter: Filter<Document> = { id: input.id, ...this.#visibleNotes(ids) };
    if (!input.includeDeleted) Object.assign(filter, live);
    const row = await (await this.#c('notes')).findOne(filter, noProjection);
    return row ? toNote(row) : null;
  }

  async listNotes(input: {
    pageId: string;
    read: KnowledgeReadScope;
    cursor?: string;
    limit?: number;
    includeDeleted?: boolean;
  }): Promise<KnowledgeNoteListOutput> {
    const core = await loadPagesCore();
    const limit = clampLimit(input.limit, core.MAX_KNOWLEDGE_PAGE_LIST_LIMIT);
    const ids = await this.#readable(input.read);
    const filter: Filter<Document> = { pageId: input.pageId, ...this.#visibleNotes(ids) };
    if (!input.includeDeleted) Object.assign(filter, live);
    if (input.cursor) {
      const [createdAt, id] = decodeCursor(input.cursor);
      const at = new Date(createdAt);
      filter.$or = [{ createdAt: { $gt: at } }, { createdAt: at, id: { $gt: id } }];
    }
    const rows = await (
      await this.#c('notes')
    )
      .find(filter, noProjection)
      .sort({ createdAt: 1, id: 1 })
      .limit(limit + 1)
      .toArray();
    return this.#noteOutput(rows, limit);
  }

  async listNotesMentioning(input: {
    pageId: string;
    read: KnowledgeReadScope;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeNoteListOutput> {
    const core = await loadPagesCore();
    const limit = clampLimit(input.limit, core.MAX_KNOWLEDGE_PAGE_LIST_LIMIT);
    const ids = await this.#readable(input.read);
    const match: Filter<Document> = {
      mentions: input.pageId,
      pageId: { $ne: input.pageId },
      ...live,
      ...this.#visibleNotes(ids),
    };
    if (input.cursor) {
      const [createdAt, id] = decodeCursor(input.cursor);
      const at = new Date(createdAt);
      match.$or = [{ createdAt: { $lt: at } }, { createdAt: at, id: { $lt: id } }];
    }
    const rows = await (
      await this.#c('notes')
    )
      .aggregate([
        { $match: match },
        {
          $lookup: {
            from: MONGO_KNOWLEDGE_PAGES_COLLECTIONS.pages,
            localField: 'pageId',
            foreignField: 'id',
            as: 'page',
          },
        },
        { $match: { 'page.deletedAt': { $exists: false } } },
        { $project: { _id: 0, page: 0 } },
        { $sort: { createdAt: -1, id: -1 } },
        { $limit: limit + 1 },
      ])
      .toArray();
    return this.#noteOutput(rows, limit);
  }

  #noteOutput(rows: Row[], limit: number): KnowledgeNoteListOutput {
    const notes = rows.slice(0, limit).map(toNote);
    const last = notes[notes.length - 1];
    return {
      notes,
      ...(rows.length > limit && last ? { nextCursor: encodeCursor([last.createdAt.toISOString(), last.id]) } : {}),
    };
  }

  async #assertScopePages(ids: string[], session: Session): Promise<void> {
    const rows = await (
      await this.#c('pages')
    )
      .find({ id: { $in: ids }, isScope: true }, { projection: { _id: 0, id: 1 }, session })
      .toArray();
    const found = new Set(rows.map(row => String(row.id)));
    const missing = ids.find(id => !found.has(id));
    if (missing) throw new Error(`Knowledge note stamp ${missing} is not a scope page`);
  }

  async addNote(input: AddKnowledgeNoteInput): Promise<KnowledgeNote> {
    const bounds = await this.#bounds();
    bounds.assertKnowledgeNoteTextWithinBound(input.text);
    if (input.stampScopeIds.length === 0) throw new Error('A Knowledge note needs at least one stamp scope');
    return this.#tx(async session => {
      const page = await this.#requireLivePage(input.pageId, session);
      const stampIds = [...new Set(input.stampScopeIds)];
      await this.#assertScopePages(stampIds, session);
      const mentionIds = [...new Set(input.mentions)];
      let mentionScopeIds: string[] = [];
      if (mentionIds.length) {
        const found = await (
          await this.#c('pages')
        )
          .find({ id: { $in: mentionIds } }, { projection: { _id: 0, id: 1, scopeId: 1 }, session })
          .toArray();
        const known = new Set(found.map(row => String(row.id)));
        const missing = mentionIds.find(id => !known.has(id));
        if (missing) throw new KnowledgeNotFoundError('page', missing);
        mentionScopeIds = [...new Set(found.map(row => String(row.scopeId)))];
      }
      const id = input.id ?? createKnowledgeUlid();
      const now = new Date();
      const doc = {
        id,
        pageId: page.id,
        pageScopeId: page.scopeId,
        text: input.text,
        ...(input.when ? { when: input.when } : {}),
        stampScopeIds: stampIds,
        mentions: mentionIds,
        mentionScopeIds,
        provenance: input.provenance,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await (await this.#c('notes')).insertOne({ ...doc }, { session });
      } catch (error) {
        if (isDuplicateKey(error)) throw new KnowledgeConflictError(id);
        throw error;
      }
      await this.#log(session, {
        action: 'note-added',
        scopeId: page.scopeId,
        pageId: page.id,
        noteId: id,
        provenance: input.provenance,
        at: now,
      });
      return toNote(doc);
    });
  }

  async #requireNote(id: string, session: Session): Promise<Row> {
    const row = await (await this.#c('notes')).findOne({ id }, { ...noProjection, session });
    if (!row) throw new KnowledgeNotFoundError('note', id);
    return row;
  }

  async restampNote(input: {
    id: string;
    expectedVersion: number;
    stampScopeIds: string[];
    provenance: KnowledgeProvenance;
  }): Promise<KnowledgeNote> {
    if (input.stampScopeIds.length === 0) throw new Error('A Knowledge note needs at least one stamp scope');
    return this.#tx(async session => {
      const note = await this.#requireNote(input.id, session);
      if (note.deletedAt) throw new KnowledgeNotFoundError('note', input.id);
      if (Number(note.version) !== input.expectedVersion) throw new KnowledgeConflictError(input.id);
      const stampIds = [...new Set(input.stampScopeIds)];
      await this.#assertScopePages(stampIds, session);
      const now = new Date();
      const updated = await (
        await this.#c('notes')
      ).findOneAndUpdate(
        { id: input.id, version: input.expectedVersion },
        { $set: { stampScopeIds: stampIds, updatedAt: now }, $inc: { version: 1 } },
        { returnDocument: 'after', projection: { _id: 0 }, session },
      );
      if (!updated) throw new KnowledgeConflictError(input.id);
      await this.#log(session, {
        action: 'note-restamped',
        scopeId: String(note.pageScopeId),
        pageId: String(note.pageId),
        noteId: input.id,
        provenance: input.provenance,
        at: now,
      });
      return toNote(updated);
    });
  }

  async removeNote(input: { id: string; deletedBy: string; provenance: KnowledgeProvenance }): Promise<KnowledgeNote> {
    return this.#tx(async session => {
      const note = await this.#requireNote(input.id, session);
      if (note.deletedAt) return toNote(note);
      const now = new Date();
      const updated = await (
        await this.#c('notes')
      ).findOneAndUpdate(
        { id: input.id },
        { $set: { deletedAt: now, deletedBy: input.deletedBy, updatedAt: now }, $inc: { version: 1 } },
        { returnDocument: 'after', projection: { _id: 0 }, session },
      );
      await this.#log(session, {
        action: 'note-removed',
        scopeId: String(note.pageScopeId),
        pageId: String(note.pageId),
        noteId: input.id,
        provenance: input.provenance,
        at: now,
      });
      return toNote(updated!);
    });
  }

  async restoreNote(input: { id: string; provenance: KnowledgeProvenance }): Promise<KnowledgeNote> {
    return this.#tx(async session => {
      const note = await this.#requireNote(input.id, session);
      if (!note.deletedAt) return toNote(note);
      const now = new Date();
      const updated = await (
        await this.#c('notes')
      ).findOneAndUpdate(
        { id: input.id },
        { $set: { updatedAt: now }, $unset: { deletedAt: '', deletedBy: '' }, $inc: { version: 1 } },
        { returnDocument: 'after', projection: { _id: 0 }, session },
      );
      await this.#log(session, {
        action: 'note-restored',
        scopeId: String(note.pageScopeId),
        pageId: String(note.pageId),
        noteId: input.id,
        provenance: input.provenance,
        at: now,
      });
      return toNote(updated!);
    });
  }

  // Search and activity ----------------------------------------------------------------------------

  async searchPages(input: SearchKnowledgePagesInput): Promise<KnowledgePageSearchHit[]> {
    const core = await loadPagesCore();
    const limit = clampLimit(input.limit, core.MAX_KNOWLEDGE_PAGE_LIST_LIMIT);
    const words = knowledgeSearchWords(input.query);
    if (!words.length) return [];
    const phrase = input.query.trim().toLowerCase().replace(/\s+/g, ' ');
    const ids = await this.#readable(input.read);
    const scopes = input.scopeIds?.length ? input.scopeIds : undefined;
    const inScope = (field: string): Filter<Document> => {
      if (ids === null) return scopes ? { [field]: { $in: scopes } } : {};
      const allowed = scopes ? scopes.filter(id => ids.includes(id)) : ids;
      return { [field]: { $in: allowed } };
    };
    const matcher = (word: string) => ({ $regex: escapeRegex(word), $options: 'i' });
    const pages = await this.#c('pages');
    const pageFilter = {
      ...live,
      ...notScope,
      ...inScope('scopeId'),
      $and: words.map(word => ({
        $or: [{ name: matcher(word) }, { description: matcher(word) }, { body: matcher(word) }],
      })),
    };
    const rows = await pages
      .aggregate([
        { $match: pageFilter },
        {
          $addFields: {
            searchTier: {
              $cond: [
                { $regexMatch: { input: '$canonicalName', regex: escapeRegex(phrase) } },
                0,
                {
                  $cond: [
                    {
                      $and: words.map(word => ({
                        $regexMatch: { input: '$name', regex: escapeRegex(word), options: 'i' },
                      })),
                    },
                    1,
                    2,
                  ],
                },
              ],
            },
          },
        },
        { $sort: { searchTier: 1, updatedAt: -1, id: 1 } },
        { $limit: limit },
        { $project: { searchTier: 0, _id: 0 } },
      ])
      .toArray();
    const hits: KnowledgePageSearchHit[] = rows.map(row => ({ type: 'page' as const, page: toPage(row) }));
    if (hits.length >= limit) return hits;

    const noteRows = await (
      await this.#c('notes')
    )
      .find(
        {
          ...live,
          ...this.#visibleNotes(ids),
          ...(scopes ? { pageScopeId: { $in: ids === null ? scopes : scopes.filter(id => ids.includes(id)) } } : {}),
          $and: words.map(word => ({ text: matcher(word) })),
        },
        noProjection,
      )
      .sort({ updatedAt: -1, id: -1 })
      .limit(limit - hits.length)
      .toArray();
    const notePages = new Map(
      (
        await pages
          .find({ id: { $in: [...new Set(noteRows.map(row => String(row.pageId)))] }, ...live }, noProjection)
          .toArray()
      ).map(row => [String(row.id), toPage(row)]),
    );
    for (const row of noteRows) {
      const page = notePages.get(String(row.pageId));
      if (page) hits.push({ type: 'note', note: toNote(row), page });
    }
    return hits;
  }

  async listPageActivity(input: {
    read: KnowledgeReadScope;
    scopeId?: string;
    pageId?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ events: KnowledgePageActivityEvent[]; nextCursor?: string }> {
    const core = await loadPagesCore();
    const limit = clampLimit(input.limit, core.MAX_KNOWLEDGE_PAGE_LIST_LIMIT);
    const ids = await this.#readable(input.read);
    const activity = await this.#c('activity');
    const notes = await this.#c('notes');
    const filter: Filter<Document> = {};
    this.#scopeFilter(filter as Filter<Document>, undefined, ids);
    if (ids !== null) filter.pageScopeId = { $in: ids };
    delete filter.scopeId;
    if (input.scopeId) {
      if (ids !== null && !ids.includes(input.scopeId)) filter.pageScopeId = { $in: [] };
      else filter.pageScopeId = input.scopeId;
    }
    if (input.pageId) filter.pageId = input.pageId;
    if (input.cursor) {
      const [createdAt, id] = decodeCursor(input.cursor);
      const at = new Date(createdAt);
      filter.$or = [{ createdAt: { $lt: at } }, { createdAt: at, id: { $lt: id } }];
    }

    // Events about a note appear only while that note is visible, so filter in batches until the page is full.
    const events: Row[] = [];
    let cursorFilter = filter;
    for (;;) {
      const batch = await activity
        .find(cursorFilter, noProjection)
        .sort({ createdAt: -1, id: -1 })
        .limit(limit * 4 + 1)
        .toArray();
      const noteIds = [...new Set(batch.flatMap(row => (row.noteId ? [String(row.noteId)] : [])))];
      const visible = new Set(
        noteIds.length
          ? (
              await notes
                .find({ id: { $in: noteIds }, ...this.#visibleNotes(ids) }, { projection: { _id: 0, id: 1 } })
                .toArray()
            ).map(row => String(row.id))
          : [],
      );
      for (const row of batch) {
        if (row.noteId && !visible.has(String(row.noteId))) continue;
        events.push(row);
        if (events.length > limit) break;
      }
      if (events.length > limit || batch.length <= limit * 4) break;
      const last = batch[batch.length - 1]!;
      cursorFilter = {
        ...filter,
        $or: [{ createdAt: { $lt: last.createdAt } }, { createdAt: last.createdAt, id: { $lt: last.id } }],
      };
    }

    const page = events.slice(0, limit).map((row): KnowledgePageActivityEvent => ({
      id: String(row.id),
      action: String(row.action) as KnowledgePageActivityAction,
      scopeId: String(row.scopeId),
      pageId: String(row.pageId),
      ...(row.noteId == null ? {} : { noteId: String(row.noteId) }),
      provenance: row.provenance as KnowledgeProvenance,
      createdAt: new Date(row.createdAt),
    }));
    const last = page[page.length - 1];
    return {
      events: page,
      ...(events.length > limit && last ? { nextCursor: encodeCursor([last.createdAt.toISOString(), last.id]) } : {}),
    };
  }

  // Pins -----------------------------------------------------------------------------------------

  /** Deletes every document but keeps the collections, indexes and schema-version marker. */
  async clearAll(): Promise<void> {
    await this.#tx(async session => {
      for (const name of ['activity', 'pins', 'notes', 'pages'] as const) {
        await (await this.#c(name)).deleteMany({}, { session });
      }
    });
  }

  async addPinAudience(input: { pageId: string; audience: string[]; createdBy: string }): Promise<KnowledgePin> {
    return this.#tx(async session => {
      const page = await this.#requireLivePage(input.pageId, session);
      const now = new Date();
      const { pin, changed } = await this.#upsertPinAudience(session, page.id, input.audience, input.createdBy, now);
      if (changed) {
        await this.#log(session, {
          action: 'pin-added',
          scopeId: page.scopeId,
          pageId: page.id,
          provenance: { author: input.createdBy },
          at: now,
        });
      }
      return pin;
    });
  }

  async #upsertPinAudience(
    session: Session,
    pageId: string,
    audience: string[],
    createdBy: string,
    now: Date,
  ): Promise<{ pin: KnowledgePin; changed: boolean }> {
    const pins = await this.#c('pins');
    const existing = await pins.findOne({ pageId }, { ...noProjection, session });
    if (!existing) {
      const doc = {
        id: createKnowledgeUlid(),
        pageId,
        audience: [...new Set(audience)],
        createdBy,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await pins.insertOne({ ...doc }, { session });
      } catch (error) {
        if (isDuplicateKey(error)) throw new KnowledgeConflictError(pageId);
        throw error;
      }
      return { pin: toPin(doc), changed: true };
    }
    const current = (existing.audience as string[]) ?? [];
    const merged = [...new Set([...current, ...audience])];
    if (merged.length === current.length) return { pin: toPin(existing), changed: false };
    const updated = await pins.findOneAndUpdate(
      { id: existing.id },
      { $set: { audience: merged, updatedAt: now } },
      { returnDocument: 'after', projection: { _id: 0 }, session },
    );
    return { pin: toPin(updated!), changed: true };
  }

  async removePinAudience(input: {
    pageId: string;
    audience: string[];
    removedBy: string;
  }): Promise<KnowledgePin | null> {
    return this.#tx(async session => {
      const pins = await this.#c('pins');
      const existing = await pins.findOne({ pageId: input.pageId }, { ...noProjection, session });
      if (!existing) return null;
      const current = (existing.audience as string[]) ?? [];
      const remaining = current.filter(entry => !input.audience.includes(entry));
      if (remaining.length === current.length) return toPin(existing);
      const now = new Date();
      let pin: KnowledgePin | null = null;
      if (remaining.length === 0) {
        await pins.deleteOne({ id: existing.id }, { session });
      } else {
        const updated = await pins.findOneAndUpdate(
          { id: existing.id },
          { $set: { audience: remaining, updatedAt: now } },
          { returnDocument: 'after', projection: { _id: 0 }, session },
        );
        pin = toPin(updated!);
      }
      const page = await this.#page(input.pageId, session);
      await this.#log(session, {
        action: 'pin-removed',
        scopeId: page?.scopeId ?? input.pageId,
        pageId: input.pageId,
        provenance: { author: input.removedBy },
        at: now,
      });
      return pin;
    });
  }

  async listPins(input: {
    audience: string[] | 'all';
    read: KnowledgeReadScope;
    pageIds?: string[];
    cursor?: string;
    limit?: number;
  }): Promise<{ pins: KnowledgePin[]; nextCursor?: string }> {
    const core = await loadPagesCore();
    const limit = clampLimit(input.limit, core.MAX_KNOWLEDGE_PAGE_LIST_LIMIT);
    const ids = await this.#readable(input.read);
    const match: Filter<Document> = {};
    if (input.audience !== 'all') match.audience = { $in: input.audience };
    if (input.pageIds) match.pageId = { $in: input.pageIds };
    if (input.cursor) {
      const [createdAt, id] = decodeCursor(input.cursor);
      const at = new Date(createdAt);
      match.$or = [{ createdAt: { $lt: at } }, { createdAt: at, id: { $lt: id } }];
    }
    const rows = await (
      await this.#c('pins')
    )
      .aggregate([
        { $match: match },
        {
          $lookup: {
            from: MONGO_KNOWLEDGE_PAGES_COLLECTIONS.pages,
            localField: 'pageId',
            foreignField: 'id',
            as: 'page',
          },
        },
        {
          $match: {
            'page.deletedAt': { $exists: false },
            ...(ids === null ? {} : { 'page.scopeId': { $in: ids } }),
          },
        },
        { $project: { _id: 0, page: 0 } },
        { $sort: { createdAt: -1, id: -1 } },
        { $limit: limit + 1 },
      ])
      .toArray();
    const pins = rows.slice(0, limit).map(toPin);
    const last = pins[pins.length - 1];
    return {
      pins,
      ...(rows.length > limit && last ? { nextCursor: encodeCursor([last.createdAt.toISOString(), last.id]) } : {}),
    };
  }
}

import { createKnowledgePagesCoreLoader } from '@internal/core/knowledge-compat';
import { coreFeatures } from '@mastra/core/features';
import {
  canonicalKnowledgeName,
  createKnowledgeUlid,
  KnowledgeConflictError,
  KnowledgeMoveTooLargeError,
  KnowledgeNotFoundError,
  KnowledgePageDepthError,
  KnowledgePageHasChildrenError,
  knowledgePositionBetween,
  MAX_KNOWLEDGE_MOVE_PAGES,
  MAX_KNOWLEDGE_PAGE_DEPTH,
  MAX_KNOWLEDGE_PAGE_LIST_LIMIT,
} from '@mastra/core/storage';
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
import type { SqliteInValue as InValue, SqliteResultSet as ResultSet } from '../../db/client';

const loadPagesCore = createKnowledgePagesCoreLoader(coreFeatures, () => import('@mastra/core/storage'));
const assertKnowledgePageDescriptionWithinBound = async (description: string | undefined) =>
  (await loadPagesCore()).assertKnowledgePageDescriptionWithinBound(description);
const assertKnowledgeNoteTextWithinBound = async (text: string) =>
  (await loadPagesCore()).assertKnowledgeNoteTextWithinBound(text);

export interface PageExecutor {
  execute(statement: string | { sql: string; args?: InValue[] }): Promise<ResultSet>;
}

/** Runs `operation` in one write transaction. */
export type PageTransaction = <T>(operation: (tx: PageExecutor) => Promise<T>) => Promise<T>;

export const KNOWLEDGE_PAGE_TABLES = {
  pages: 'mastra_knowledge_pages',
  notes: 'mastra_knowledge_notes',
  stamps: 'mastra_knowledge_note_stamps',
  mentions: 'mastra_knowledge_mentions',
  pins: 'mastra_knowledge_pins',
  activity: 'mastra_knowledge_activity',
} as const;

const T = KNOWLEDGE_PAGE_TABLES;

/** DDL for the schema-4 page tables, in creation order. Every statement is idempotent. */
export const KNOWLEDGE_PAGE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "mastra_knowledge_access_state" (
    id TEXT PRIMARY KEY,
    schemaVersion INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "${T.pages}" (
    id TEXT PRIMARY KEY,
    scopeId TEXT NOT NULL,
    isScope INTEGER NOT NULL,
    address TEXT,
    declaration TEXT,
    key TEXT,
    parentId TEXT,
    position TEXT NOT NULL,
    path TEXT NOT NULL,
    depth INTEGER NOT NULL,
    name TEXT NOT NULL,
    canonicalName TEXT NOT NULL,
    description TEXT,
    body TEXT,
    version INTEGER NOT NULL,
    mergedInto TEXT,
    createdBy TEXT NOT NULL,
    updatedBy TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT,
    deletedBy TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_kpages_address ON "${T.pages}" (address) WHERE isScope = 1`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_kpages_key ON "${T.pages}" (scopeId, key) WHERE key IS NOT NULL AND deletedAt IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_kpages_scope ON "${T.pages}" (scopeId)`,
  `CREATE INDEX IF NOT EXISTS idx_kpages_parent ON "${T.pages}" (parentId, position, id)`,
  `CREATE INDEX IF NOT EXISTS idx_kpages_path ON "${T.pages}" (path)`,
  `CREATE INDEX IF NOT EXISTS idx_kpages_canonical ON "${T.pages}" (canonicalName)`,
  `CREATE TABLE IF NOT EXISTS "${T.notes}" (
    id TEXT PRIMARY KEY,
    pageId TEXT NOT NULL,
    text TEXT NOT NULL,
    "when" TEXT,
    provenance TEXT NOT NULL,
    version INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT,
    deletedBy TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_knotes_page ON "${T.notes}" (pageId, createdAt, id)`,
  `CREATE TABLE IF NOT EXISTS "${T.stamps}" (
    noteId TEXT NOT NULL,
    scopeId TEXT NOT NULL,
    PRIMARY KEY (noteId, scopeId)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kstamps_scope ON "${T.stamps}" (scopeId)`,
  `CREATE TABLE IF NOT EXISTS "${T.mentions}" (
    noteId TEXT NOT NULL,
    pageId TEXT NOT NULL,
    PRIMARY KEY (noteId, pageId)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kmentions_page ON "${T.mentions}" (pageId)`,
  `CREATE TABLE IF NOT EXISTS "${T.pins}" (
    id TEXT PRIMARY KEY,
    pageId TEXT NOT NULL UNIQUE,
    audience TEXT NOT NULL,
    createdBy TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "${T.activity}" (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    scopeId TEXT NOT NULL,
    pageId TEXT NOT NULL,
    noteId TEXT,
    provenance TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kactivity_page ON "${T.activity}" (pageId, id DESC)`,
];

type Row = Record<string, unknown>;

function str(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

function date(value: unknown): Date | undefined {
  return value === null || value === undefined ? undefined : new Date(String(value));
}

function provenance(raw: unknown): KnowledgeProvenance {
  return JSON.parse(String(raw)) as KnowledgeProvenance;
}

function toPage(row: Row): KnowledgePage {
  return {
    id: String(row.id),
    scopeId: String(row.scopeId),
    parentId: str(row.parentId) ?? null,
    isScope: Number(row.isScope) === 1,
    ...(row.address !== null && row.address !== undefined ? { address: String(row.address) } : {}),
    ...(row.declaration !== null && row.declaration !== undefined ? { declaration: String(row.declaration) } : {}),
    ...(row.key !== null && row.key !== undefined ? { key: String(row.key) } : {}),
    position: String(row.position),
    name: String(row.name),
    ...(row.description !== null && row.description !== undefined ? { description: String(row.description) } : {}),
    ...(row.body !== null && row.body !== undefined ? { body: String(row.body) } : {}),
    version: Number(row.version),
    ...(row.mergedInto !== null && row.mergedInto !== undefined ? { mergedInto: String(row.mergedInto) } : {}),
    createdBy: provenance(row.createdBy),
    updatedBy: provenance(row.updatedBy),
    createdAt: new Date(String(row.createdAt)),
    updatedAt: new Date(String(row.updatedAt)),
    ...(row.deletedAt ? { deletedAt: new Date(String(row.deletedAt)) } : {}),
    ...(row.deletedBy ? { deletedBy: String(row.deletedBy) } : {}),
  };
}

function toNote(row: Row, stamps: string[], mentions: string[]): KnowledgeNote {
  const when = date(row.when);
  return {
    id: String(row.id),
    pageId: String(row.pageId),
    text: String(row.text),
    ...(when ? { when } : {}),
    stampScopeIds: stamps,
    mentions,
    provenance: provenance(row.provenance),
    version: Number(row.version),
    createdAt: new Date(String(row.createdAt)),
    updatedAt: new Date(String(row.updatedAt)),
    ...(row.deletedAt ? { deletedAt: new Date(String(row.deletedAt)) } : {}),
    ...(row.deletedBy ? { deletedBy: String(row.deletedBy) } : {}),
  };
}

function toPin(row: Row): KnowledgePin {
  return {
    id: String(row.id),
    pageId: String(row.pageId),
    audience: JSON.parse(String(row.audience)) as string[],
    createdBy: String(row.createdBy),
    createdAt: new Date(String(row.createdAt)),
    updatedAt: new Date(String(row.updatedAt)),
  };
}

function limitOf(limit: number | undefined): number {
  return Math.max(1, Math.min(limit ?? MAX_KNOWLEDGE_PAGE_LIST_LIMIT, MAX_KNOWLEDGE_PAGE_LIST_LIMIT));
}

function encodeCursor(value: unknown[]): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeCursor(cursor: string | undefined, length: number): string[] | undefined {
  if (cursor === undefined) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (Array.isArray(parsed) && parsed.length === length && parsed.every(item => typeof item === 'string')) {
      return parsed as string[];
    }
  } catch {
    // fall through
  }
  throw new Error('Invalid Knowledge cursor');
}

function escapeLike(value: string): string {
  return value.replace(/[=%_]/g, match => `=${match}`);
}

interface Fragment {
  sql: string;
  args: InValue[];
}

/**
 * The readable scope page ids as a subquery. The caller's addresses, prefixes and children go in as
 * JSON arrays so a large read scope never hits a bind-parameter limit, and prefixes compare with
 * `substr` (exact, case-sensitive), never `LIKE`.
 */
function readableScopes(read: KnowledgeReadScope): Fragment {
  if (read === 'all') return { sql: `SELECT id FROM "${T.pages}" WHERE isScope = 1`, args: [] };
  const conditions: string[] = [];
  const args: InValue[] = [];
  if (read.addresses.length > 0) {
    conditions.push(`address IN (SELECT value FROM json_each(?))`);
    args.push(JSON.stringify(read.addresses));
  }
  if (read.prefixes.length > 0) {
    conditions.push(
      `EXISTS (SELECT 1 FROM json_each(?) j WHERE declaration = json_extract(j.value, '$.declaration') AND substr(address, 1, length(json_extract(j.value, '$.prefix'))) = json_extract(j.value, '$.prefix'))`,
    );
    args.push(JSON.stringify(read.prefixes));
  }
  if (read.children.length > 0) {
    conditions.push(
      `EXISTS (SELECT 1 FROM json_each(?) j WHERE declaration = json_extract(j.value, '$.declaration') AND parentId IS json_extract(j.value, '$.parentId'))`,
    );
    args.push(JSON.stringify(read.children));
  }
  if (conditions.length === 0) return { sql: `SELECT id FROM "${T.pages}" WHERE 0`, args: [] };
  return {
    sql: `SELECT id FROM "${T.pages}" WHERE isScope = 1 AND address IS NOT NULL AND (${conditions.join(' OR ')})`,
    args,
  };
}

/** `alias.scopeId` is readable. */
function pageReadable(alias: string, read: KnowledgeReadScope): Fragment {
  const scopes = readableScopes(read);
  return { sql: `${alias}.scopeId IN (${scopes.sql})`, args: scopes.args };
}

/**
 * Note `alias` is visible: its page's scope is readable, a stamp is readable, and every resolved
 * mention's page sits in a readable scope.
 */
function noteReadable(alias: string, read: KnowledgeReadScope): Fragment {
  const scopes = readableScopes(read);
  return {
    sql: `EXISTS (SELECT 1 FROM "${T.pages}" vp WHERE vp.id = ${alias}.pageId AND vp.scopeId IN (${scopes.sql}))
      AND EXISTS (SELECT 1 FROM "${T.stamps}" vs WHERE vs.noteId = ${alias}.id AND vs.scopeId IN (${scopes.sql}))
      AND NOT EXISTS (SELECT 1 FROM "${T.mentions}" vm JOIN "${T.pages}" vmp ON vmp.id = vm.pageId WHERE vm.noteId = ${alias}.id AND vmp.scopeId NOT IN (${scopes.sql}))`,
    args: [...scopes.args, ...scopes.args, ...scopes.args],
  };
}

function jsonList(values: string[]): string {
  return JSON.stringify(values);
}

export class LibSQLKnowledgePages implements KnowledgePageStore {
  readonly #read: PageExecutor;
  readonly #transaction: PageTransaction;

  constructor(config: { read: PageExecutor; transaction: PageTransaction }) {
    this.#read = config.read;
    this.#transaction = config.transaction;
  }

  async #query(executor: PageExecutor, sql: string, args: InValue[] = []): Promise<Row[]> {
    const result = await executor.execute({ sql, args });
    return result.rows as unknown as Row[];
  }

  async #pageRow(executor: PageExecutor, id: string): Promise<Row | undefined> {
    return (await this.#query(executor, `SELECT * FROM "${T.pages}" WHERE id = ?`, [id]))[0];
  }

  async #livePage(executor: PageExecutor, id: string): Promise<Row> {
    const row = await this.#pageRow(executor, id);
    if (!row || row.deletedAt) throw new KnowledgeNotFoundError('page', id);
    return row;
  }

  async #logActivity(
    tx: PageExecutor,
    action: KnowledgePageActivityAction,
    event: { scopeId: string; pageId: string; noteId?: string; provenance: KnowledgeProvenance },
    now: string,
  ): Promise<void> {
    await tx.execute({
      sql: `INSERT INTO "${T.activity}" (id, action, scopeId, pageId, noteId, provenance, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        createKnowledgeUlid(),
        action,
        event.scopeId,
        event.pageId,
        event.noteId ?? null,
        JSON.stringify(event.provenance),
        now,
      ],
    });
  }

  async #lastPosition(tx: PageExecutor, parentId: string | null, scopesOnly: boolean): Promise<string | undefined> {
    const rows = await this.#query(
      tx,
      `SELECT position FROM "${T.pages}" WHERE parentId IS ? AND isScope = ? AND deletedAt IS NULL ORDER BY position DESC, id DESC LIMIT 1`,
      [parentId, scopesOnly ? 1 : 0],
    );
    return rows[0] ? String(rows[0].position) : undefined;
  }

  // Scopes

  async materializeScope(input: MaterializeKnowledgeScopeInput): Promise<MaterializeKnowledgeScopeResult> {
    await assertKnowledgePageDescriptionWithinBound(input.description);
    return this.#transaction(async tx => {
      const now = new Date().toISOString();
      const ensureScope = async (
        spec: { address: string; declaration: string; name: string; description?: string },
        parentId: string | null,
      ) => {
        await assertKnowledgePageDescriptionWithinBound(spec.description);
        const existing = (
          await this.#query(tx, `SELECT * FROM "${T.pages}" WHERE isScope = 1 AND address = ?`, [spec.address])
        )[0];
        if (existing) return { row: existing, created: false };
        if (parentId !== null) await this.#livePage(tx, parentId);
        const id = createKnowledgeUlid();
        const position = knowledgePositionBetween(await this.#lastPosition(tx, parentId, true));
        const who = JSON.stringify(input.provenance);
        await tx.execute({
          sql: `INSERT INTO "${T.pages}" (id, scopeId, isScope, address, declaration, parentId, position, path, depth, name, canonicalName, description, version, createdBy, updatedBy, createdAt, updatedAt) VALUES (?, ?, 1, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1, ?, ?, ?, ?)`,
          args: [
            id,
            id,
            spec.address,
            spec.declaration,
            parentId,
            position,
            `/${id}/`,
            spec.name,
            canonicalKnowledgeName(spec.name),
            spec.description ?? null,
            who,
            who,
            now,
            now,
          ],
        });
        await this.#logActivity(tx, 'scope-created', { scopeId: id, pageId: id, provenance: input.provenance }, now);
        return { row: (await this.#pageRow(tx, id))!, created: true };
      };

      const { row, created } = await ensureScope(input, input.parentId ?? null);
      const scopeId = String(row.id);
      let parentConflict: MaterializeKnowledgeScopeResult['parentConflict'];
      if (!created && input.parentId !== undefined && (str(row.parentId) ?? null) !== input.parentId) {
        parentConflict = { existingParentId: str(row.parentId) ?? null, requestedParentId: input.parentId };
      }
      for (const child of input.children ?? []) await ensureScope(child, scopeId);
      for (const page of input.pages ?? []) {
        const existing = (
          await this.#query(tx, `SELECT id FROM "${T.pages}" WHERE scopeId = ? AND key = ? AND deletedAt IS NULL`, [
            scopeId,
            page.key,
          ])
        )[0];
        if (existing) continue;
        await this.#insertPage(tx, {
          parentId: scopeId,
          key: page.key,
          name: page.name,
          description: page.description,
          provenance: input.provenance,
        });
      }
      return {
        scope: toPage((await this.#pageRow(tx, scopeId))!),
        created,
        ...(parentConflict ? { parentConflict } : {}),
      };
    });
  }

  async getScopesByAddress(addresses: string[]): Promise<KnowledgePage[]> {
    if (addresses.length === 0) return [];
    const rows = await this.#query(
      this.#read,
      `SELECT * FROM "${T.pages}" WHERE isScope = 1 AND address IN (SELECT value FROM json_each(?))`,
      [jsonList(addresses)],
    );
    return rows.map(toPage);
  }

  async listChildScopes(input: {
    parentId: string | null;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgePageListOutput> {
    const limit = limitOf(input.limit);
    const cursor = decodeCursor(input.cursor, 2);
    const args: InValue[] = [input.parentId];
    let after = '';
    if (cursor) {
      after = ` AND (position > ? OR (position = ? AND id > ?))`;
      args.push(cursor[0]!, cursor[0]!, cursor[1]!);
    }
    args.push(limit + 1);
    const rows = await this.#query(
      this.#read,
      `SELECT * FROM "${T.pages}" WHERE isScope = 1 AND parentId IS ?${after} ORDER BY position, id LIMIT ?`,
      args,
    );
    return this.#pageOutput(rows, limit, row => [String(row.position), String(row.id)]);
  }

  #pageOutput(rows: Row[], limit: number, cursorOf: (row: Row) => string[]): KnowledgePageListOutput {
    const page = rows.slice(0, limit);
    return {
      pages: page.map(toPage),
      ...(rows.length > limit ? { nextCursor: encodeCursor(cursorOf(page[page.length - 1]!)) } : {}),
    };
  }

  // Pages

  async getPage(input: { id: string; read: KnowledgeReadScope }): Promise<KnowledgePage | null> {
    const readable = pageReadable('p', input.read);
    const rows = await this.#query(this.#read, `SELECT p.* FROM "${T.pages}" p WHERE p.id = ? AND ${readable.sql}`, [
      input.id,
      ...readable.args,
    ]);
    return rows[0] ? toPage(rows[0]) : null;
  }

  async getPageByKey(input: { scopeId: string; key: string; read: KnowledgeReadScope }): Promise<KnowledgePage | null> {
    const readable = pageReadable('p', input.read);
    const rows = await this.#query(
      this.#read,
      `SELECT p.* FROM "${T.pages}" p WHERE p.scopeId = ? AND p.key = ? AND p.deletedAt IS NULL AND ${readable.sql}`,
      [input.scopeId, input.key, ...readable.args],
    );
    return rows[0] ? toPage(rows[0]) : null;
  }

  async findPagesByName(input: {
    name: string;
    read: KnowledgeReadScope;
    scopeId?: string;
    limit?: number;
  }): Promise<KnowledgePage[]> {
    const readable = pageReadable('p', input.read);
    const args: InValue[] = [canonicalKnowledgeName(input.name), ...readable.args];
    let scope = '';
    if (input.scopeId !== undefined) {
      scope = ` AND p.scopeId = ?`;
      args.push(input.scopeId);
    }
    args.push(limitOf(input.limit));
    const rows = await this.#query(
      this.#read,
      `SELECT p.* FROM "${T.pages}" p WHERE p.canonicalName = ? AND p.deletedAt IS NULL AND ${readable.sql}${scope} ORDER BY p.createdAt DESC, p.id DESC LIMIT ?`,
      args,
    );
    return rows.map(toPage);
  }

  async listChildPages(input: {
    parentId: string;
    read: KnowledgeReadScope;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgePageListOutput> {
    const limit = limitOf(input.limit);
    const cursor = decodeCursor(input.cursor, 2);
    const readable = pageReadable('p', input.read);
    const args: InValue[] = [input.parentId, ...readable.args];
    let after = '';
    if (cursor) {
      after = ` AND (p.position > ? OR (p.position = ? AND p.id > ?))`;
      args.push(cursor[0]!, cursor[0]!, cursor[1]!);
    }
    args.push(limit + 1);
    const rows = await this.#query(
      this.#read,
      `SELECT p.* FROM "${T.pages}" p WHERE p.parentId = ? AND p.isScope = 0 AND p.deletedAt IS NULL AND ${readable.sql}${after} ORDER BY p.position, p.id LIMIT ?`,
      args,
    );
    return this.#pageOutput(rows, limit, row => [String(row.position), String(row.id)]);
  }

  async listPages(input: {
    read: KnowledgeReadScope;
    scopeId?: string;
    namePrefix?: string;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgePageListOutput> {
    const limit = limitOf(input.limit);
    const cursor = decodeCursor(input.cursor, 2);
    const readable = pageReadable('p', input.read);
    const args: InValue[] = [...readable.args];
    let filters = '';
    if (input.scopeId !== undefined) {
      filters += ` AND p.scopeId = ?`;
      args.push(input.scopeId);
    }
    if (input.namePrefix) {
      const prefix = canonicalKnowledgeName(input.namePrefix);
      filters += ` AND substr(p.canonicalName, 1, length(?)) = ?`;
      args.push(prefix, prefix);
    }
    if (cursor) {
      filters += ` AND (p.name > ? OR (p.name = ? AND p.id > ?))`;
      args.push(cursor[0]!, cursor[0]!, cursor[1]!);
    }
    args.push(limit + 1);
    const rows = await this.#query(
      this.#read,
      `SELECT p.* FROM "${T.pages}" p WHERE p.isScope = 0 AND p.deletedAt IS NULL AND ${readable.sql}${filters} ORDER BY p.name, p.id LIMIT ?`,
      args,
    );
    return this.#pageOutput(rows, limit, row => [String(row.name), String(row.id)]);
  }

  async #insertPage(tx: PageExecutor, input: CreateKnowledgePageInput): Promise<KnowledgePage> {
    await assertKnowledgePageDescriptionWithinBound(input.description);
    const parent = await this.#livePage(tx, input.parentId);
    const isScopeParent = Number(parent.isScope) === 1;
    const scopeId = isScopeParent ? String(parent.id) : String(parent.scopeId);
    const depth = isScopeParent ? 1 : Number(parent.depth) + 1;
    if (depth > MAX_KNOWLEDGE_PAGE_DEPTH) throw new KnowledgePageDepthError(input.parentId);
    const id = input.id ?? createKnowledgeUlid();
    if (await this.#pageRow(tx, id)) throw new KnowledgeConflictError(id);
    if (input.key !== undefined) {
      const clash = await this.#query(
        tx,
        `SELECT id FROM "${T.pages}" WHERE scopeId = ? AND key = ? AND deletedAt IS NULL`,
        [scopeId, input.key],
      );
      if (clash.length > 0) throw new KnowledgeConflictError(`${scopeId}#${input.key}`);
    }
    const position = input.position ?? knowledgePositionBetween(await this.#lastPosition(tx, String(parent.id), false));
    const now = new Date().toISOString();
    const who = JSON.stringify(input.provenance);
    await tx.execute({
      sql: `INSERT INTO "${T.pages}" (id, scopeId, isScope, key, parentId, position, path, depth, name, canonicalName, description, body, version, createdBy, updatedBy, createdAt, updatedAt) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      args: [
        id,
        scopeId,
        input.key ?? null,
        String(parent.id),
        position,
        `${String(parent.path)}${id}/`,
        depth,
        input.name,
        canonicalKnowledgeName(input.name),
        input.description || null,
        input.body ?? null,
        who,
        who,
        now,
        now,
      ],
    });
    await this.#logActivity(tx, 'page-created', { scopeId, pageId: id, provenance: input.provenance }, now);
    return toPage((await this.#pageRow(tx, id))!);
  }

  async createPage(input: CreateKnowledgePageInput): Promise<KnowledgePage> {
    await assertKnowledgePageDescriptionWithinBound(input.description);
    return this.#transaction(tx => this.#insertPage(tx, input));
  }

  async updatePage(input: UpdateKnowledgePageInput): Promise<KnowledgePage> {
    await assertKnowledgePageDescriptionWithinBound(input.description);
    return this.#transaction(async tx => {
      const row = await this.#livePage(tx, input.id);
      if (Number(row.version) !== input.expectedVersion) throw new KnowledgeConflictError(input.id);
      const now = new Date().toISOString();
      const name = input.name ?? String(row.name);
      const description = input.description === undefined ? (row.description ?? null) : input.description || null;
      const body = input.body === undefined ? (row.body ?? null) : input.body;
      await tx.execute({
        sql: `UPDATE "${T.pages}" SET name = ?, canonicalName = ?, description = ?, body = ?, version = version + 1, updatedBy = ?, updatedAt = ? WHERE id = ?`,
        args: [
          name,
          canonicalKnowledgeName(name),
          description as InValue,
          body as InValue,
          JSON.stringify(input.provenance),
          now,
          input.id,
        ],
      });
      await this.#logActivity(
        tx,
        'page-updated',
        { scopeId: String(row.scopeId), pageId: input.id, provenance: input.provenance },
        now,
      );
      return toPage((await this.#pageRow(tx, input.id))!);
    });
  }

  /**
   * Rehomes `root` (and its subtree) under `parent`: new path prefix, scope and depth in one go.
   * Throws when the subtree is too large, too deep, or has a key that clashes in the new scope.
   */
  async #rehome(
    tx: PageExecutor,
    root: Row,
    parent: Row,
    options: { position?: string; countLimitId: string; skipRootCount?: boolean },
  ): Promise<{ moved: number; scopeId: string }> {
    const isScopeParent = Number(parent.isScope) === 1;
    const newScopeId = isScopeParent ? String(parent.id) : String(parent.scopeId);
    const newDepth = isScopeParent ? 1 : Number(parent.depth) + 1;
    const oldPath = String(root.path);
    const subtree = await this.#query(
      tx,
      `SELECT id, key, depth, deletedAt FROM "${T.pages}" WHERE substr(path, 1, length(?)) = ?`,
      [oldPath, oldPath],
    );
    const live = subtree.filter(row => !row.deletedAt);
    if (live.length > MAX_KNOWLEDGE_MOVE_PAGES) throw new KnowledgeMoveTooLargeError(options.countLimitId, live.length);
    const shift = newDepth - Number(root.depth);
    const deepest = Math.max(...subtree.map(row => Number(row.depth)));
    if (deepest + shift > MAX_KNOWLEDGE_PAGE_DEPTH) throw new KnowledgePageDepthError(String(root.id));
    if (newScopeId !== String(root.scopeId)) {
      const keys = live.filter(row => row.key !== null).map(row => String(row.key));
      if (keys.length > 0) {
        const clash = await this.#query(
          tx,
          `SELECT key FROM "${T.pages}" WHERE scopeId = ? AND deletedAt IS NULL AND key IN (SELECT value FROM json_each(?)) AND substr(path, 1, length(?)) <> ?`,
          [newScopeId, jsonList(keys), oldPath, oldPath],
        );
        if (clash.length > 0) throw new KnowledgeConflictError(`${newScopeId}#${String(clash[0]!.key)}`);
      }
    }
    const newPath = `${String(parent.path)}${String(root.id)}/`;
    const position =
      options.position ?? knowledgePositionBetween(await this.#lastPosition(tx, String(parent.id), false));
    await tx.execute({
      sql: `UPDATE "${T.pages}" SET path = ? || substr(path, length(?) + 1), depth = depth + ?, scopeId = ? WHERE substr(path, 1, length(?)) = ?`,
      args: [newPath, oldPath, shift, newScopeId, oldPath, oldPath],
    });
    await tx.execute({
      sql: `UPDATE "${T.pages}" SET parentId = ?, position = ? WHERE id = ?`,
      args: [String(parent.id), position, String(root.id)],
    });
    return { moved: live.length, scopeId: newScopeId };
  }

  movePage(input: MoveKnowledgePageInput): Promise<KnowledgePage> {
    return this.#transaction(async tx => {
      const row = await this.#livePage(tx, input.id);
      if (Number(row.isScope) === 1) throw new Error(`Scope page ${input.id} cannot be moved`);
      if (Number(row.version) !== input.expectedVersion) throw new KnowledgeConflictError(input.id);
      const parent = await this.#livePage(tx, input.parentId);
      const path = String(row.path);
      if (String(parent.id) === input.id || String(parent.path).startsWith(path)) {
        throw new Error(`Page ${input.id} cannot move into its own subtree`);
      }
      const now = new Date().toISOString();
      const { scopeId } = await this.#rehome(tx, row, parent, {
        position: input.position,
        countLimitId: input.id,
      });
      await tx.execute({
        sql: `UPDATE "${T.pages}" SET version = version + 1, updatedBy = ?, updatedAt = ? WHERE id = ?`,
        args: [JSON.stringify(input.provenance), now, input.id],
      });
      await this.#logActivity(tx, 'page-moved', { scopeId, pageId: input.id, provenance: input.provenance }, now);
      return toPage((await this.#pageRow(tx, input.id))!);
    });
  }

  mergePages(input: MergeKnowledgePagesInput): Promise<KnowledgePage> {
    return this.#transaction(async tx => {
      const source = await this.#livePage(tx, input.sourceId);
      const target = await this.#livePage(tx, input.targetId);
      if (Number(source.isScope) === 1 || Number(target.isScope) === 1) {
        throw new Error('Scope pages cannot be merged');
      }
      if (Number(source.version) !== input.sourceVersion) throw new KnowledgeConflictError(input.sourceId);
      const sourcePath = String(source.path);
      if (input.sourceId === input.targetId || String(target.path).startsWith(sourcePath)) {
        throw new Error(`Page ${input.targetId} is inside page ${input.sourceId}; it cannot be the merge target`);
      }
      const carried = await this.#query(
        tx,
        `SELECT COUNT(*) AS n FROM "${T.pages}" WHERE substr(path, 1, length(?)) = ? AND id <> ? AND deletedAt IS NULL`,
        [sourcePath, sourcePath, input.sourceId],
      );
      if (Number(carried[0]!.n) > MAX_KNOWLEDGE_MOVE_PAGES) {
        throw new KnowledgeMoveTooLargeError(input.sourceId, Number(carried[0]!.n));
      }
      const now = new Date().toISOString();
      const children = await this.#query(tx, `SELECT * FROM "${T.pages}" WHERE parentId = ? AND isScope = 0`, [
        input.sourceId,
      ]);
      for (const child of children) {
        await this.#rehome(tx, child, target, {
          position: String(child.position),
          countLimitId: input.sourceId,
        });
      }
      await tx.execute({
        sql: `UPDATE "${T.notes}" SET pageId = ? WHERE pageId = ?`,
        args: [input.targetId, input.sourceId],
      });
      await tx.execute({
        sql: `UPDATE OR IGNORE "${T.mentions}" SET pageId = ? WHERE pageId = ?`,
        args: [input.targetId, input.sourceId],
      });
      await tx.execute({ sql: `DELETE FROM "${T.mentions}" WHERE pageId = ?`, args: [input.sourceId] });
      const pins = await this.#query(tx, `SELECT * FROM "${T.pins}" WHERE pageId IN (?, ?)`, [
        input.sourceId,
        input.targetId,
      ]);
      const sourcePin = pins.find(pin => String(pin.pageId) === input.sourceId);
      if (sourcePin) {
        const targetPin = pins.find(pin => String(pin.pageId) === input.targetId);
        const audience = JSON.parse(String(sourcePin.audience)) as string[];
        if (targetPin) {
          const merged = [...new Set([...(JSON.parse(String(targetPin.audience)) as string[]), ...audience])];
          await tx.execute({
            sql: `UPDATE "${T.pins}" SET audience = ?, updatedAt = ? WHERE id = ?`,
            args: [JSON.stringify(merged), now, String(targetPin.id)],
          });
          await tx.execute({ sql: `DELETE FROM "${T.pins}" WHERE id = ?`, args: [String(sourcePin.id)] });
        } else {
          await tx.execute({
            sql: `UPDATE "${T.pins}" SET pageId = ?, updatedAt = ? WHERE id = ?`,
            args: [input.targetId, now, String(sourcePin.id)],
          });
        }
      }
      await tx.execute({
        sql: `UPDATE "${T.pages}" SET deletedAt = ?, deletedBy = ?, mergedInto = ?, version = version + 1, updatedBy = ?, updatedAt = ? WHERE id = ?`,
        args: [now, input.provenance.author, input.targetId, JSON.stringify(input.provenance), now, input.sourceId],
      });
      await this.#logActivity(
        tx,
        'page-merged',
        { scopeId: String(target.scopeId), pageId: input.sourceId, provenance: input.provenance },
        now,
      );
      return toPage((await this.#pageRow(tx, input.sourceId))!);
    });
  }

  deletePage(input: { id: string; expectedVersion: number; deletedBy: string }): Promise<KnowledgePage> {
    return this.#transaction(async tx => {
      const row = await this.#livePage(tx, input.id);
      if (Number(row.isScope) === 1) throw new Error(`Scope page ${input.id} cannot be deleted`);
      if (Number(row.version) !== input.expectedVersion) throw new KnowledgeConflictError(input.id);
      const children = await this.#query(
        tx,
        `SELECT 1 FROM "${T.pages}" WHERE parentId = ? AND deletedAt IS NULL LIMIT 1`,
        [input.id],
      );
      if (children.length > 0) throw new KnowledgePageHasChildrenError(input.id);
      const now = new Date().toISOString();
      await tx.execute({
        sql: `UPDATE "${T.pages}" SET deletedAt = ?, deletedBy = ?, version = version + 1, updatedBy = ?, updatedAt = ? WHERE id = ?`,
        args: [now, input.deletedBy, JSON.stringify({ author: input.deletedBy }), now, input.id],
      });
      await tx.execute({ sql: `DELETE FROM "${T.pins}" WHERE pageId = ?`, args: [input.id] });
      await this.#logActivity(
        tx,
        'page-deleted',
        { scopeId: String(row.scopeId), pageId: input.id, provenance: { author: input.deletedBy } },
        now,
      );
      return toPage((await this.#pageRow(tx, input.id))!);
    });
  }

  // Notes

  async #hydrateNotes(executor: PageExecutor, rows: Row[]): Promise<KnowledgeNote[]> {
    if (rows.length === 0) return [];
    const ids = jsonList(rows.map(row => String(row.id)));
    const stamps = await this.#query(
      executor,
      `SELECT noteId, scopeId FROM "${T.stamps}" WHERE noteId IN (SELECT value FROM json_each(?)) ORDER BY scopeId`,
      [ids],
    );
    const mentions = await this.#query(
      executor,
      `SELECT noteId, pageId FROM "${T.mentions}" WHERE noteId IN (SELECT value FROM json_each(?)) ORDER BY pageId`,
      [ids],
    );
    return rows.map(row =>
      toNote(
        row,
        stamps.filter(stamp => String(stamp.noteId) === String(row.id)).map(stamp => String(stamp.scopeId)),
        mentions.filter(mention => String(mention.noteId) === String(row.id)).map(mention => String(mention.pageId)),
      ),
    );
  }

  async #noteById(executor: PageExecutor, id: string): Promise<KnowledgeNote | null> {
    const rows = await this.#query(executor, `SELECT * FROM "${T.notes}" WHERE id = ?`, [id]);
    return (await this.#hydrateNotes(executor, rows))[0] ?? null;
  }

  async getNote(input: {
    id: string;
    read: KnowledgeReadScope;
    includeDeleted?: boolean;
  }): Promise<KnowledgeNote | null> {
    const readable = noteReadable('n', input.read);
    const rows = await this.#query(
      this.#read,
      `SELECT n.* FROM "${T.notes}" n WHERE n.id = ?${input.includeDeleted ? '' : ' AND n.deletedAt IS NULL'} AND ${readable.sql}`,
      [input.id, ...readable.args],
    );
    return (await this.#hydrateNotes(this.#read, rows))[0] ?? null;
  }

  async listNotes(input: {
    pageId: string;
    read: KnowledgeReadScope;
    cursor?: string;
    limit?: number;
    includeDeleted?: boolean;
  }): Promise<KnowledgeNoteListOutput> {
    const limit = limitOf(input.limit);
    const cursor = decodeCursor(input.cursor, 2);
    const readable = noteReadable('n', input.read);
    const args: InValue[] = [input.pageId, ...readable.args];
    let after = '';
    if (cursor) {
      after = ` AND (n.createdAt > ? OR (n.createdAt = ? AND n.id > ?))`;
      args.push(cursor[0]!, cursor[0]!, cursor[1]!);
    }
    args.push(limit + 1);
    const rows = await this.#query(
      this.#read,
      `SELECT n.* FROM "${T.notes}" n WHERE n.pageId = ?${input.includeDeleted ? '' : ' AND n.deletedAt IS NULL'} AND ${readable.sql}${after} ORDER BY n.createdAt, n.id LIMIT ?`,
      args,
    );
    return this.#noteOutput(rows, limit);
  }

  async listNotesMentioning(input: {
    pageId: string;
    read: KnowledgeReadScope;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeNoteListOutput> {
    const limit = limitOf(input.limit);
    const cursor = decodeCursor(input.cursor, 2);
    const readable = noteReadable('n', input.read);
    const args: InValue[] = [input.pageId, input.pageId, ...readable.args];
    let after = '';
    if (cursor) {
      after = ` AND (n.createdAt < ? OR (n.createdAt = ? AND n.id < ?))`;
      args.push(cursor[0]!, cursor[0]!, cursor[1]!);
    }
    args.push(limit + 1);
    const rows = await this.#query(
      this.#read,
      `SELECT n.* FROM "${T.notes}" n WHERE n.pageId <> ? AND n.deletedAt IS NULL AND EXISTS (SELECT 1 FROM "${T.mentions}" m WHERE m.noteId = n.id AND m.pageId = ?) AND ${readable.sql}${after} ORDER BY n.createdAt DESC, n.id DESC LIMIT ?`,
      args,
    );
    return this.#noteOutput(rows, limit);
  }

  async #noteOutput(rows: Row[], limit: number): Promise<KnowledgeNoteListOutput> {
    const page = rows.slice(0, limit);
    return {
      notes: await this.#hydrateNotes(this.#read, page),
      ...(rows.length > limit
        ? { nextCursor: encodeCursor([String(page[page.length - 1]!.createdAt), String(page[page.length - 1]!.id)]) }
        : {}),
    };
  }

  async #assertScopes(tx: PageExecutor, ids: string[]): Promise<void> {
    if (ids.length === 0) throw new Error('A note needs at least one stamp scope');
    const found = await this.#query(
      tx,
      `SELECT id FROM "${T.pages}" WHERE isScope = 1 AND id IN (SELECT value FROM json_each(?))`,
      [jsonList(ids)],
    );
    const known = new Set(found.map(row => String(row.id)));
    const missing = ids.find(id => !known.has(id));
    if (missing) throw new KnowledgeNotFoundError('scope', missing);
  }

  async addNote(input: AddKnowledgeNoteInput): Promise<KnowledgeNote> {
    await assertKnowledgeNoteTextWithinBound(input.text);
    return this.#transaction(async tx => {
      const page = await this.#livePage(tx, input.pageId);
      const stamps = [...new Set(input.stampScopeIds)];
      await this.#assertScopes(tx, stamps);
      const mentions = [...new Set(input.mentions)];
      for (const mention of mentions) await this.#livePage(tx, mention);
      const id = input.id ?? createKnowledgeUlid();
      if ((await this.#query(tx, `SELECT 1 FROM "${T.notes}" WHERE id = ?`, [id])).length > 0) {
        throw new KnowledgeConflictError(id);
      }
      const now = new Date().toISOString();
      await tx.execute({
        sql: `INSERT INTO "${T.notes}" (id, pageId, text, "when", provenance, version, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        args: [
          id,
          input.pageId,
          input.text,
          input.when ? input.when.toISOString() : null,
          JSON.stringify(input.provenance),
          now,
          now,
        ],
      });
      for (const stamp of stamps) {
        await tx.execute({ sql: `INSERT INTO "${T.stamps}" (noteId, scopeId) VALUES (?, ?)`, args: [id, stamp] });
      }
      for (const mention of mentions) {
        await tx.execute({ sql: `INSERT INTO "${T.mentions}" (noteId, pageId) VALUES (?, ?)`, args: [id, mention] });
      }
      await this.#logActivity(
        tx,
        'note-added',
        { scopeId: String(page.scopeId), pageId: input.pageId, noteId: id, provenance: input.provenance },
        now,
      );
      return (await this.#noteById(tx, id))!;
    });
  }

  async #noteWithPage(tx: PageExecutor, id: string): Promise<{ note: Row; page: Row }> {
    const note = (await this.#query(tx, `SELECT * FROM "${T.notes}" WHERE id = ?`, [id]))[0];
    if (!note) throw new KnowledgeNotFoundError('note', id);
    const page = await this.#pageRow(tx, String(note.pageId));
    if (!page) throw new KnowledgeNotFoundError('page', String(note.pageId));
    return { note, page };
  }

  restampNote(input: {
    id: string;
    expectedVersion: number;
    stampScopeIds: string[];
    provenance: KnowledgeProvenance;
  }): Promise<KnowledgeNote> {
    return this.#transaction(async tx => {
      const { note, page } = await this.#noteWithPage(tx, input.id);
      if (note.deletedAt) throw new KnowledgeNotFoundError('note', input.id);
      if (Number(note.version) !== input.expectedVersion) throw new KnowledgeConflictError(input.id);
      const stamps = [...new Set(input.stampScopeIds)];
      await this.#assertScopes(tx, stamps);
      const now = new Date().toISOString();
      await tx.execute({ sql: `DELETE FROM "${T.stamps}" WHERE noteId = ?`, args: [input.id] });
      for (const stamp of stamps) {
        await tx.execute({ sql: `INSERT INTO "${T.stamps}" (noteId, scopeId) VALUES (?, ?)`, args: [input.id, stamp] });
      }
      await tx.execute({
        sql: `UPDATE "${T.notes}" SET version = version + 1, updatedAt = ? WHERE id = ?`,
        args: [now, input.id],
      });
      await this.#logActivity(
        tx,
        'note-restamped',
        { scopeId: String(page.scopeId), pageId: String(page.id), noteId: input.id, provenance: input.provenance },
        now,
      );
      return (await this.#noteById(tx, input.id))!;
    });
  }

  removeNote(input: { id: string; deletedBy: string; provenance: KnowledgeProvenance }): Promise<KnowledgeNote> {
    return this.#transaction(async tx => {
      const { note, page } = await this.#noteWithPage(tx, input.id);
      if (note.deletedAt) throw new KnowledgeNotFoundError('note', input.id);
      const now = new Date().toISOString();
      await tx.execute({
        sql: `UPDATE "${T.notes}" SET deletedAt = ?, deletedBy = ?, version = version + 1, updatedAt = ? WHERE id = ?`,
        args: [now, input.deletedBy, now, input.id],
      });
      await this.#logActivity(
        tx,
        'note-removed',
        { scopeId: String(page.scopeId), pageId: String(page.id), noteId: input.id, provenance: input.provenance },
        now,
      );
      return (await this.#noteById(tx, input.id))!;
    });
  }

  restoreNote(input: { id: string; provenance: KnowledgeProvenance }): Promise<KnowledgeNote> {
    return this.#transaction(async tx => {
      const { note, page } = await this.#noteWithPage(tx, input.id);
      if (!note.deletedAt) throw new KnowledgeNotFoundError('note', input.id);
      const now = new Date().toISOString();
      await tx.execute({
        sql: `UPDATE "${T.notes}" SET deletedAt = NULL, deletedBy = NULL, version = version + 1, updatedAt = ? WHERE id = ?`,
        args: [now, input.id],
      });
      await this.#logActivity(
        tx,
        'note-restored',
        { scopeId: String(page.scopeId), pageId: String(page.id), noteId: input.id, provenance: input.provenance },
        now,
      );
      return (await this.#noteById(tx, input.id))!;
    });
  }

  // Search and activity

  async searchPages(input: SearchKnowledgePagesInput): Promise<KnowledgePageSearchHit[]> {
    const query = input.query.trim().toLowerCase();
    if (!query) return [];
    const limit = Math.max(1, input.limit ?? 20);
    const like = `%${escapeLike(query)}%`;
    const readable = pageReadable('p', input.read);
    const scopeFilter = input.scopeIds ? ` AND p.scopeId IN (SELECT value FROM json_each(?))` : '';
    const scopeArgs: InValue[] = input.scopeIds ? [jsonList(input.scopeIds)] : [];
    const pageRows = await this.#query(
      this.#read,
      `SELECT p.* FROM "${T.pages}" p WHERE p.deletedAt IS NULL AND ${readable.sql}${scopeFilter} AND (lower(p.name) LIKE ? ESCAPE '=' OR lower(COALESCE(p.description, '')) LIKE ? ESCAPE '=' OR lower(COALESCE(p.body, '')) LIKE ? ESCAPE '=') ORDER BY p.updatedAt DESC, p.id DESC LIMIT ?`,
      [...readable.args, ...scopeArgs, like, like, like, limit],
    );
    const hits: KnowledgePageSearchHit[] = pageRows.map(row => ({ type: 'page', page: toPage(row) }));
    if (hits.length >= limit) return hits;
    const noteVisible = noteReadable('n', input.read);
    const noteRows = await this.#query(
      this.#read,
      `SELECT n.* FROM "${T.notes}" n JOIN "${T.pages}" p ON p.id = n.pageId WHERE n.deletedAt IS NULL AND p.deletedAt IS NULL${scopeFilter} AND lower(n.text) LIKE ? ESCAPE '=' AND ${noteVisible.sql} ORDER BY n.createdAt DESC, n.id DESC LIMIT ?`,
      [...scopeArgs, like, ...noteVisible.args, limit - hits.length],
    );
    const notes = await this.#hydrateNotes(this.#read, noteRows);
    for (const note of notes) {
      const page = await this.#pageRow(this.#read, note.pageId);
      if (page) hits.push({ type: 'note', note, page: toPage(page) });
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
    const limit = limitOf(input.limit);
    const cursor = decodeCursor(input.cursor, 1);
    const readable = pageReadable('p', input.read);
    const noteVisible = noteReadable('n', input.read);
    const args: InValue[] = [...readable.args];
    let filters = '';
    if (input.scopeId !== undefined) {
      filters += ` AND p.scopeId = ?`;
      args.push(input.scopeId);
    }
    if (input.pageId !== undefined) {
      filters += ` AND e.pageId = ?`;
      args.push(input.pageId);
    }
    if (cursor) {
      filters += ` AND e.id < ?`;
      args.push(cursor[0]!);
    }
    args.push(...noteVisible.args, limit + 1);
    const rows = await this.#query(
      this.#read,
      `SELECT e.* FROM "${T.activity}" e JOIN "${T.pages}" p ON p.id = e.pageId WHERE ${readable.sql}${filters} AND (e.noteId IS NULL OR EXISTS (SELECT 1 FROM "${T.notes}" n WHERE n.id = e.noteId AND ${noteVisible.sql})) ORDER BY e.id DESC LIMIT ?`,
      args,
    );
    const page = rows.slice(0, limit);
    return {
      events: page.map(row => ({
        id: String(row.id),
        action: String(row.action) as KnowledgePageActivityAction,
        scopeId: String(row.scopeId),
        pageId: String(row.pageId),
        ...(row.noteId ? { noteId: String(row.noteId) } : {}),
        provenance: provenance(row.provenance),
        createdAt: new Date(String(row.createdAt)),
      })),
      ...(rows.length > limit ? { nextCursor: encodeCursor([String(page[page.length - 1]!.id)]) } : {}),
    };
  }

  // Pins

  addPinAudience(input: { pageId: string; audience: string[]; createdBy: string }): Promise<KnowledgePin> {
    return this.#transaction(async tx => {
      const page = await this.#livePage(tx, input.pageId);
      const now = new Date().toISOString();
      const existing = (await this.#query(tx, `SELECT * FROM "${T.pins}" WHERE pageId = ?`, [input.pageId]))[0];
      if (!existing) {
        const id = createKnowledgeUlid();
        await tx.execute({
          sql: `INSERT INTO "${T.pins}" (id, pageId, audience, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [id, input.pageId, JSON.stringify([...new Set(input.audience)]), input.createdBy, now, now],
        });
        await this.#logActivity(
          tx,
          'pin-added',
          { scopeId: String(page.scopeId), pageId: input.pageId, provenance: { author: input.createdBy } },
          now,
        );
        return toPin((await this.#query(tx, `SELECT * FROM "${T.pins}" WHERE id = ?`, [id]))[0]!);
      }
      const current = JSON.parse(String(existing.audience)) as string[];
      const merged = [...new Set([...current, ...input.audience])];
      if (merged.length !== current.length) {
        await tx.execute({
          sql: `UPDATE "${T.pins}" SET audience = ?, updatedAt = ? WHERE id = ?`,
          args: [JSON.stringify(merged), now, String(existing.id)],
        });
        await this.#logActivity(
          tx,
          'pin-added',
          { scopeId: String(page.scopeId), pageId: input.pageId, provenance: { author: input.createdBy } },
          now,
        );
      }
      return toPin((await this.#query(tx, `SELECT * FROM "${T.pins}" WHERE id = ?`, [String(existing.id)]))[0]!);
    });
  }

  removePinAudience(input: { pageId: string; audience: string[]; removedBy: string }): Promise<KnowledgePin | null> {
    return this.#transaction(async tx => {
      const existing = (await this.#query(tx, `SELECT * FROM "${T.pins}" WHERE pageId = ?`, [input.pageId]))[0];
      if (!existing) return null;
      const current = JSON.parse(String(existing.audience)) as string[];
      const remove = new Set(input.audience);
      const remaining = current.filter(entry => !remove.has(entry));
      if (remaining.length === current.length) return toPin(existing);
      const page = await this.#pageRow(tx, input.pageId);
      const now = new Date().toISOString();
      if (page) {
        await this.#logActivity(
          tx,
          'pin-removed',
          { scopeId: String(page.scopeId), pageId: input.pageId, provenance: { author: input.removedBy } },
          now,
        );
      }
      if (remaining.length === 0) {
        await tx.execute({ sql: `DELETE FROM "${T.pins}" WHERE id = ?`, args: [String(existing.id)] });
        return null;
      }
      await tx.execute({
        sql: `UPDATE "${T.pins}" SET audience = ?, updatedAt = ? WHERE id = ?`,
        args: [JSON.stringify(remaining), now, String(existing.id)],
      });
      return toPin((await this.#query(tx, `SELECT * FROM "${T.pins}" WHERE id = ?`, [String(existing.id)]))[0]!);
    });
  }

  async listPins(input: {
    audience: string[] | 'all';
    read: KnowledgeReadScope;
    pageIds?: string[];
    cursor?: string;
    limit?: number;
  }): Promise<{ pins: KnowledgePin[]; nextCursor?: string }> {
    const limit = limitOf(input.limit);
    const cursor = decodeCursor(input.cursor, 2);
    const readable = pageReadable('p', input.read);
    const args: InValue[] = [...readable.args];
    let filters = '';
    if (input.audience !== 'all') {
      filters += ` AND EXISTS (SELECT 1 FROM json_each(pin.audience) a WHERE a.value IN (SELECT value FROM json_each(?)))`;
      args.push(jsonList(input.audience));
    }
    if (input.pageIds) {
      filters += ` AND pin.pageId IN (SELECT value FROM json_each(?))`;
      args.push(jsonList(input.pageIds));
    }
    if (cursor) {
      filters += ` AND (pin.createdAt < ? OR (pin.createdAt = ? AND pin.id < ?))`;
      args.push(cursor[0]!, cursor[0]!, cursor[1]!);
    }
    args.push(limit + 1);
    const rows = await this.#query(
      this.#read,
      `SELECT pin.* FROM "${T.pins}" pin JOIN "${T.pages}" p ON p.id = pin.pageId WHERE p.deletedAt IS NULL AND ${readable.sql}${filters} ORDER BY pin.createdAt DESC, pin.id DESC LIMIT ?`,
      args,
    );
    const page = rows.slice(0, limit);
    return {
      pins: page.map(toPin),
      ...(rows.length > limit
        ? { nextCursor: encodeCursor([String(page[page.length - 1]!.createdAt), String(page[page.length - 1]!.id)]) }
        : {}),
    };
  }
}

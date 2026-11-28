import { knowledgeSearchWords } from '@internal/core/knowledge-compat';
import type {
  KnowledgeReadScope,
  KnowledgeSequenceItemsPage,
  KnowledgeSequenceItemRecord,
  KnowledgeSequenceItemRemoveResult,
  KnowledgeSequenceItemUpsertResult,
  KnowledgeSequenceOrderBy,
  KnowledgeSequencePurgeResult,
  KnowledgeSequenceRecord,
  KnowledgeSequencesStorage,
  ListKnowledgeSequenceItemsInput,
  MarkKnowledgeSequenceInput,
  SearchKnowledgeSequenceItemsInput,
  UpsertKnowledgeSequenceItemInput,
} from '@mastra/core/storage';

import type { SqliteInValue as InValue, SqliteResultSet as ResultSet } from '../../db/client';
import { escapeLike, KNOWLEDGE_PAGE_TABLES, pageReadable } from './pages';

interface Executor {
  execute(statement: string | { sql: string; args?: InValue[] }): Promise<ResultSet>;
}

export const LIBSQL_KNOWLEDGE_SEQUENCE_TABLES = {
  sequences: 'mastra_knowledge_sequences',
  items: 'mastra_knowledge_sequence_items',
} as const;

const T = LIBSQL_KNOWLEDGE_SEQUENCE_TABLES;
const PAGES = KNOWLEDGE_PAGE_TABLES.pages;

/**
 * Items carry no scope column: a read joins through the sequence page, so moving or deleting the
 * page reaches every item without rewriting one. Times are epoch milliseconds; `externalId`
 * compares byte for byte (BINARY). `links` and `properties` are JSON text; `searchText` is the
 * lowercased text search matches (`knowledgeSequenceItemSearchText`).
 */
export const KNOWLEDGE_SEQUENCE_DDL = [
  `CREATE TABLE IF NOT EXISTS "${T.sequences}" (
    pageId TEXT PRIMARY KEY,
    createdAt INTEGER NOT NULL,
    "orderBy" TEXT NOT NULL,
    propertiesSchema TEXT,
    itemTypes TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS "${T.items}" (
    id TEXT PRIMARY KEY,
    sequenceId TEXT NOT NULL REFERENCES "${T.sequences}" (pageId),
    externalId TEXT NOT NULL,
    occurredAt INTEGER,
    position TEXT,
    writtenAt INTEGER NOT NULL,
    editedAt INTEGER,
    deletedAt INTEGER,
    authorSourceId TEXT,
    authorName TEXT,
    externalParentId TEXT,
    type TEXT,
    title TEXT,
    body TEXT,
    links TEXT,
    properties TEXT,
    searchText TEXT NOT NULL,
    version INTEGER NOT NULL,
    writtenBy TEXT NOT NULL,
    pageId TEXT,
    UNIQUE (sequenceId, externalId)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kseq_items_order ON "${T.items}" (sequenceId, occurredAt, id)`,
  `CREATE INDEX IF NOT EXISTS idx_kseq_items_position ON "${T.items}" (sequenceId, position, id) WHERE position IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_kseq_items_parent ON "${T.items}" (sequenceId, externalParentId, occurredAt, id) WHERE externalParentId IS NOT NULL`,
];

/** Loaded when first needed, so this adapter keeps loading on cores without `knowledge-sequences`. */
let core: Promise<typeof import('@mastra/core/storage')> | undefined;
const loadCore = () => (core ??= import('@mastra/core/storage'));

type Row = Record<string, any>;
const date = (value: unknown) => (value === null || value === undefined ? null : new Date(Number(value)));

const toItem = (row: Row): KnowledgeSequenceItemRecord => ({
  id: String(row.id),
  sequenceId: String(row.sequenceId),
  externalId: String(row.externalId),
  occurredAt: date(row.occurredAt),
  position: row.position === null ? null : String(row.position),
  writtenAt: new Date(Number(row.writtenAt)),
  editedAt: date(row.editedAt),
  deletedAt: date(row.deletedAt),
  author:
    row.authorSourceId === null
      ? null
      : {
          sourceId: String(row.authorSourceId),
          ...(row.authorName === null ? {} : { name: String(row.authorName) }),
        },
  externalParentId: row.externalParentId === null ? null : String(row.externalParentId),
  type: row.type === null ? null : String(row.type),
  title: row.title === null ? null : String(row.title),
  body: row.body === null ? null : String(row.body),
  links: row.links === null ? [] : JSON.parse(String(row.links)),
  properties: row.properties === null ? null : JSON.parse(String(row.properties)),
  version: Number(row.version),
  writtenBy: String(row.writtenBy),
  pageId: row.pageId === null || row.pageId === undefined ? null : String(row.pageId),
});

const toSequence = (row: Row): KnowledgeSequenceRecord => ({
  pageId: String(row.pageId),
  orderBy: String(row.orderBy) as KnowledgeSequenceOrderBy,
  propertiesSchema: row.propertiesSchema === null ? null : JSON.parse(String(row.propertiesSchema)),
  itemTypes: row.itemTypes === null ? null : JSON.parse(String(row.itemTypes)),
});

/** The `types`/`untyped` filter as a predicate on `type`. */
function typeSql(alias: string, filter: { types: string[]; untyped: boolean }): { sql: string; args: InValue[] } {
  const terms: string[] = [];
  const args: InValue[] = [];
  if (filter.types.length > 0) {
    terms.push(`${alias}type IN (SELECT value FROM json_each(?))`);
    args.push(JSON.stringify(filter.types));
  }
  if (filter.untyped) terms.push(`${alias}type IS NULL`);
  return { sql: `(${terms.join(' OR ')})`, args };
}

/**
 * Sequences on LibSQL, over the same executor as the page store: on a transaction view the view's
 * write transaction, so item writes commit with the page writes. Writes go through `transaction`
 * (a savepoint inside a view), so a refusal writes nothing.
 */
export class LibSQLKnowledgeSequences implements KnowledgeSequencesStorage {
  readonly #read: Executor;
  readonly #transaction: <R>(operation: (tx: Executor) => Promise<R>) => Promise<R>;
  /** Whether the page store would return this page under `read`: live and in a readable scope. */
  readonly #readable: (pageId: string, read: KnowledgeReadScope) => Promise<boolean>;

  constructor(config: {
    read: Executor;
    transaction: <R>(operation: (tx: Executor) => Promise<R>) => Promise<R>;
    readable: (pageId: string, read: KnowledgeReadScope) => Promise<boolean>;
  }) {
    this.#read = config.read;
    this.#transaction = config.transaction;
    this.#readable = config.readable;
  }

  /** Statements for the Knowledge store's reset batch: drop the sequence tables. */
  static resetStatements(): string[] {
    return [`DROP TABLE IF EXISTS "${T.items}"`, `DROP TABLE IF EXISTS "${T.sequences}"`];
  }

  async clearAll(): Promise<void> {
    await this.#transaction(async tx => {
      await tx.execute(`DELETE FROM "${T.items}"`);
      await tx.execute(`DELETE FROM "${T.sequences}"`);
    });
  }

  async #page(tx: Executor, pageId: string): Promise<{ deletedAt: number | null } | undefined> {
    const row = (await tx.execute({ sql: `SELECT deletedAt FROM "${PAGES}" WHERE id = ?`, args: [pageId] })).rows[0];
    // Pages keep `deletedAt` as ISO text.
    return row ? { deletedAt: row.deletedAt ? Date.parse(String(row.deletedAt)) : null } : undefined;
  }

  async #liveSequence(tx: Executor, sequenceId: string): Promise<KnowledgeSequenceRecord> {
    const { rows } = await tx.execute({
      sql: `SELECT t.* FROM "${T.sequences}" t JOIN "${PAGES}" p ON p.id = t.pageId WHERE t.pageId = ? AND p.deletedAt IS NULL`,
      args: [sequenceId],
    });
    if (rows.length === 0) throw new (await loadCore()).KnowledgeSequenceNotFoundError(sequenceId);
    return toSequence(rows[0]!);
  }

  /** The key `input` places its item at; reads its neighbours inside the write transaction. */
  async #position(tx: Executor, input: UpsertKnowledgeSequenceItemInput, stored?: KnowledgeSequenceItemRecord) {
    const { knowledgeSequenceItemPosition } = await loadCore();
    const others = `sequenceId = ? AND externalId != ? AND position IS NOT NULL`;
    return knowledgeSequenceItemPosition(input, stored, {
      neighbour: async (externalId, side) => {
        const anchor = (
          await tx.execute({
            sql: `SELECT position, id FROM "${T.items}" WHERE ${others} AND externalId = ?`,
            args: [input.sequenceId, input.externalId, externalId],
          })
        ).rows[0];
        if (!anchor) return null;
        const position = String(anchor.position);
        const [op, dir] = side === 'after' ? ['>', 'ASC'] : ['<', 'DESC'];
        const next = (
          await tx.execute({
            sql: `SELECT position FROM "${T.items}" WHERE ${others} AND (position ${op} ? OR (position = ? AND id ${op} ?)) ORDER BY position ${dir}, id ${dir} LIMIT 1`,
            args: [input.sequenceId, input.externalId, position, position, String(anchor.id)],
          })
        ).rows[0];
        return { position, next: next ? String(next.position) : null };
      },
      last: async () => {
        const row = (
          await tx.execute({
            sql: `SELECT MAX(position) AS position FROM "${T.items}" WHERE ${others}`,
            args: [input.sequenceId, input.externalId],
          })
        ).rows[0];
        return row?.position == null ? null : String(row.position);
      },
      taken: async position =>
        (
          await tx.execute({
            sql: `SELECT 1 FROM "${T.items}" WHERE ${others} AND position = ? LIMIT 1`,
            args: [input.sequenceId, input.externalId, position],
          })
        ).rows.length > 0,
    });
  }

  async #item(tx: Executor, sequenceId: string, externalId: string): Promise<KnowledgeSequenceItemRecord | undefined> {
    const row = (
      await tx.execute({
        sql: `SELECT * FROM "${T.items}" WHERE sequenceId = ? AND externalId = ?`,
        args: [sequenceId, externalId],
      })
    ).rows[0];
    return row ? toItem(row) : undefined;
  }

  /** Refuses a parent that isn't an item of this sequence, is itself under one, or an item with items under it. */
  async #checkParent(tx: Executor, sequenceId: string, externalId: string, externalParentId: string | null) {
    if (!externalParentId) return;
    const { KnowledgeSequenceParentNestedError, KnowledgeSequenceParentNotFoundError } = await loadCore();
    const parent = await this.#item(tx, sequenceId, externalParentId);
    if (!parent) throw new KnowledgeSequenceParentNotFoundError(sequenceId, externalParentId);
    const under = await tx.execute({
      sql: `SELECT 1 FROM "${T.items}" WHERE sequenceId = ? AND externalParentId = ? LIMIT 1`,
      args: [sequenceId, externalId],
    });
    if (parent.externalParentId || under.rows.length > 0) {
      throw new KnowledgeSequenceParentNestedError(sequenceId, externalId);
    }
  }

  async markSequence({
    pageId,
    orderBy = 'timeline',
    ...schemas
  }: MarkKnowledgeSequenceInput): Promise<{ status: 'created' | 'unchanged' | 'updated' }> {
    const {
      checkKnowledgeSequenceDeclaration,
      KnowledgeNotFoundError,
      knowledgeSequenceMarkPositions,
      KnowledgeSequenceOrderByChangeError,
      KnowledgeSequenceTooManyChildrenError,
      MAX_KNOWLEDGE_SEQUENCE_MARK_CHILDREN,
      sameKnowledgeSequenceDeclaration,
    } = await loadCore();
    const declaration = checkKnowledgeSequenceDeclaration(schemas);
    const stored = [
      declaration.propertiesSchema === null ? null : JSON.stringify(declaration.propertiesSchema),
      declaration.itemTypes === null ? null : JSON.stringify(declaration.itemTypes),
    ];
    return this.#transaction(async tx => {
      const page = await this.#page(tx, pageId);
      if (!page || page.deletedAt !== null) throw new KnowledgeNotFoundError('page', pageId);
      const row = (await tx.execute({ sql: `SELECT * FROM "${T.sequences}" WHERE pageId = ?`, args: [pageId] }))
        .rows[0];
      if (row) {
        const marked = toSequence(row);
        if (marked.orderBy !== orderBy) throw new KnowledgeSequenceOrderByChangeError(pageId, marked.orderBy);
        if (sameKnowledgeSequenceDeclaration(marked, declaration)) return { status: 'unchanged' as const };
        await tx.execute({
          sql: `UPDATE "${T.sequences}" SET propertiesSchema = ?, itemTypes = ? WHERE pageId = ?`,
          args: [...stored, pageId],
        });
        return { status: 'updated' as const };
      }
      const children = (
        await tx.execute({
          sql: `SELECT id, position FROM "${PAGES}" WHERE parentId = ? AND isScope = 0 AND deletedAt IS NULL LIMIT ?`,
          args: [pageId, MAX_KNOWLEDGE_SEQUENCE_MARK_CHILDREN + 1],
        })
      ).rows.map(row => ({ id: String(row.id), position: String(row.position) }));
      if (children.length > MAX_KNOWLEDGE_SEQUENCE_MARK_CHILDREN) {
        const { rows } = await tx.execute({
          sql: `SELECT COUNT(*) AS n FROM "${PAGES}" WHERE parentId = ? AND isScope = 0 AND deletedAt IS NULL`,
          args: [pageId],
        });
        throw new KnowledgeSequenceTooManyChildrenError(pageId, Number(rows[0]!.n));
      }
      await tx.execute({
        sql: `INSERT INTO "${T.sequences}" (pageId, createdAt, "orderBy", propertiesSchema, itemTypes) VALUES (?, ?, ?, ?, ?)`,
        args: [pageId, Date.now(), orderBy, ...stored],
      });
      if (orderBy === 'position') {
        for (const [id, position] of knowledgeSequenceMarkPositions(children)) {
          if (children.find(child => child.id === id)!.position === position) continue;
          await tx.execute({ sql: `UPDATE "${PAGES}" SET position = ? WHERE id = ?`, args: [position, id] });
        }
      }
      for (const child of children) await this.#writePageItem(tx, pageId, orderBy, child.id);
      return { status: 'created' as const };
    });
  }

  /**
   * Brings page items in line with page `pageId` after the page store wrote it in `tx`: created,
   * renamed, moved from `from`, merged away or deleted. Tombstones its item in a sequence it left and
   * writes (or revives) the one in the sequence it is now a live child of. On a `position` sequence
   * `reposition` (no position was asked for) appends the page after every item, writing the key to the
   * page too; otherwise its key must be one no other item holds. Throwing rolls the page write back.
   */
  async pagePlaced(tx: Executor, pageId: string, from: string | null, options: { reposition?: boolean } = {}) {
    const page = (
      await tx.execute({
        sql: `SELECT parentId, isScope, deletedAt, updatedBy FROM "${PAGES}" WHERE id = ?`,
        args: [pageId],
      })
    ).rows[0];
    if (!page) return;
    const { knowledgeSequencePageItemId } = await loadCore();
    const externalId = knowledgeSequencePageItemId(pageId);
    const parentId = page.parentId === null ? null : String(page.parentId);
    const live = page.deletedAt === null && Number(page.isScope) === 0;
    for (const sequenceId of new Set([from, parentId])) {
      if (sequenceId === null) continue;
      const marked = (
        await tx.execute({ sql: `SELECT "orderBy" FROM "${T.sequences}" WHERE pageId = ?`, args: [sequenceId] })
      ).rows[0];
      if (!marked) continue;
      if (live && sequenceId === parentId) {
        await this.#writePageItem(tx, sequenceId, String(marked.orderBy) as KnowledgeSequenceOrderBy, pageId, options);
        continue;
      }
      const deletedAt = page.deletedAt === null ? Date.now() : Date.parse(String(page.deletedAt));
      await tx.execute({
        sql: `UPDATE "${T.items}" SET title = NULL, deletedAt = ?, writtenBy = ?, version = version + 1 WHERE sequenceId = ? AND externalId = ? AND deletedAt IS NULL`,
        args: [deletedAt, String(JSON.parse(String(page.updatedBy)).author), sequenceId, externalId],
      });
    }
  }

  async #writePageItem(
    tx: Executor,
    sequenceId: string,
    orderBy: KnowledgeSequenceOrderBy,
    pageId: string,
    options: { reposition?: boolean } = {},
  ): Promise<void> {
    const {
      createKnowledgeUlid,
      knowledgePositionBetween,
      knowledgeSequenceItemSearchText,
      knowledgeSequencePageItemId,
      refuseKnowledgeSequencePagePosition,
    } = await loadCore();
    const externalId = knowledgeSequencePageItemId(pageId);
    const page = (
      await tx.execute({
        sql: `SELECT name, position, createdAt, updatedBy FROM "${PAGES}" WHERE id = ?`,
        args: [pageId],
      })
    ).rows[0]!;
    let position: string | null = null;
    if (orderBy === 'position') {
      const others = `sequenceId = ? AND externalId != ? AND position IS NOT NULL`;
      if (options.reposition) {
        const last = (
          await tx.execute({
            sql: `SELECT MAX(position) AS position FROM "${T.items}" WHERE ${others}`,
            args: [sequenceId, externalId],
          })
        ).rows[0];
        position = knowledgePositionBetween(last?.position == null ? undefined : String(last.position));
        await tx.execute({ sql: `UPDATE "${PAGES}" SET position = ? WHERE id = ?`, args: [position, pageId] });
      } else {
        position = String(page.position);
        const taken = await tx.execute({
          sql: `SELECT 1 FROM "${T.items}" WHERE ${others} AND position = ? LIMIT 1`,
          args: [sequenceId, externalId, position],
        });
        if (taken.rows.length > 0) refuseKnowledgeSequencePagePosition(position);
      }
    }
    const occurredAt = orderBy === 'timeline' ? Date.parse(String(page.createdAt)) : null;
    const title = String(page.name);
    // A page item is found by its page's name, like any item by its title.
    const searchText = knowledgeSequenceItemSearchText({ title, body: null, links: [], properties: null });
    const writtenBy = String(JSON.parse(String(page.updatedBy)).author);
    const stored = await this.#item(tx, sequenceId, externalId);
    if (!stored) {
      await tx.execute({
        sql: `INSERT INTO "${T.items}" (id, sequenceId, externalId, writtenAt, version, occurredAt, position, title, searchText, writtenBy, pageId)
          VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
        args: [
          createKnowledgeUlid(),
          sequenceId,
          externalId,
          Date.now(),
          occurredAt,
          position,
          title,
          searchText,
          writtenBy,
          pageId,
        ],
      });
      return;
    }
    if (
      !stored.deletedAt &&
      stored.title === title &&
      stored.position === position &&
      (stored.occurredAt?.getTime() ?? null) === occurredAt
    ) {
      return;
    }
    await tx.execute({
      sql: `UPDATE "${T.items}" SET occurredAt = ?, position = ?, title = ?, searchText = ?, writtenBy = ?, deletedAt = NULL, version = version + 1 WHERE id = ?`,
      args: [occurredAt, position, title, searchText, writtenBy, stored.id],
    });
  }

  async getSequence({ pageId }: { pageId: string }): Promise<KnowledgeSequenceRecord | null> {
    const row = (await this.#read.execute({ sql: `SELECT * FROM "${T.sequences}" WHERE pageId = ?`, args: [pageId] }))
      .rows[0];
    return row ? toSequence(row) : null;
  }

  async listSequenceIds({ pageIds }: { pageIds: string[] }): Promise<string[]> {
    if (pageIds.length === 0) return [];
    const { rows } = await this.#read.execute({
      sql: `SELECT pageId FROM "${T.sequences}" WHERE pageId IN (SELECT value FROM json_each(?))`,
      args: [JSON.stringify(pageIds)],
    });
    const found = new Set(rows.map(row => String(row.pageId)));
    return pageIds.filter(id => found.has(id));
  }

  async upsertItem(input: UpsertKnowledgeSequenceItemInput): Promise<KnowledgeSequenceItemUpsertResult> {
    const {
      checkKnowledgeSequenceItemInput,
      checkKnowledgeSequenceLightItem,
      createKnowledgeUlid,
      isStaleKnowledgeSequenceEdit,
      knowledgeSequenceItemContent,
      knowledgeSequenceItemSearchText,
      sameKnowledgeSequenceItem,
    } = await loadCore();
    return this.#transaction(async tx => {
      const sequence = await this.#liveSequence(tx, input.sequenceId);
      checkKnowledgeSequenceLightItem(input.sequenceId, input.externalId);
      checkKnowledgeSequenceItemInput(input, sequence);
      const { orderBy } = sequence;
      const stored = await this.#item(tx, input.sequenceId, input.externalId);
      const position = orderBy === 'position' ? await this.#position(tx, input, stored) : null;
      const content = knowledgeSequenceItemContent(input);
      const fields = [
        input.occurredAt ? input.occurredAt.getTime() : null,
        position,
        input.editedAt ? input.editedAt.getTime() : null,
        input.author?.sourceId ?? null,
        input.author?.name ?? null,
        content.externalParentId,
        content.type,
        content.title,
        content.body,
        content.links.length > 0 ? JSON.stringify(content.links) : null,
        content.properties ? JSON.stringify(content.properties) : null,
        knowledgeSequenceItemSearchText(content),
        input.writtenBy,
      ];
      if (!stored) {
        await this.#checkParent(tx, input.sequenceId, input.externalId, content.externalParentId);
        await tx.execute({
          sql: `INSERT INTO "${T.items}" (id, sequenceId, externalId, writtenAt, deletedAt, version, occurredAt, position, editedAt, authorSourceId, authorName, externalParentId, type, title, body, links, properties, searchText, writtenBy)
            VALUES (?, ?, ?, ?, NULL, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [createKnowledgeUlid(), input.sequenceId, input.externalId, Date.now(), ...fields],
        });
        return { status: 'created' as const, item: (await this.#item(tx, input.sequenceId, input.externalId))! };
      }
      if (stored.deletedAt && !input.restore)
        return { status: 'ignored' as const, reason: 'deleted' as const, item: stored };
      if (!stored.deletedAt) {
        if (sameKnowledgeSequenceItem(stored, input, position)) return { status: 'unchanged' as const, item: stored };
        if (isStaleKnowledgeSequenceEdit(stored, input)) {
          return { status: 'ignored' as const, reason: 'stale' as const, item: stored };
        }
      }
      await this.#checkParent(tx, input.sequenceId, input.externalId, content.externalParentId);
      await tx.execute({
        sql: `UPDATE "${T.items}" SET occurredAt = ?, position = ?, editedAt = ?, authorSourceId = ?, authorName = ?, externalParentId = ?, type = ?, title = ?, body = ?, links = ?, properties = ?, searchText = ?, writtenBy = ?, deletedAt = NULL, version = version + 1 WHERE id = ?`,
        args: [...fields, stored.id],
      });
      return { status: 'updated' as const, item: (await this.#item(tx, input.sequenceId, input.externalId))! };
    });
  }

  async removeItem(input: {
    sequenceId: string;
    externalId: string;
    writtenBy: string;
    deletedAt?: Date;
  }): Promise<KnowledgeSequenceItemRemoveResult> {
    const { checkKnowledgeSequenceLightItem } = await loadCore();
    return this.#transaction(async tx => {
      await this.#liveSequence(tx, input.sequenceId);
      checkKnowledgeSequenceLightItem(input.sequenceId, input.externalId);
      const stored = await this.#item(tx, input.sequenceId, input.externalId);
      if (!stored) return { status: 'missing' as const };
      if (stored.deletedAt) return { status: 'unchanged' as const, item: stored };
      await tx.execute({
        sql: `UPDATE "${T.items}" SET title = NULL, body = NULL, links = NULL, properties = NULL, searchText = '', deletedAt = ?, writtenBy = ?, version = version + 1 WHERE id = ?`,
        args: [(input.deletedAt ?? new Date()).getTime(), input.writtenBy, stored.id],
      });
      return { status: 'removed' as const, item: (await this.#item(tx, input.sequenceId, input.externalId))! };
    });
  }

  async getItem(input: {
    sequenceId: string;
    id: string;
    read: KnowledgeReadScope;
  }): Promise<KnowledgeSequenceItemRecord | null> {
    const { rows } = await this.#read.execute({
      sql: `SELECT e.* FROM "${T.items}" e JOIN "${T.sequences}" t ON t.pageId = e.sequenceId WHERE e.sequenceId = ? AND e.id = ?`,
      args: [input.sequenceId, input.id],
    });
    if (!rows[0] || !(await this.#readable(input.sequenceId, input.read))) return null;
    return toItem(rows[0]);
  }

  async listItems(input: ListKnowledgeSequenceItemsInput): Promise<KnowledgeSequenceItemsPage> {
    const {
      checkKnowledgeSequenceReadLimit,
      decodeKnowledgeSequenceCursor,
      encodeKnowledgeSequenceCursor,
      knowledgeSequenceTypeFilter,
    } = await loadCore();
    checkKnowledgeSequenceReadLimit(input.limit);
    const typeFilter = knowledgeSequenceTypeFilter(input);
    const marked = (
      await this.#read.execute({
        sql: `SELECT "orderBy" FROM "${T.sequences}" WHERE pageId = ?`,
        args: [input.sequenceId],
      })
    ).rows[0];
    const orderBy = (marked ? String(marked.orderBy) : 'timeline') as KnowledgeSequenceOrderBy;
    const after = input.cursor ? decodeKnowledgeSequenceCursor(input.cursor, orderBy) : undefined;
    if (!marked || !(await this.#readable(input.sequenceId, input.read))) {
      return { items: [], nextCursor: null };
    }
    const key = orderBy === 'position' ? 'position' : 'occurredAt';
    const desc = (input.order ?? (orderBy === 'position' ? 'asc' : 'desc')) === 'desc';
    const where = ['sequenceId = ?'];
    const args: InValue[] = [input.sequenceId];
    if (!input.includeDeleted) where.push('deletedAt IS NULL');
    if (input.since) {
      where.push('occurredAt >= ?');
      args.push(input.since.getTime());
    }
    if (input.until) {
      where.push('occurredAt < ?');
      args.push(input.until.getTime());
    }
    if (input.externalParentId !== undefined) {
      where.push('(externalId = ? OR externalParentId = ?)');
      args.push(input.externalParentId, input.externalParentId);
    }
    if (typeFilter) {
      const filter = typeSql('', typeFilter);
      where.push(filter.sql);
      args.push(...filter.args);
    }
    if (after) {
      const op = desc ? '<' : '>';
      const value = after.orderBy === 'position' ? after.position : after.occurredAt;
      where.push(`(${key} ${op} ? OR (${key} = ? AND id ${op} ?))`);
      args.push(value, value, after.id);
    }
    const dir = desc ? 'DESC' : 'ASC';
    const { rows } = await this.#read.execute({
      sql: `SELECT * FROM "${T.items}" WHERE ${where.join(' AND ')} ORDER BY ${key} ${dir}, id ${dir} LIMIT ?`,
      args: [...args, input.limit + 1],
    });
    const items = rows.slice(0, input.limit).map(toItem);
    const last = items[items.length - 1];
    return { items, nextCursor: rows.length > input.limit && last ? encodeKnowledgeSequenceCursor(last) : null };
  }

  async searchItems(input: SearchKnowledgeSequenceItemsInput): Promise<KnowledgeSequenceItemRecord[]> {
    const { checkKnowledgeSequenceReadLimit, knowledgeSequenceTypeFilter } = await loadCore();
    checkKnowledgeSequenceReadLimit(input.limit);
    const typeFilter = knowledgeSequenceTypeFilter(input);
    const words = knowledgeSearchWords(input.query);
    if (!words.length) return [];
    const likes = words.map(word => `%${escapeLike(word)}%`);
    const has = `e.searchText LIKE ? ESCAPE '='`;
    // Visibility is filtered in the query, before the limit, so unreadable hits never crowd out readable ones.
    const readable = pageReadable('p', input.read);
    const where = [
      'e.deletedAt IS NULL',
      'p.deletedAt IS NULL',
      readable.sql,
      `(${words.map(() => has).join(' OR ')})`,
    ];
    const args: InValue[] = [...readable.args, ...likes];
    if (input.sequenceIds) {
      where.push('e.sequenceId IN (SELECT value FROM json_each(?))');
      args.push(JSON.stringify(input.sequenceIds));
    }
    if (input.scopeIds) {
      where.push('p.scopeId IN (SELECT value FROM json_each(?))');
      args.push(JSON.stringify(input.scopeIds));
    }
    if (input.since) {
      where.push('e.occurredAt >= ?');
      args.push(input.since.getTime());
    }
    if (input.until) {
      where.push('e.occurredAt < ?');
      args.push(input.until.getTime());
    }
    if (typeFilter) {
      const filter = typeSql('e.', typeFilter);
      where.push(filter.sql);
      args.push(...filter.args);
    }
    const matched = words.map(() => `(CASE WHEN ${has} THEN 1 ELSE 0 END)`).join(' + ');
    const { rows } = await this.#read.execute({
      sql: `SELECT e.* FROM "${T.items}" e JOIN "${T.sequences}" t ON t.pageId = e.sequenceId JOIN "${PAGES}" p ON p.id = e.sequenceId WHERE ${where.join(' AND ')} ORDER BY (${matched}) DESC, CASE WHEN t."orderBy" = 'timeline' THEN e.occurredAt END DESC, e.position IS NULL, e.position ASC, e.id ASC LIMIT ?`,
      args: [...args, ...likes, input.limit],
    });
    return rows.map(toItem);
  }

  async purgeItems(input: {
    sequenceId: string;
    deletedBefore: Date;
    limit: number;
  }): Promise<KnowledgeSequencePurgeResult> {
    const { KnowledgeSequencePurgeRefusedError } = await loadCore();
    return this.#transaction(async tx => {
      const page = await this.#page(tx, input.sequenceId);
      if (page && !(page.deletedAt !== null && page.deletedAt < input.deletedBefore.getTime())) {
        throw new KnowledgeSequencePurgeRefusedError(input.sequenceId);
      }
      const { rows } = await tx.execute({
        sql: `SELECT id FROM "${T.items}" WHERE sequenceId = ? ORDER BY id LIMIT ?`,
        args: [input.sequenceId, input.limit + 1],
      });
      const purgedIds = rows.slice(0, input.limit).map(row => String(row.id));
      if (purgedIds.length > 0) {
        await tx.execute({
          sql: `DELETE FROM "${T.items}" WHERE id IN (SELECT value FROM json_each(?))`,
          args: [JSON.stringify(purgedIds)],
        });
      }
      const done = rows.length <= input.limit;
      if (done) await tx.execute({ sql: `DELETE FROM "${T.sequences}" WHERE pageId = ?`, args: [input.sequenceId] });
      return { purgedIds, done };
    });
  }
}

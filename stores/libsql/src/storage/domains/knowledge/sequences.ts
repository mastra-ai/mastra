import { knowledgeSearchWords } from '@internal/core/knowledge-compat';
import type {
  KnowledgeReadScope,
  KnowledgeSequenceItemsPage,
  KnowledgeSequenceItemRecord,
  KnowledgeSequenceItemRemoveResult,
  KnowledgeSequenceItemUpsertResult,
  KnowledgeSequencePurgeResult,
  KnowledgeSequencesStorage,
  ListKnowledgeSequenceItemsInput,
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
 * compares byte for byte (BINARY).
 */
export const KNOWLEDGE_SEQUENCE_DDL = [
  `CREATE TABLE IF NOT EXISTS "${T.sequences}" (
    pageId TEXT PRIMARY KEY,
    createdAt INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "${T.items}" (
    id TEXT PRIMARY KEY,
    sequenceId TEXT NOT NULL REFERENCES "${T.sequences}" (pageId),
    externalId TEXT NOT NULL,
    occurredAt INTEGER NOT NULL,
    writtenAt INTEGER NOT NULL,
    editedAt INTEGER,
    deletedAt INTEGER,
    authorSourceId TEXT,
    authorName TEXT,
    threadExternalId TEXT,
    body TEXT NOT NULL,
    version INTEGER NOT NULL,
    writtenBy TEXT NOT NULL,
    UNIQUE (sequenceId, externalId)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kseq_items_order ON "${T.items}" (sequenceId, occurredAt, id)`,
  `CREATE INDEX IF NOT EXISTS idx_kseq_items_thread ON "${T.items}" (sequenceId, threadExternalId, occurredAt, id) WHERE threadExternalId IS NOT NULL`,
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
  occurredAt: new Date(Number(row.occurredAt)),
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
  threadExternalId: row.threadExternalId === null ? null : String(row.threadExternalId),
  body: String(row.body),
  version: Number(row.version),
  writtenBy: String(row.writtenBy),
});

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

  async #liveSequence(tx: Executor, sequenceId: string): Promise<void> {
    const { rows } = await tx.execute({
      sql: `SELECT 1 FROM "${T.sequences}" t JOIN "${PAGES}" p ON p.id = t.pageId WHERE t.pageId = ? AND p.deletedAt IS NULL`,
      args: [sequenceId],
    });
    if (rows.length === 0) throw new (await loadCore()).KnowledgeSequenceNotFoundError(sequenceId);
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

  async markSequence({ pageId }: { pageId: string }): Promise<{ status: 'created' | 'unchanged' }> {
    const { KnowledgeNotFoundError, KnowledgeSequenceNotLeafError } = await loadCore();
    return this.#transaction(async tx => {
      const page = await this.#page(tx, pageId);
      if (!page || page.deletedAt !== null) throw new KnowledgeNotFoundError('page', pageId);
      const marked = await tx.execute({ sql: `SELECT 1 FROM "${T.sequences}" WHERE pageId = ?`, args: [pageId] });
      if (marked.rows.length > 0) return { status: 'unchanged' as const };
      const child = await tx.execute({
        sql: `SELECT 1 FROM "${PAGES}" WHERE parentId = ? AND deletedAt IS NULL LIMIT 1`,
        args: [pageId],
      });
      if (child.rows.length > 0) throw new KnowledgeSequenceNotLeafError(pageId);
      await tx.execute({
        sql: `INSERT INTO "${T.sequences}" (pageId, createdAt) VALUES (?, ?)`,
        args: [pageId, Date.now()],
      });
      return { status: 'created' as const };
    });
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
      createKnowledgeUlid,
      isStaleKnowledgeSequenceEdit,
      sameKnowledgeSequenceItem,
    } = await loadCore();
    checkKnowledgeSequenceItemInput(input);
    return this.#transaction(async tx => {
      await this.#liveSequence(tx, input.sequenceId);
      const stored = await this.#item(tx, input.sequenceId, input.externalId);
      const fields = [
        input.occurredAt.getTime(),
        input.editedAt ? input.editedAt.getTime() : null,
        input.author?.sourceId ?? null,
        input.author?.name ?? null,
        input.threadExternalId ?? null,
        input.body,
        input.writtenBy,
      ];
      if (!stored) {
        await tx.execute({
          sql: `INSERT INTO "${T.items}" (id, sequenceId, externalId, writtenAt, deletedAt, version, occurredAt, editedAt, authorSourceId, authorName, threadExternalId, body, writtenBy)
            VALUES (?, ?, ?, ?, NULL, 1, ?, ?, ?, ?, ?, ?, ?)`,
          args: [createKnowledgeUlid(), input.sequenceId, input.externalId, Date.now(), ...fields],
        });
        return { status: 'created' as const, item: (await this.#item(tx, input.sequenceId, input.externalId))! };
      }
      if (stored.deletedAt && !input.restore)
        return { status: 'ignored' as const, reason: 'deleted' as const, item: stored };
      if (!stored.deletedAt) {
        if (sameKnowledgeSequenceItem(stored, input)) return { status: 'unchanged' as const, item: stored };
        if (isStaleKnowledgeSequenceEdit(stored, input)) {
          return { status: 'ignored' as const, reason: 'stale' as const, item: stored };
        }
      }
      await tx.execute({
        sql: `UPDATE "${T.items}" SET occurredAt = ?, editedAt = ?, authorSourceId = ?, authorName = ?, threadExternalId = ?, body = ?, writtenBy = ?, deletedAt = NULL, version = version + 1 WHERE id = ?`,
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
    return this.#transaction(async tx => {
      await this.#liveSequence(tx, input.sequenceId);
      const stored = await this.#item(tx, input.sequenceId, input.externalId);
      if (!stored) return { status: 'missing' as const };
      if (stored.deletedAt) return { status: 'unchanged' as const, item: stored };
      await tx.execute({
        sql: `UPDATE "${T.items}" SET body = '', deletedAt = ?, writtenBy = ?, version = version + 1 WHERE id = ?`,
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
    const { checkKnowledgeSequenceReadLimit, decodeKnowledgeSequenceCursor, encodeKnowledgeSequenceCursor } =
      await loadCore();
    checkKnowledgeSequenceReadLimit(input.limit);
    const after = input.cursor ? decodeKnowledgeSequenceCursor(input.cursor) : undefined;
    const marked = await this.#read.execute({
      sql: `SELECT 1 FROM "${T.sequences}" WHERE pageId = ?`,
      args: [input.sequenceId],
    });
    if (marked.rows.length === 0 || !(await this.#readable(input.sequenceId, input.read))) {
      return { items: [], nextCursor: null };
    }
    const desc = (input.order ?? 'desc') === 'desc';
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
    if (input.threadExternalId !== undefined) {
      where.push('(externalId = ? OR threadExternalId = ?)');
      args.push(input.threadExternalId, input.threadExternalId);
    }
    if (after) {
      const op = desc ? '<' : '>';
      where.push(`(occurredAt ${op} ? OR (occurredAt = ? AND id ${op} ?))`);
      args.push(after.occurredAt, after.occurredAt, after.id);
    }
    const dir = desc ? 'DESC' : 'ASC';
    const { rows } = await this.#read.execute({
      sql: `SELECT * FROM "${T.items}" WHERE ${where.join(' AND ')} ORDER BY occurredAt ${dir}, id ${dir} LIMIT ?`,
      args: [...args, input.limit + 1],
    });
    const items = rows.slice(0, input.limit).map(toItem);
    const last = items[items.length - 1];
    return { items, nextCursor: rows.length > input.limit && last ? encodeKnowledgeSequenceCursor(last) : null };
  }

  async searchItems(input: SearchKnowledgeSequenceItemsInput): Promise<KnowledgeSequenceItemRecord[]> {
    const { checkKnowledgeSequenceReadLimit } = await loadCore();
    checkKnowledgeSequenceReadLimit(input.limit);
    const words = knowledgeSearchWords(input.query);
    if (!words.length) return [];
    const likes = words.map(word => `%${escapeLike(word)}%`);
    const has = `lower(e.body) LIKE ? ESCAPE '='`;
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
    const matched = words.map(() => `(CASE WHEN ${has} THEN 1 ELSE 0 END)`).join(' + ');
    const { rows } = await this.#read.execute({
      sql: `SELECT e.* FROM "${T.items}" e JOIN "${T.sequences}" t ON t.pageId = e.sequenceId JOIN "${PAGES}" p ON p.id = e.sequenceId WHERE ${where.join(' AND ')} ORDER BY (${matched}) DESC, e.occurredAt DESC, e.id ASC LIMIT ?`,
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

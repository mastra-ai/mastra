import { knowledgeSearchWords } from '@internal/core/knowledge-compat';
import type {
  KnowledgeReadScope,
  KnowledgeTimelineEntriesPage,
  KnowledgeTimelineEntryRecord,
  KnowledgeTimelineEntryRemoveResult,
  KnowledgeTimelineEntryUpsertResult,
  KnowledgeTimelinePurgeResult,
  KnowledgeTimelinesStorage,
  ListKnowledgeTimelineEntriesInput,
  SearchKnowledgeTimelineEntriesInput,
  UpsertKnowledgeTimelineEntryInput,
} from '@mastra/core/storage';

import type { SqliteInValue as InValue, SqliteResultSet as ResultSet } from '../../db/client';
import { escapeLike, KNOWLEDGE_PAGE_TABLES, pageReadable } from './pages';

interface Executor {
  execute(statement: string | { sql: string; args?: InValue[] }): Promise<ResultSet>;
}

export const LIBSQL_KNOWLEDGE_TIMELINE_TABLES = {
  timelines: 'mastra_knowledge_timelines',
  entries: 'mastra_knowledge_timeline_entries',
} as const;

const T = LIBSQL_KNOWLEDGE_TIMELINE_TABLES;
const PAGES = KNOWLEDGE_PAGE_TABLES.pages;

/**
 * Entries carry no scope column: a read joins through the timeline page, so moving or deleting the
 * page reaches every entry without rewriting one. Times are epoch milliseconds; `externalId`
 * compares byte for byte (BINARY).
 */
export const KNOWLEDGE_TIMELINE_DDL = [
  `CREATE TABLE IF NOT EXISTS "${T.timelines}" (
    pageId TEXT PRIMARY KEY,
    createdAt INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "${T.entries}" (
    id TEXT PRIMARY KEY,
    timelineId TEXT NOT NULL REFERENCES "${T.timelines}" (pageId),
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
    UNIQUE (timelineId, externalId)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ktl_entries_time ON "${T.entries}" (timelineId, occurredAt, id)`,
  `CREATE INDEX IF NOT EXISTS idx_ktl_entries_thread ON "${T.entries}" (timelineId, threadExternalId, occurredAt, id) WHERE threadExternalId IS NOT NULL`,
];

/** Loaded when first needed, so this adapter keeps loading on cores without `knowledge-timelines`. */
let core: Promise<typeof import('@mastra/core/storage')> | undefined;
const loadCore = () => (core ??= import('@mastra/core/storage'));

type Row = Record<string, any>;
const date = (value: unknown) => (value === null || value === undefined ? null : new Date(Number(value)));

const toEntry = (row: Row): KnowledgeTimelineEntryRecord => ({
  id: String(row.id),
  timelineId: String(row.timelineId),
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
 * Timelines on LibSQL, over the same executor as the page store: on a transaction view the view's
 * write transaction, so entry writes commit with the page writes. Writes go through `transaction`
 * (a savepoint inside a view), so a refusal writes nothing.
 */
export class LibSQLKnowledgeTimelines implements KnowledgeTimelinesStorage {
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

  /** Statements for the Knowledge store's reset batch: drop the timeline tables. */
  static resetStatements(): string[] {
    return [`DROP TABLE IF EXISTS "${T.entries}"`, `DROP TABLE IF EXISTS "${T.timelines}"`];
  }

  async clearAll(): Promise<void> {
    await this.#transaction(async tx => {
      await tx.execute(`DELETE FROM "${T.entries}"`);
      await tx.execute(`DELETE FROM "${T.timelines}"`);
    });
  }

  async #page(tx: Executor, pageId: string): Promise<{ deletedAt: number | null } | undefined> {
    const row = (await tx.execute({ sql: `SELECT deletedAt FROM "${PAGES}" WHERE id = ?`, args: [pageId] })).rows[0];
    // Pages keep `deletedAt` as ISO text.
    return row ? { deletedAt: row.deletedAt ? Date.parse(String(row.deletedAt)) : null } : undefined;
  }

  async #liveTimeline(tx: Executor, timelineId: string): Promise<void> {
    const { rows } = await tx.execute({
      sql: `SELECT 1 FROM "${T.timelines}" t JOIN "${PAGES}" p ON p.id = t.pageId WHERE t.pageId = ? AND p.deletedAt IS NULL`,
      args: [timelineId],
    });
    if (rows.length === 0) throw new (await loadCore()).KnowledgeTimelineNotFoundError(timelineId);
  }

  async #entry(
    tx: Executor,
    timelineId: string,
    externalId: string,
  ): Promise<KnowledgeTimelineEntryRecord | undefined> {
    const row = (
      await tx.execute({
        sql: `SELECT * FROM "${T.entries}" WHERE timelineId = ? AND externalId = ?`,
        args: [timelineId, externalId],
      })
    ).rows[0];
    return row ? toEntry(row) : undefined;
  }

  async markTimeline({ pageId }: { pageId: string }): Promise<{ status: 'created' | 'unchanged' }> {
    const { KnowledgeNotFoundError, KnowledgeTimelineNotLeafError } = await loadCore();
    return this.#transaction(async tx => {
      const page = await this.#page(tx, pageId);
      if (!page || page.deletedAt !== null) throw new KnowledgeNotFoundError('page', pageId);
      const marked = await tx.execute({ sql: `SELECT 1 FROM "${T.timelines}" WHERE pageId = ?`, args: [pageId] });
      if (marked.rows.length > 0) return { status: 'unchanged' as const };
      const child = await tx.execute({
        sql: `SELECT 1 FROM "${PAGES}" WHERE parentId = ? AND deletedAt IS NULL LIMIT 1`,
        args: [pageId],
      });
      if (child.rows.length > 0) throw new KnowledgeTimelineNotLeafError(pageId);
      await tx.execute({
        sql: `INSERT INTO "${T.timelines}" (pageId, createdAt) VALUES (?, ?)`,
        args: [pageId, Date.now()],
      });
      return { status: 'created' as const };
    });
  }

  async listTimelineIds({ pageIds }: { pageIds: string[] }): Promise<string[]> {
    if (pageIds.length === 0) return [];
    const { rows } = await this.#read.execute({
      sql: `SELECT pageId FROM "${T.timelines}" WHERE pageId IN (SELECT value FROM json_each(?))`,
      args: [JSON.stringify(pageIds)],
    });
    const found = new Set(rows.map(row => String(row.pageId)));
    return pageIds.filter(id => found.has(id));
  }

  async upsertEntry(input: UpsertKnowledgeTimelineEntryInput): Promise<KnowledgeTimelineEntryUpsertResult> {
    const {
      checkKnowledgeTimelineEntryInput,
      createKnowledgeUlid,
      isStaleKnowledgeTimelineEdit,
      sameKnowledgeTimelineEntry,
    } = await loadCore();
    checkKnowledgeTimelineEntryInput(input);
    return this.#transaction(async tx => {
      await this.#liveTimeline(tx, input.timelineId);
      const stored = await this.#entry(tx, input.timelineId, input.externalId);
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
          sql: `INSERT INTO "${T.entries}" (id, timelineId, externalId, writtenAt, deletedAt, version, occurredAt, editedAt, authorSourceId, authorName, threadExternalId, body, writtenBy)
            VALUES (?, ?, ?, ?, NULL, 1, ?, ?, ?, ?, ?, ?, ?)`,
          args: [createKnowledgeUlid(), input.timelineId, input.externalId, Date.now(), ...fields],
        });
        return { status: 'created' as const, entry: (await this.#entry(tx, input.timelineId, input.externalId))! };
      }
      if (stored.deletedAt && !input.restore)
        return { status: 'ignored' as const, reason: 'deleted' as const, entry: stored };
      if (!stored.deletedAt) {
        if (sameKnowledgeTimelineEntry(stored, input)) return { status: 'unchanged' as const, entry: stored };
        if (isStaleKnowledgeTimelineEdit(stored, input)) {
          return { status: 'ignored' as const, reason: 'stale' as const, entry: stored };
        }
      }
      await tx.execute({
        sql: `UPDATE "${T.entries}" SET occurredAt = ?, editedAt = ?, authorSourceId = ?, authorName = ?, threadExternalId = ?, body = ?, writtenBy = ?, deletedAt = NULL, version = version + 1 WHERE id = ?`,
        args: [...fields, stored.id],
      });
      return { status: 'updated' as const, entry: (await this.#entry(tx, input.timelineId, input.externalId))! };
    });
  }

  async removeEntry(input: {
    timelineId: string;
    externalId: string;
    writtenBy: string;
    deletedAt?: Date;
  }): Promise<KnowledgeTimelineEntryRemoveResult> {
    return this.#transaction(async tx => {
      await this.#liveTimeline(tx, input.timelineId);
      const stored = await this.#entry(tx, input.timelineId, input.externalId);
      if (!stored) return { status: 'missing' as const };
      if (stored.deletedAt) return { status: 'unchanged' as const, entry: stored };
      await tx.execute({
        sql: `UPDATE "${T.entries}" SET body = '', deletedAt = ?, writtenBy = ?, version = version + 1 WHERE id = ?`,
        args: [(input.deletedAt ?? new Date()).getTime(), input.writtenBy, stored.id],
      });
      return { status: 'removed' as const, entry: (await this.#entry(tx, input.timelineId, input.externalId))! };
    });
  }

  async getEntry(input: {
    timelineId: string;
    id: string;
    read: KnowledgeReadScope;
  }): Promise<KnowledgeTimelineEntryRecord | null> {
    const { rows } = await this.#read.execute({
      sql: `SELECT e.* FROM "${T.entries}" e JOIN "${T.timelines}" t ON t.pageId = e.timelineId WHERE e.timelineId = ? AND e.id = ?`,
      args: [input.timelineId, input.id],
    });
    if (!rows[0] || !(await this.#readable(input.timelineId, input.read))) return null;
    return toEntry(rows[0]);
  }

  async listEntries(input: ListKnowledgeTimelineEntriesInput): Promise<KnowledgeTimelineEntriesPage> {
    const { checkKnowledgeTimelineReadLimit, decodeKnowledgeTimelineCursor, encodeKnowledgeTimelineCursor } =
      await loadCore();
    checkKnowledgeTimelineReadLimit(input.limit);
    const after = input.cursor ? decodeKnowledgeTimelineCursor(input.cursor) : undefined;
    const marked = await this.#read.execute({
      sql: `SELECT 1 FROM "${T.timelines}" WHERE pageId = ?`,
      args: [input.timelineId],
    });
    if (marked.rows.length === 0 || !(await this.#readable(input.timelineId, input.read))) {
      return { entries: [], nextCursor: null };
    }
    const desc = (input.order ?? 'desc') === 'desc';
    const where = ['timelineId = ?'];
    const args: InValue[] = [input.timelineId];
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
      sql: `SELECT * FROM "${T.entries}" WHERE ${where.join(' AND ')} ORDER BY occurredAt ${dir}, id ${dir} LIMIT ?`,
      args: [...args, input.limit + 1],
    });
    const entries = rows.slice(0, input.limit).map(toEntry);
    const last = entries[entries.length - 1];
    return { entries, nextCursor: rows.length > input.limit && last ? encodeKnowledgeTimelineCursor(last) : null };
  }

  async searchEntries(input: SearchKnowledgeTimelineEntriesInput): Promise<KnowledgeTimelineEntryRecord[]> {
    const { checkKnowledgeTimelineReadLimit } = await loadCore();
    checkKnowledgeTimelineReadLimit(input.limit);
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
    if (input.timelineIds) {
      where.push('e.timelineId IN (SELECT value FROM json_each(?))');
      args.push(JSON.stringify(input.timelineIds));
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
      sql: `SELECT e.* FROM "${T.entries}" e JOIN "${T.timelines}" t ON t.pageId = e.timelineId JOIN "${PAGES}" p ON p.id = e.timelineId WHERE ${where.join(' AND ')} ORDER BY (${matched}) DESC, e.occurredAt DESC, e.id ASC LIMIT ?`,
      args: [...args, ...likes, input.limit],
    });
    return rows.map(toEntry);
  }

  async purgeEntries(input: {
    timelineId: string;
    deletedBefore: Date;
    limit: number;
  }): Promise<KnowledgeTimelinePurgeResult> {
    const { KnowledgeTimelinePurgeRefusedError } = await loadCore();
    return this.#transaction(async tx => {
      const page = await this.#page(tx, input.timelineId);
      if (page && !(page.deletedAt !== null && page.deletedAt < input.deletedBefore.getTime())) {
        throw new KnowledgeTimelinePurgeRefusedError(input.timelineId);
      }
      const { rows } = await tx.execute({
        sql: `SELECT id FROM "${T.entries}" WHERE timelineId = ? ORDER BY id LIMIT ?`,
        args: [input.timelineId, input.limit + 1],
      });
      const purgedIds = rows.slice(0, input.limit).map(row => String(row.id));
      if (purgedIds.length > 0) {
        await tx.execute({
          sql: `DELETE FROM "${T.entries}" WHERE id IN (SELECT value FROM json_each(?))`,
          args: [JSON.stringify(purgedIds)],
        });
      }
      const done = rows.length <= input.limit;
      if (done) await tx.execute({ sql: `DELETE FROM "${T.timelines}" WHERE pageId = ?`, args: [input.timelineId] });
      return { purgedIds, done };
    });
  }
}

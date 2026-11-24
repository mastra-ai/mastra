import type {
  KnowledgeReadScope,
  KnowledgeTimelineEntriesPage,
  KnowledgeTimelineEntryRecord,
  KnowledgeTimelineEntryRemoveResult,
  KnowledgeTimelineEntryUpsertResult,
  KnowledgeTimelinePurgeResult,
  KnowledgeTimelinesStorage,
  ListKnowledgeTimelineEntriesInput,
  UpsertKnowledgeTimelineEntryInput,
} from '@mastra/core/storage';

import type { DbClient, TxClient } from '../../client';
import { PG_KNOWLEDGE_PAGES_TABLES } from './pages';

type Queryable = Pick<TxClient, 'none' | 'oneOrNone' | 'any' | 'query'>;

export const PG_KNOWLEDGE_TIMELINE_TABLES = {
  timelines: 'mastra_knowledge_timelines',
  entries: 'mastra_knowledge_timeline_entries',
} as const;

const qualify = (schemaName: string | undefined, table: string) =>
  schemaName ? `"${schemaName}"."${table}"` : `"${table}"`;

function tables(schemaName?: string) {
  return {
    timelines: qualify(schemaName, PG_KNOWLEDGE_TIMELINE_TABLES.timelines),
    entries: qualify(schemaName, PG_KNOWLEDGE_TIMELINE_TABLES.entries),
    pages: qualify(schemaName, PG_KNOWLEDGE_PAGES_TABLES.pages),
  };
}

/**
 * The timeline tables in `schemaName`, next to the page tables. Entries carry no scope column: a
 * read goes through the timeline page, so moving or deleting the page reaches every entry without
 * rewriting one. `occurredAt` is epoch milliseconds so the `(occurredAt, id)` cursor compares
 * exactly; IDs compare byte for byte under the `C` collation, matching the cursor's order.
 */
export function pgKnowledgeTimelinesDDL(schemaName?: string): string[] {
  const t = tables(schemaName);
  return [
    `CREATE TABLE IF NOT EXISTS ${t.timelines} (
      "pageId" text PRIMARY KEY,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS ${t.entries} (
      "id" text COLLATE "C" PRIMARY KEY,
      "timelineId" text NOT NULL REFERENCES ${t.timelines} ("pageId"),
      "externalId" text COLLATE "C" NOT NULL,
      "occurredAt" bigint NOT NULL,
      "writtenAt" timestamptz NOT NULL,
      "editedAt" timestamptz,
      "deletedAt" timestamptz,
      "authorSourceId" text,
      "authorName" text,
      "threadExternalId" text COLLATE "C",
      "body" text NOT NULL,
      "version" integer NOT NULL,
      "writtenBy" text NOT NULL,
      UNIQUE ("timelineId", "externalId")
    )`,
    `CREATE INDEX IF NOT EXISTS mastra_knowledge_timeline_entries_time ON ${t.entries} ("timelineId", "occurredAt", "id")`,
    `CREATE INDEX IF NOT EXISTS mastra_knowledge_timeline_entries_thread ON ${t.entries} ("timelineId", "threadExternalId", "occurredAt", "id") WHERE "threadExternalId" IS NOT NULL`,
  ];
}

/** Loaded when first needed, so this adapter keeps loading on cores without `knowledge-timelines`. */
let core: Promise<typeof import('@mastra/core/storage')> | undefined;
const loadCore = () => (core ??= import('@mastra/core/storage'));

type Row = Record<string, any>;
const date = (value: unknown) => (value === null || value === undefined ? null : new Date(value as string | Date));

const toEntry = (row: Row): KnowledgeTimelineEntryRecord => ({
  id: row.id,
  timelineId: row.timelineId,
  externalId: row.externalId,
  occurredAt: new Date(Number(row.occurredAt)),
  writtenAt: new Date(row.writtenAt),
  editedAt: date(row.editedAt),
  deletedAt: date(row.deletedAt),
  author:
    row.authorSourceId === null
      ? null
      : { sourceId: row.authorSourceId, ...(row.authorName === null ? {} : { name: row.authorName }) },
  threadExternalId: row.threadExternalId ?? null,
  body: row.body,
  version: Number(row.version),
  writtenBy: row.writtenBy,
});

/**
 * Timelines on PostgreSQL, on the same client and schema as the pages: on a transaction view the
 * view's transaction (each write a savepoint in it). Writers on one timeline serialize on its
 * timeline row (`FOR UPDATE`), which also keeps a purge from racing an upsert.
 */
export class PgKnowledgeTimelines implements KnowledgeTimelinesStorage {
  readonly #client: DbClient;
  readonly #schemaName?: string;
  readonly #t: ReturnType<typeof tables>;
  /** Whether the page store would return this page under `read`: live and in a readable scope. */
  readonly #readable: (pageId: string, read: KnowledgeReadScope) => Promise<boolean>;

  constructor(config: {
    client: DbClient;
    schemaName?: string;
    readable: (pageId: string, read: KnowledgeReadScope) => Promise<boolean>;
  }) {
    this.#client = config.client;
    this.#schemaName = config.schemaName;
    this.#t = tables(config.schemaName);
    this.#readable = config.readable;
  }

  async init(): Promise<void> {
    await this.#client.tx(async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `mastra-knowledge-timelines-schema:${this.#schemaName ?? ''}`,
      ]);
      for (const statement of pgKnowledgeTimelinesDDL(this.#schemaName)) await tx.query(statement);
    });
  }

  /** For the store's reset: drop the timeline tables, if they were ever created. */
  async dropOnReset(): Promise<void> {
    await this.#client.query(`DROP TABLE IF EXISTS ${this.#t.entries}, ${this.#t.timelines}`);
  }

  async clearAll(): Promise<void> {
    await this.#client.query(`TRUNCATE ${this.#t.entries}, ${this.#t.timelines}`);
  }

  /** Locks the timeline row, refusing when it isn't a live timeline. */
  async #lockLive(tx: Queryable, timelineId: string): Promise<void> {
    const row = await tx.oneOrNone(
      `SELECT 1 FROM ${this.#t.timelines} t JOIN ${this.#t.pages} p ON p."id" = t."pageId" WHERE t."pageId" = $1 AND p."deletedAt" IS NULL FOR UPDATE OF t`,
      [timelineId],
    );
    if (!row) throw new (await loadCore()).KnowledgeTimelineNotFoundError(timelineId);
  }

  async #entry(
    tx: Queryable,
    timelineId: string,
    externalId: string,
  ): Promise<KnowledgeTimelineEntryRecord | undefined> {
    const row = await tx.oneOrNone(`SELECT * FROM ${this.#t.entries} WHERE "timelineId" = $1 AND "externalId" = $2`, [
      timelineId,
      externalId,
    ]);
    return row ? toEntry(row) : undefined;
  }

  async markTimeline({ pageId }: { pageId: string }): Promise<{ status: 'created' | 'unchanged' }> {
    const { KnowledgeNotFoundError, KnowledgeTimelineNotLeafError } = await loadCore();
    return this.#client.tx(async tx => {
      const page = await tx.oneOrNone(`SELECT "deletedAt" FROM ${this.#t.pages} WHERE "id" = $1 FOR UPDATE`, [pageId]);
      if (!page || page.deletedAt) throw new KnowledgeNotFoundError('page', pageId);
      const marked = await tx.oneOrNone(`SELECT 1 FROM ${this.#t.timelines} WHERE "pageId" = $1`, [pageId]);
      if (marked) return { status: 'unchanged' as const };
      const child = await tx.oneOrNone(
        `SELECT 1 FROM ${this.#t.pages} WHERE "parentId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
        [pageId],
      );
      if (child) throw new KnowledgeTimelineNotLeafError(pageId);
      await tx.none(`INSERT INTO ${this.#t.timelines} ("pageId") VALUES ($1)`, [pageId]);
      return { status: 'created' as const };
    });
  }

  async listTimelineIds({ pageIds }: { pageIds: string[] }): Promise<string[]> {
    if (pageIds.length === 0) return [];
    const rows = await this.#client.any(`SELECT "pageId" FROM ${this.#t.timelines} WHERE "pageId" = ANY($1::text[])`, [
      pageIds,
    ]);
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
    return this.#client.tx(async tx => {
      await this.#lockLive(tx, input.timelineId);
      const stored = await this.#entry(tx, input.timelineId, input.externalId);
      const fields = [
        input.occurredAt.getTime(),
        input.editedAt ?? null,
        input.author?.sourceId ?? null,
        input.author?.name ?? null,
        input.threadExternalId ?? null,
        input.body,
        input.writtenBy,
      ];
      if (!stored) {
        await tx.none(
          `INSERT INTO ${this.#t.entries} ("occurredAt", "editedAt", "authorSourceId", "authorName", "threadExternalId", "body", "writtenBy", "id", "timelineId", "externalId", "writtenAt", "version")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), 1)`,
          [...fields, createKnowledgeUlid(), input.timelineId, input.externalId],
        );
        return { status: 'created' as const, entry: (await this.#entry(tx, input.timelineId, input.externalId))! };
      }
      if (stored.deletedAt && !input.restore) {
        return { status: 'ignored' as const, reason: 'deleted' as const, entry: stored };
      }
      if (!stored.deletedAt) {
        if (sameKnowledgeTimelineEntry(stored, input)) return { status: 'unchanged' as const, entry: stored };
        if (isStaleKnowledgeTimelineEdit(stored, input)) {
          return { status: 'ignored' as const, reason: 'stale' as const, entry: stored };
        }
      }
      await tx.none(
        `UPDATE ${this.#t.entries} SET "occurredAt" = $1, "editedAt" = $2, "authorSourceId" = $3, "authorName" = $4, "threadExternalId" = $5, "body" = $6, "writtenBy" = $7, "deletedAt" = NULL, "version" = "version" + 1 WHERE "id" = $8`,
        [...fields, stored.id],
      );
      return { status: 'updated' as const, entry: (await this.#entry(tx, input.timelineId, input.externalId))! };
    });
  }

  async removeEntry(input: {
    timelineId: string;
    externalId: string;
    writtenBy: string;
    deletedAt?: Date;
  }): Promise<KnowledgeTimelineEntryRemoveResult> {
    return this.#client.tx(async tx => {
      await this.#lockLive(tx, input.timelineId);
      const stored = await this.#entry(tx, input.timelineId, input.externalId);
      if (!stored) return { status: 'missing' as const };
      if (stored.deletedAt) return { status: 'unchanged' as const, entry: stored };
      await tx.none(
        `UPDATE ${this.#t.entries} SET "body" = '', "deletedAt" = $1, "writtenBy" = $2, "version" = "version" + 1 WHERE "id" = $3`,
        [input.deletedAt ?? new Date(), input.writtenBy, stored.id],
      );
      return { status: 'removed' as const, entry: (await this.#entry(tx, input.timelineId, input.externalId))! };
    });
  }

  async listEntries(input: ListKnowledgeTimelineEntriesInput): Promise<KnowledgeTimelineEntriesPage> {
    const { checkKnowledgeTimelineReadLimit, decodeKnowledgeTimelineCursor, encodeKnowledgeTimelineCursor } =
      await loadCore();
    checkKnowledgeTimelineReadLimit(input.limit);
    const after = input.cursor ? decodeKnowledgeTimelineCursor(input.cursor) : undefined;
    const marked = await this.#client.oneOrNone(`SELECT 1 FROM ${this.#t.timelines} WHERE "pageId" = $1`, [
      input.timelineId,
    ]);
    if (!marked || !(await this.#readable(input.timelineId, input.read))) return { entries: [], nextCursor: null };
    const desc = (input.order ?? 'desc') === 'desc';
    const args: unknown[] = [input.timelineId];
    const arg = (value: unknown) => `$${args.push(value)}`;
    const where = [`"timelineId" = $1`];
    if (!input.includeDeleted) where.push(`"deletedAt" IS NULL`);
    if (input.since) where.push(`"occurredAt" >= ${arg(input.since.getTime())}`);
    if (input.until) where.push(`"occurredAt" < ${arg(input.until.getTime())}`);
    if (input.threadExternalId !== undefined) {
      const thread = arg(input.threadExternalId);
      where.push(`("externalId" = ${thread} OR "threadExternalId" = ${thread})`);
    }
    if (after) {
      where.push(`("occurredAt", "id") ${desc ? '<' : '>'} (${arg(after.occurredAt)}, ${arg(after.id)})`);
    }
    const dir = desc ? 'DESC' : 'ASC';
    const rows = await this.#client.any(
      `SELECT * FROM ${this.#t.entries} WHERE ${where.join(' AND ')} ORDER BY "occurredAt" ${dir}, "id" ${dir} LIMIT ${arg(input.limit + 1)}`,
      args,
    );
    const entries = rows.slice(0, input.limit).map(toEntry);
    const last = entries[entries.length - 1];
    return { entries, nextCursor: rows.length > input.limit && last ? encodeKnowledgeTimelineCursor(last) : null };
  }

  async purgeEntries(input: {
    timelineId: string;
    deletedBefore: Date;
    limit: number;
  }): Promise<KnowledgeTimelinePurgeResult> {
    const { KnowledgeTimelinePurgeRefusedError } = await loadCore();
    return this.#client.tx(async tx => {
      const page = await tx.oneOrNone(`SELECT "deletedAt" FROM ${this.#t.pages} WHERE "id" = $1`, [input.timelineId]);
      if (page && !(page.deletedAt && new Date(page.deletedAt).getTime() < input.deletedBefore.getTime())) {
        throw new KnowledgeTimelinePurgeRefusedError(input.timelineId);
      }
      await tx.query(`SELECT 1 FROM ${this.#t.timelines} WHERE "pageId" = $1 FOR UPDATE`, [input.timelineId]);
      const rows = await tx.any(`SELECT "id" FROM ${this.#t.entries} WHERE "timelineId" = $1 ORDER BY "id" LIMIT $2`, [
        input.timelineId,
        input.limit + 1,
      ]);
      const purgedIds = rows.slice(0, input.limit).map(row => String(row.id));
      if (purgedIds.length > 0)
        await tx.none(`DELETE FROM ${this.#t.entries} WHERE "id" = ANY($1::text[])`, [purgedIds]);
      const done = rows.length <= input.limit;
      if (done) await tx.none(`DELETE FROM ${this.#t.timelines} WHERE "pageId" = $1`, [input.timelineId]);
      return { purgedIds, done };
    });
  }
}

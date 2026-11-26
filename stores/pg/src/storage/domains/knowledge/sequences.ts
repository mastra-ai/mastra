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

import type { DbClient, TxClient } from '../../client';
import { escapeLike, Params, PG_KNOWLEDGE_PAGES_TABLES, ReadFilter } from './pages';

type Queryable = Pick<TxClient, 'none' | 'oneOrNone' | 'any' | 'query'>;

export const PG_KNOWLEDGE_SEQUENCE_TABLES = {
  sequences: 'mastra_knowledge_sequences',
  items: 'mastra_knowledge_sequence_items',
} as const;

const qualify = (schemaName: string | undefined, table: string) =>
  schemaName ? `"${schemaName}"."${table}"` : `"${table}"`;

function tables(schemaName?: string) {
  return {
    sequences: qualify(schemaName, PG_KNOWLEDGE_SEQUENCE_TABLES.sequences),
    items: qualify(schemaName, PG_KNOWLEDGE_SEQUENCE_TABLES.items),
    pages: qualify(schemaName, PG_KNOWLEDGE_PAGES_TABLES.pages),
  };
}

/**
 * The sequence tables in `schemaName`, next to the page tables. Items carry no scope column: a
 * read goes through the sequence page, so moving or deleting the page reaches every item without
 * rewriting one. `occurredAt` is epoch milliseconds so the `(occurredAt, id)` cursor compares
 * exactly; IDs compare byte for byte under the `C` collation, matching the cursor's order.
 */
export function pgKnowledgeSequencesDDL(schemaName?: string): string[] {
  const t = tables(schemaName);
  return [
    `CREATE TABLE IF NOT EXISTS ${t.sequences} (
      "pageId" text PRIMARY KEY,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS ${t.items} (
      "id" text COLLATE "C" PRIMARY KEY,
      "sequenceId" text NOT NULL REFERENCES ${t.sequences} ("pageId"),
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
      UNIQUE ("sequenceId", "externalId")
    )`,
    `CREATE INDEX IF NOT EXISTS mastra_knowledge_sequence_items_order ON ${t.items} ("sequenceId", "occurredAt", "id")`,
    `CREATE INDEX IF NOT EXISTS mastra_knowledge_sequence_items_thread ON ${t.items} ("sequenceId", "threadExternalId", "occurredAt", "id") WHERE "threadExternalId" IS NOT NULL`,
  ];
}

/** Loaded when first needed, so this adapter keeps loading on cores without `knowledge-sequences`. */
let core: Promise<typeof import('@mastra/core/storage')> | undefined;
const loadCore = () => (core ??= import('@mastra/core/storage'));

type Row = Record<string, any>;
const date = (value: unknown) => (value === null || value === undefined ? null : new Date(value as string | Date));

const toItem = (row: Row): KnowledgeSequenceItemRecord => ({
  id: row.id,
  sequenceId: row.sequenceId,
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
 * Sequences on PostgreSQL, on the same client and schema as the pages: on a transaction view the
 * view's transaction (each write a savepoint in it). Writers on one sequence serialize on its
 * sequence row (`FOR UPDATE`), which also keeps a purge from racing an upsert.
 */
export class PgKnowledgeSequences implements KnowledgeSequencesStorage {
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
        `mastra-knowledge-sequences-schema:${this.#schemaName ?? ''}`,
      ]);
      for (const statement of pgKnowledgeSequencesDDL(this.#schemaName)) await tx.query(statement);
    });
  }

  /** For the store's reset: drop the sequence tables, if they were ever created. */
  async dropOnReset(): Promise<void> {
    await this.#client.query(`DROP TABLE IF EXISTS ${this.#t.items}, ${this.#t.sequences}`);
  }

  async clearAll(): Promise<void> {
    await this.#client.query(`TRUNCATE ${this.#t.items}, ${this.#t.sequences}`);
  }

  /** Locks the sequence row, refusing when it isn't a live sequence. */
  async #lockLive(tx: Queryable, sequenceId: string): Promise<void> {
    const row = await tx.oneOrNone(
      `SELECT 1 FROM ${this.#t.sequences} t JOIN ${this.#t.pages} p ON p."id" = t."pageId" WHERE t."pageId" = $1 AND p."deletedAt" IS NULL FOR UPDATE OF t`,
      [sequenceId],
    );
    if (!row) throw new (await loadCore()).KnowledgeSequenceNotFoundError(sequenceId);
  }

  async #item(tx: Queryable, sequenceId: string, externalId: string): Promise<KnowledgeSequenceItemRecord | undefined> {
    const row = await tx.oneOrNone(`SELECT * FROM ${this.#t.items} WHERE "sequenceId" = $1 AND "externalId" = $2`, [
      sequenceId,
      externalId,
    ]);
    return row ? toItem(row) : undefined;
  }

  async markSequence({ pageId }: { pageId: string }): Promise<{ status: 'created' | 'unchanged' }> {
    const { KnowledgeNotFoundError, KnowledgeSequenceNotLeafError } = await loadCore();
    return this.#client.tx(async tx => {
      const page = await tx.oneOrNone(`SELECT "deletedAt" FROM ${this.#t.pages} WHERE "id" = $1 FOR UPDATE`, [pageId]);
      if (!page || page.deletedAt) throw new KnowledgeNotFoundError('page', pageId);
      // The page-row lock above is what makes select-then-insert safe: a second markSequence waits on it.
      const marked = await tx.oneOrNone(`SELECT 1 FROM ${this.#t.sequences} WHERE "pageId" = $1`, [pageId]);
      if (marked) return { status: 'unchanged' as const };
      // Known window: createPage doesn't lock the parent row, so a child created after this check
      // commits alongside the mark. That leaves a sequence with children; reads are unaffected.
      const child = await tx.oneOrNone(
        `SELECT 1 FROM ${this.#t.pages} WHERE "parentId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
        [pageId],
      );
      if (child) throw new KnowledgeSequenceNotLeafError(pageId);
      await tx.none(`INSERT INTO ${this.#t.sequences} ("pageId") VALUES ($1)`, [pageId]);
      return { status: 'created' as const };
    });
  }

  async listSequenceIds({ pageIds }: { pageIds: string[] }): Promise<string[]> {
    if (pageIds.length === 0) return [];
    const rows = await this.#client.any(`SELECT "pageId" FROM ${this.#t.sequences} WHERE "pageId" = ANY($1::text[])`, [
      pageIds,
    ]);
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
    return this.#client.tx(async tx => {
      await this.#lockLive(tx, input.sequenceId);
      const stored = await this.#item(tx, input.sequenceId, input.externalId);
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
          `INSERT INTO ${this.#t.items} ("occurredAt", "editedAt", "authorSourceId", "authorName", "threadExternalId", "body", "writtenBy", "id", "sequenceId", "externalId", "writtenAt", "version")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), 1)`,
          [...fields, createKnowledgeUlid(), input.sequenceId, input.externalId],
        );
        return { status: 'created' as const, item: (await this.#item(tx, input.sequenceId, input.externalId))! };
      }
      if (stored.deletedAt && !input.restore) {
        return { status: 'ignored' as const, reason: 'deleted' as const, item: stored };
      }
      if (!stored.deletedAt) {
        if (sameKnowledgeSequenceItem(stored, input)) return { status: 'unchanged' as const, item: stored };
        if (isStaleKnowledgeSequenceEdit(stored, input)) {
          return { status: 'ignored' as const, reason: 'stale' as const, item: stored };
        }
      }
      await tx.none(
        `UPDATE ${this.#t.items} SET "occurredAt" = $1, "editedAt" = $2, "authorSourceId" = $3, "authorName" = $4, "threadExternalId" = $5, "body" = $6, "writtenBy" = $7, "deletedAt" = NULL, "version" = "version" + 1 WHERE "id" = $8`,
        [...fields, stored.id],
      );
      return { status: 'updated' as const, item: (await this.#item(tx, input.sequenceId, input.externalId))! };
    });
  }

  async removeItem(input: {
    sequenceId: string;
    externalId: string;
    writtenBy: string;
    deletedAt?: Date;
  }): Promise<KnowledgeSequenceItemRemoveResult> {
    return this.#client.tx(async tx => {
      await this.#lockLive(tx, input.sequenceId);
      const stored = await this.#item(tx, input.sequenceId, input.externalId);
      if (!stored) return { status: 'missing' as const };
      if (stored.deletedAt) return { status: 'unchanged' as const, item: stored };
      await tx.none(
        `UPDATE ${this.#t.items} SET "body" = '', "deletedAt" = $1, "writtenBy" = $2, "version" = "version" + 1 WHERE "id" = $3`,
        [input.deletedAt ?? new Date(), input.writtenBy, stored.id],
      );
      return { status: 'removed' as const, item: (await this.#item(tx, input.sequenceId, input.externalId))! };
    });
  }

  async getItem(input: {
    sequenceId: string;
    id: string;
    read: KnowledgeReadScope;
  }): Promise<KnowledgeSequenceItemRecord | null> {
    const row = await this.#client.oneOrNone(
      `SELECT e.* FROM ${this.#t.items} e JOIN ${this.#t.sequences} t ON t."pageId" = e."sequenceId" WHERE e."sequenceId" = $1 AND e."id" = $2`,
      [input.sequenceId, input.id],
    );
    if (!row || !(await this.#readable(input.sequenceId, input.read))) return null;
    return toItem(row);
  }

  async listItems(input: ListKnowledgeSequenceItemsInput): Promise<KnowledgeSequenceItemsPage> {
    const { checkKnowledgeSequenceReadLimit, decodeKnowledgeSequenceCursor, encodeKnowledgeSequenceCursor } =
      await loadCore();
    checkKnowledgeSequenceReadLimit(input.limit);
    const after = input.cursor ? decodeKnowledgeSequenceCursor(input.cursor) : undefined;
    const marked = await this.#client.oneOrNone(`SELECT 1 FROM ${this.#t.sequences} WHERE "pageId" = $1`, [
      input.sequenceId,
    ]);
    if (!marked || !(await this.#readable(input.sequenceId, input.read))) return { items: [], nextCursor: null };
    const desc = (input.order ?? 'desc') === 'desc';
    const args: unknown[] = [input.sequenceId];
    const arg = (value: unknown) => `$${args.push(value)}`;
    const where = [`"sequenceId" = $1`];
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
      `SELECT * FROM ${this.#t.items} WHERE ${where.join(' AND ')} ORDER BY "occurredAt" ${dir}, "id" ${dir} LIMIT ${arg(input.limit + 1)}`,
      args,
    );
    const items = rows.slice(0, input.limit).map(toItem);
    const last = items[items.length - 1];
    return { items, nextCursor: rows.length > input.limit && last ? encodeKnowledgeSequenceCursor(last) : null };
  }

  async searchItems(input: SearchKnowledgeSequenceItemsInput): Promise<KnowledgeSequenceItemRecord[]> {
    const { checkKnowledgeSequenceReadLimit } = await loadCore();
    checkKnowledgeSequenceReadLimit(input.limit);
    const words = knowledgeSearchWords(input.query);
    if (!words.length) return [];
    const params = new Params();
    // Visibility is filtered in the query, before the limit, so unreadable hits never crowd out readable ones.
    const filter = new ReadFilter(input.read, params, this.#t.pages);
    const patterns = words.map(word => params.add(`%${escapeLike(word)}%`));
    const where = [
      `e."deletedAt" IS NULL`,
      `p."deletedAt" IS NULL`,
      filter.readable('s'),
      `(${patterns.map(pattern => `e."body" ILIKE ${pattern}`).join(' OR ')})`,
    ];
    if (input.sequenceIds) where.push(`e."sequenceId" = ANY(${params.add(input.sequenceIds)}::text[])`);
    if (input.scopeIds) where.push(`p."scopeId" = ANY(${params.add(input.scopeIds)}::text[])`);
    if (input.since) where.push(`e."occurredAt" >= ${params.add(input.since.getTime())}`);
    if (input.until) where.push(`e."occurredAt" < ${params.add(input.until.getTime())}`);
    const matched = patterns.map(pattern => `(CASE WHEN e."body" ILIKE ${pattern} THEN 1 ELSE 0 END)`).join(' + ');
    const rows = await this.#client.any(
      `SELECT e.* FROM ${this.#t.items} e JOIN ${this.#t.sequences} t ON t."pageId" = e."sequenceId" JOIN ${this.#t.pages} p ON p."id" = e."sequenceId" JOIN ${this.#t.pages} s ON s."id" = p."scopeId" WHERE ${where.join(' AND ')} ORDER BY (${matched}) DESC, e."occurredAt" DESC, e."id" ASC LIMIT ${params.add(input.limit)}`,
      params.values,
    );
    return rows.map(toItem);
  }

  async purgeItems(input: {
    sequenceId: string;
    deletedBefore: Date;
    limit: number;
  }): Promise<KnowledgeSequencePurgeResult> {
    const { KnowledgeSequencePurgeRefusedError } = await loadCore();
    return this.#client.tx(async tx => {
      const page = await tx.oneOrNone(`SELECT "deletedAt" FROM ${this.#t.pages} WHERE "id" = $1`, [input.sequenceId]);
      if (page && !(page.deletedAt && new Date(page.deletedAt).getTime() < input.deletedBefore.getTime())) {
        throw new KnowledgeSequencePurgeRefusedError(input.sequenceId);
      }
      await tx.query(`SELECT 1 FROM ${this.#t.sequences} WHERE "pageId" = $1 FOR UPDATE`, [input.sequenceId]);
      const rows = await tx.any(`SELECT "id" FROM ${this.#t.items} WHERE "sequenceId" = $1 ORDER BY "id" LIMIT $2`, [
        input.sequenceId,
        input.limit + 1,
      ]);
      const purgedIds = rows.slice(0, input.limit).map(row => String(row.id));
      if (purgedIds.length > 0) await tx.none(`DELETE FROM ${this.#t.items} WHERE "id" = ANY($1::text[])`, [purgedIds]);
      const done = rows.length <= input.limit;
      if (done) await tx.none(`DELETE FROM ${this.#t.sequences} WHERE "pageId" = $1`, [input.sequenceId]);
      return { purgedIds, done };
    });
  }
}

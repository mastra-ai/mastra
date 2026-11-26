import { knowledgeSearchWords } from '@internal/core/knowledge-compat';
import type {
  KnowledgeReadScope,
  KnowledgeSequenceItemsPage,
  KnowledgeSequenceItemRecord,
  KnowledgeSequenceItemRemoveResult,
  KnowledgeSequenceItemUpsertResult,
  KnowledgeSequenceOrderBy,
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
 * `searchText` is the lowercased text search matches (`knowledgeSequenceItemSearchText`).
 */
export function pgKnowledgeSequencesDDL(schemaName?: string): string[] {
  const t = tables(schemaName);
  return [
    `CREATE TABLE IF NOT EXISTS ${t.sequences} (
      "pageId" text PRIMARY KEY,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "orderBy" text NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ${t.items} (
      "id" text COLLATE "C" PRIMARY KEY,
      "sequenceId" text NOT NULL REFERENCES ${t.sequences} ("pageId"),
      "externalId" text COLLATE "C" NOT NULL,
      "occurredAt" bigint,
      "position" text COLLATE "C",
      "writtenAt" timestamptz NOT NULL,
      "editedAt" timestamptz,
      "deletedAt" timestamptz,
      "authorSourceId" text,
      "authorName" text,
      "externalParentId" text COLLATE "C",
      "type" text COLLATE "C",
      "title" text,
      "body" text,
      "links" jsonb,
      "properties" jsonb,
      "searchText" text NOT NULL,
      "version" integer NOT NULL,
      "writtenBy" text NOT NULL,
      UNIQUE ("sequenceId", "externalId")
    )`,
    `CREATE INDEX IF NOT EXISTS mastra_knowledge_sequence_items_order ON ${t.items} ("sequenceId", "occurredAt", "id")`,
    `CREATE INDEX IF NOT EXISTS mastra_knowledge_sequence_items_position ON ${t.items} ("sequenceId", "position", "id") WHERE "position" IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS mastra_knowledge_sequence_items_parent ON ${t.items} ("sequenceId", "externalParentId", "occurredAt", "id") WHERE "externalParentId" IS NOT NULL`,
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
  occurredAt: row.occurredAt === null ? null : new Date(Number(row.occurredAt)),
  position: row.position ?? null,
  writtenAt: new Date(row.writtenAt),
  editedAt: date(row.editedAt),
  deletedAt: date(row.deletedAt),
  author:
    row.authorSourceId === null
      ? null
      : { sourceId: row.authorSourceId, ...(row.authorName === null ? {} : { name: row.authorName }) },
  externalParentId: row.externalParentId ?? null,
  type: row.type ?? null,
  title: row.title ?? null,
  body: row.body ?? null,
  links: row.links ?? [],
  properties: row.properties ?? null,
  version: Number(row.version),
  writtenBy: row.writtenBy,
});

/** The `types`/`untyped` filter as a predicate on `type`; `arg` binds a value and returns its placeholder. */
function typeSql(alias: string, filter: { types: string[]; untyped: boolean }, arg: (value: unknown) => string) {
  const terms: string[] = [];
  if (filter.types.length > 0) terms.push(`${alias}"type" = ANY(${arg(filter.types)}::text[])`);
  if (filter.untyped) terms.push(`${alias}"type" IS NULL`);
  return `(${terms.join(' OR ')})`;
}

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

  /** Locks the sequence row, refusing when it isn't a live sequence; returns its order mode. */
  async #lockLive(tx: Queryable, sequenceId: string): Promise<KnowledgeSequenceOrderBy> {
    const row = await tx.oneOrNone(
      `SELECT t."orderBy" FROM ${this.#t.sequences} t JOIN ${this.#t.pages} p ON p."id" = t."pageId" WHERE t."pageId" = $1 AND p."deletedAt" IS NULL FOR UPDATE OF t`,
      [sequenceId],
    );
    if (!row) throw new (await loadCore()).KnowledgeSequenceNotFoundError(sequenceId);
    return row.orderBy;
  }

  /** The key `input` places its item at; reads its neighbours under the sequence row lock. */
  async #position(tx: Queryable, input: UpsertKnowledgeSequenceItemInput, stored?: KnowledgeSequenceItemRecord) {
    const { knowledgeSequenceItemPosition } = await loadCore();
    const others = `"sequenceId" = $1 AND "externalId" <> $2 AND "position" IS NOT NULL`;
    return knowledgeSequenceItemPosition(input, stored, {
      neighbour: async (externalId, side) => {
        const anchor = await tx.oneOrNone(
          `SELECT "position", "id" FROM ${this.#t.items} WHERE ${others} AND "externalId" = $3`,
          [input.sequenceId, input.externalId, externalId],
        );
        if (!anchor) return null;
        const [op, dir] = side === 'after' ? ['>', 'ASC'] : ['<', 'DESC'];
        const next = await tx.oneOrNone(
          `SELECT "position" FROM ${this.#t.items} WHERE ${others} AND ("position", "id") ${op} ($3, $4) ORDER BY "position" ${dir}, "id" ${dir} LIMIT 1`,
          [input.sequenceId, input.externalId, anchor.position, anchor.id],
        );
        return { position: anchor.position, next: next?.position ?? null };
      },
      last: async () =>
        (
          await tx.oneOrNone(`SELECT MAX("position") AS "position" FROM ${this.#t.items} WHERE ${others}`, [
            input.sequenceId,
            input.externalId,
          ])
        )?.position ?? null,
      taken: async position =>
        !!(await tx.oneOrNone(`SELECT 1 FROM ${this.#t.items} WHERE ${others} AND "position" = $3 LIMIT 1`, [
          input.sequenceId,
          input.externalId,
          position,
        ])),
    });
  }

  async #item(tx: Queryable, sequenceId: string, externalId: string): Promise<KnowledgeSequenceItemRecord | undefined> {
    const row = await tx.oneOrNone(`SELECT * FROM ${this.#t.items} WHERE "sequenceId" = $1 AND "externalId" = $2`, [
      sequenceId,
      externalId,
    ]);
    return row ? toItem(row) : undefined;
  }

  /** Refuses a parent that isn't an item of this sequence, is itself under one, or an item with items under it. */
  async #checkParent(tx: Queryable, sequenceId: string, externalId: string, externalParentId: string | null) {
    if (!externalParentId) return;
    const { KnowledgeSequenceParentNestedError, KnowledgeSequenceParentNotFoundError } = await loadCore();
    const parent = await this.#item(tx, sequenceId, externalParentId);
    if (!parent) throw new KnowledgeSequenceParentNotFoundError(sequenceId, externalParentId);
    const under = await tx.oneOrNone(
      `SELECT 1 FROM ${this.#t.items} WHERE "sequenceId" = $1 AND "externalParentId" = $2 LIMIT 1`,
      [sequenceId, externalId],
    );
    if (parent.externalParentId || under) throw new KnowledgeSequenceParentNestedError(sequenceId, externalId);
  }

  async markSequence({
    pageId,
    orderBy = 'timeline',
  }: {
    pageId: string;
    orderBy?: KnowledgeSequenceOrderBy;
  }): Promise<{ status: 'created' | 'unchanged' }> {
    const { KnowledgeNotFoundError, KnowledgeSequenceNotLeafError, KnowledgeSequenceOrderByChangeError } =
      await loadCore();
    return this.#client.tx(async tx => {
      const page = await tx.oneOrNone(`SELECT "deletedAt" FROM ${this.#t.pages} WHERE "id" = $1 FOR UPDATE`, [pageId]);
      if (!page || page.deletedAt) throw new KnowledgeNotFoundError('page', pageId);
      // The page-row lock above is what makes select-then-insert safe: a second markSequence waits on it.
      const marked = await tx.oneOrNone(`SELECT "orderBy" FROM ${this.#t.sequences} WHERE "pageId" = $1`, [pageId]);
      if (marked) {
        if (marked.orderBy !== orderBy) throw new KnowledgeSequenceOrderByChangeError(pageId, marked.orderBy);
        return { status: 'unchanged' as const };
      }
      // Known window: createPage doesn't lock the parent row, so a child created after this check
      // commits alongside the mark. That leaves a sequence with children; reads are unaffected.
      const child = await tx.oneOrNone(
        `SELECT 1 FROM ${this.#t.pages} WHERE "parentId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
        [pageId],
      );
      if (child) throw new KnowledgeSequenceNotLeafError(pageId);
      await tx.none(`INSERT INTO ${this.#t.sequences} ("pageId", "orderBy") VALUES ($1, $2)`, [pageId, orderBy]);
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
      knowledgeSequenceItemContent,
      knowledgeSequenceItemSearchText,
      sameKnowledgeSequenceItem,
    } = await loadCore();
    return this.#client.tx(async tx => {
      const orderBy = await this.#lockLive(tx, input.sequenceId);
      checkKnowledgeSequenceItemInput(input, orderBy);
      const stored = await this.#item(tx, input.sequenceId, input.externalId);
      const position = orderBy === 'position' ? await this.#position(tx, input, stored) : null;
      const content = knowledgeSequenceItemContent(input);
      const fields = [
        input.occurredAt ? input.occurredAt.getTime() : null,
        input.editedAt ?? null,
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
        position,
      ];
      if (!stored) {
        await this.#checkParent(tx, input.sequenceId, input.externalId, content.externalParentId);
        await tx.none(
          `INSERT INTO ${this.#t.items} ("occurredAt", "editedAt", "authorSourceId", "authorName", "externalParentId", "type", "title", "body", "links", "properties", "searchText", "writtenBy", "position", "id", "sequenceId", "externalId", "writtenAt", "version")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16, now(), 1)`,
          [...fields, createKnowledgeUlid(), input.sequenceId, input.externalId],
        );
        return { status: 'created' as const, item: (await this.#item(tx, input.sequenceId, input.externalId))! };
      }
      if (stored.deletedAt && !input.restore) {
        return { status: 'ignored' as const, reason: 'deleted' as const, item: stored };
      }
      if (!stored.deletedAt) {
        if (sameKnowledgeSequenceItem(stored, input, position)) return { status: 'unchanged' as const, item: stored };
        if (isStaleKnowledgeSequenceEdit(stored, input)) {
          return { status: 'ignored' as const, reason: 'stale' as const, item: stored };
        }
      }
      await this.#checkParent(tx, input.sequenceId, input.externalId, content.externalParentId);
      await tx.none(
        `UPDATE ${this.#t.items} SET "occurredAt" = $1, "editedAt" = $2, "authorSourceId" = $3, "authorName" = $4, "externalParentId" = $5, "type" = $6, "title" = $7, "body" = $8, "links" = $9::jsonb, "properties" = $10::jsonb, "searchText" = $11, "writtenBy" = $12, "position" = $13, "deletedAt" = NULL, "version" = "version" + 1 WHERE "id" = $14`,
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
        `UPDATE ${this.#t.items} SET "title" = NULL, "body" = NULL, "links" = NULL, "properties" = NULL, "searchText" = '', "deletedAt" = $1, "writtenBy" = $2, "version" = "version" + 1 WHERE "id" = $3`,
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
    const {
      checkKnowledgeSequenceReadLimit,
      decodeKnowledgeSequenceCursor,
      encodeKnowledgeSequenceCursor,
      knowledgeSequenceTypeFilter,
    } = await loadCore();
    checkKnowledgeSequenceReadLimit(input.limit);
    const typeFilter = knowledgeSequenceTypeFilter(input);
    const marked = await this.#client.oneOrNone(`SELECT "orderBy" FROM ${this.#t.sequences} WHERE "pageId" = $1`, [
      input.sequenceId,
    ]);
    const orderBy: KnowledgeSequenceOrderBy = marked?.orderBy ?? 'timeline';
    const after = input.cursor ? decodeKnowledgeSequenceCursor(input.cursor, orderBy) : undefined;
    if (!marked || !(await this.#readable(input.sequenceId, input.read))) return { items: [], nextCursor: null };
    const key = orderBy === 'position' ? '"position"' : '"occurredAt"';
    const desc = (input.order ?? (orderBy === 'position' ? 'asc' : 'desc')) === 'desc';
    const args: unknown[] = [input.sequenceId];
    const arg = (value: unknown) => `$${args.push(value)}`;
    const where = [`"sequenceId" = $1`];
    if (!input.includeDeleted) where.push(`"deletedAt" IS NULL`);
    if (input.since) where.push(`"occurredAt" >= ${arg(input.since.getTime())}`);
    if (input.until) where.push(`"occurredAt" < ${arg(input.until.getTime())}`);
    if (input.externalParentId !== undefined) {
      const parent = arg(input.externalParentId);
      where.push(`("externalId" = ${parent} OR "externalParentId" = ${parent})`);
    }
    if (typeFilter) where.push(typeSql('', typeFilter, arg));
    if (after) {
      const value = after.orderBy === 'position' ? after.position : after.occurredAt;
      where.push(`(${key}, "id") ${desc ? '<' : '>'} (${arg(value)}, ${arg(after.id)})`);
    }
    const dir = desc ? 'DESC' : 'ASC';
    const rows = await this.#client.any(
      `SELECT * FROM ${this.#t.items} WHERE ${where.join(' AND ')} ORDER BY ${key} ${dir}, "id" ${dir} LIMIT ${arg(input.limit + 1)}`,
      args,
    );
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
    const params = new Params();
    // Visibility is filtered in the query, before the limit, so unreadable hits never crowd out readable ones.
    const filter = new ReadFilter(input.read, params, this.#t.pages);
    const patterns = words.map(word => params.add(`%${escapeLike(word)}%`));
    const where = [
      `e."deletedAt" IS NULL`,
      `p."deletedAt" IS NULL`,
      filter.readable('s'),
      `(${patterns.map(pattern => `e."searchText" LIKE ${pattern}`).join(' OR ')})`,
    ];
    if (input.sequenceIds) where.push(`e."sequenceId" = ANY(${params.add(input.sequenceIds)}::text[])`);
    if (input.scopeIds) where.push(`p."scopeId" = ANY(${params.add(input.scopeIds)}::text[])`);
    if (input.since) where.push(`e."occurredAt" >= ${params.add(input.since.getTime())}`);
    if (input.until) where.push(`e."occurredAt" < ${params.add(input.until.getTime())}`);
    if (typeFilter) where.push(typeSql('e.', typeFilter, value => params.add(value)));
    const matched = patterns.map(pattern => `(CASE WHEN e."searchText" LIKE ${pattern} THEN 1 ELSE 0 END)`).join(' + ');
    const rows = await this.#client.any(
      `SELECT e.* FROM ${this.#t.items} e JOIN ${this.#t.sequences} t ON t."pageId" = e."sequenceId" JOIN ${this.#t.pages} p ON p."id" = e."sequenceId" JOIN ${this.#t.pages} s ON s."id" = p."scopeId" WHERE ${where.join(' AND ')} ORDER BY (${matched}) DESC, e."occurredAt" DESC NULLS LAST, e."position" ASC NULLS LAST, e."id" ASC LIMIT ${params.add(input.limit)}`,
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

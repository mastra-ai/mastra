import {
  createKnowledgePagesCoreLoader,
  knowledgePageKeyProblem,
  knowledgeSearchWords,
} from '@internal/core/knowledge-compat';
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

import type { DbClient, TxClient } from '../../client';

const loadPagesCore = createKnowledgePagesCoreLoader(coreFeatures, () => import('@mastra/core/storage'));

/** Core's bound checks, loaded lazily by the adapter so an old core fails with a clear message. */
export interface PgKnowledgePagesBounds {
  assertKnowledgePageDescriptionWithinBound(description: string | undefined): void;
  assertKnowledgeNoteTextWithinBound(text: string): void;
}

type Queryable = Pick<DbClient, 'query'> | Pick<TxClient, 'query'>;
type Row = Record<string, unknown>;

const DEFAULT_LIST_LIMIT = 50;
const PG_UNIQUE_VIOLATION = '23505';

export const PG_KNOWLEDGE_PAGES_TABLES = {
  pages: 'mastra_knowledge_pages',
  notes: 'mastra_knowledge_notes',
  stamps: 'mastra_knowledge_note_stamps',
  mentions: 'mastra_knowledge_mentions',
  pins: 'mastra_knowledge_pins',
  activity: 'mastra_knowledge_activity',
  state: 'mastra_knowledge_access_state',
} as const;

/**
 * Schema-4 DDL. `COLLATE "C"` on every column that is ordered, prefix-matched or compared for
 * equality makes Postgres compare bytes, not locale rules, so address prefixes are case-sensitive and
 * names/positions sort in binary order regardless of the database's default collation.
 */
export function pgKnowledgePagesDDL(schemaName?: string): string[] {
  const q = qualifier(schemaName);
  const t = PG_KNOWLEDGE_PAGES_TABLES;
  const index = (name: string, table: string, columns: string, where = '', unique = false) =>
    `CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${name}" ON ${q(table)} (${columns})${where ? ` WHERE ${where}` : ''}`;
  return [
    `CREATE TABLE IF NOT EXISTS ${q(t.pages)} (
      "id" text PRIMARY KEY,
      "scopeId" text NOT NULL,
      "parentId" text,
      "isScope" boolean NOT NULL,
      "address" text COLLATE "C",
      "declaration" text COLLATE "C",
      "key" text COLLATE "C",
      "position" text COLLATE "C" NOT NULL,
      "name" text COLLATE "C" NOT NULL,
      "canonicalName" text COLLATE "C" NOT NULL,
      "description" text,
      "body" text,
      "depth" integer NOT NULL,
      "version" integer NOT NULL,
      "mergedInto" text,
      "createdBy" jsonb NOT NULL,
      "updatedBy" jsonb NOT NULL,
      "createdAt" timestamptz NOT NULL,
      "updatedAt" timestamptz NOT NULL,
      "deletedAt" timestamptz,
      "deletedBy" text
    )`,
    `CREATE TABLE IF NOT EXISTS ${q(t.notes)} (
      "id" text PRIMARY KEY,
      "pageId" text NOT NULL REFERENCES ${q(t.pages)} ("id"),
      "text" text NOT NULL,
      "when" timestamptz,
      "provenance" jsonb NOT NULL,
      "version" integer NOT NULL,
      "createdAt" timestamptz NOT NULL,
      "updatedAt" timestamptz NOT NULL,
      "deletedAt" timestamptz,
      "deletedBy" text
    )`,
    `CREATE TABLE IF NOT EXISTS ${q(t.stamps)} (
      "noteId" text NOT NULL REFERENCES ${q(t.notes)} ("id"),
      "scopeId" text NOT NULL REFERENCES ${q(t.pages)} ("id"),
      PRIMARY KEY ("noteId", "scopeId")
    )`,
    `CREATE TABLE IF NOT EXISTS ${q(t.mentions)} (
      "noteId" text NOT NULL REFERENCES ${q(t.notes)} ("id"),
      "pageId" text NOT NULL REFERENCES ${q(t.pages)} ("id"),
      PRIMARY KEY ("noteId", "pageId")
    )`,
    `CREATE TABLE IF NOT EXISTS ${q(t.pins)} (
      "id" text PRIMARY KEY,
      "pageId" text NOT NULL UNIQUE REFERENCES ${q(t.pages)} ("id"),
      "audience" text[] NOT NULL,
      "createdBy" text NOT NULL,
      "createdAt" timestamptz NOT NULL,
      "updatedAt" timestamptz NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ${q(t.activity)} (
      "id" text PRIMARY KEY,
      "action" text NOT NULL,
      "scopeId" text NOT NULL,
      "pageId" text NOT NULL,
      "noteId" text,
      "provenance" jsonb NOT NULL,
      "createdAt" timestamptz NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ${q(t.state)} (
      "id" text PRIMARY KEY,
      "schemaVersion" integer NOT NULL
    )`,
    index('mastra_knowledge_pages_address_uq', t.pages, '"address"', '"isScope"', true),
    index(
      'mastra_knowledge_pages_parent_key_uq',
      t.pages,
      '"parentId","key"',
      '"key" IS NOT NULL AND "deletedAt" IS NULL',
      true,
    ),
    index('mastra_knowledge_pages_parent_idx', t.pages, '"parentId","position","id"'),
    index('mastra_knowledge_pages_scope_name_idx', t.pages, '"scopeId","name","id"', '"deletedAt" IS NULL'),
    index('mastra_knowledge_pages_name_idx', t.pages, '"name","id"', '"deletedAt" IS NULL AND NOT "isScope"'),
    index('mastra_knowledge_pages_canonical_idx', t.pages, '"canonicalName"', '"deletedAt" IS NULL'),
    index('mastra_knowledge_notes_page_idx', t.notes, '"pageId","createdAt","id"'),
    index('mastra_knowledge_stamps_scope_idx', t.stamps, '"scopeId"'),
    index('mastra_knowledge_mentions_page_idx', t.mentions, '"pageId"'),
    index('mastra_knowledge_pins_created_idx', t.pins, '"createdAt","id"'),
    index('mastra_knowledge_activity_page_idx', t.activity, '"pageId","createdAt","id"'),
    index('mastra_knowledge_activity_created_idx', t.activity, '"createdAt","id"'),
  ];
}

function qualifier(schemaName?: string) {
  return (table: string) => (schemaName ? `"${schemaName}"."${table}"` : `"${table}"`);
}

/** Collects bind parameters and hands back their `$n` placeholders. */
class Params {
  readonly values: unknown[] = [];
  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

/**
 * The read scope as bound arrays, registered once per query so the same `$n` is reused for every
 * check in it. A large frontier travels as a handful of array parameters (`= ANY($n::text[])`,
 * `unnest`), never as a long `IN (...)` list.
 */
class ReadFilter {
  readonly #all: boolean;
  readonly #addresses?: string;
  readonly #prefixes?: [string, string];
  readonly #children?: [string, string];

  constructor(read: KnowledgeReadScope, params: Params) {
    this.#all = read === 'all';
    if (read === 'all') return;
    if (read.addresses.length) this.#addresses = `${params.add(read.addresses)}::text[]`;
    if (read.prefixes.length) {
      this.#prefixes = [
        `${params.add(read.prefixes.map(entry => entry.declaration))}::text[]`,
        `${params.add(read.prefixes.map(entry => entry.prefix))}::text[]`,
      ];
    }
    if (read.children.length) {
      this.#children = [
        `${params.add(read.children.map(entry => entry.declaration))}::text[]`,
        `${params.add(read.children.map(entry => entry.parentId))}::text[]`,
      ];
    }
  }

  /** True when a scope page aliased `scope` is readable. Matching is binary and case-sensitive. */
  readable(scope: string): string {
    if (this.#all) return 'TRUE';
    const clauses: string[] = [];
    if (this.#addresses) clauses.push(`${scope}."address" = ANY(${this.#addresses})`);
    if (this.#prefixes) {
      clauses.push(
        `EXISTS (SELECT 1 FROM unnest(${this.#prefixes[0]}, ${this.#prefixes[1]}) AS pr("declaration", "prefix") WHERE ${scope}."declaration" = pr."declaration" AND starts_with(${scope}."address", pr."prefix"))`,
      );
    }
    if (this.#children) {
      clauses.push(
        `EXISTS (SELECT 1 FROM unnest(${this.#children[0]}, ${this.#children[1]}) AS ch("declaration", "parentId") WHERE ${scope}."declaration" = ch."declaration" AND ${scope}."parentId" = ch."parentId")`,
      );
    }
    return clauses.length ? `(${clauses.join(' OR ')})` : 'FALSE';
  }
}

function encodeCursor(parts: unknown[]): string {
  return Buffer.from(JSON.stringify(parts)).toString('base64url');
}

function decodeCursor(cursor: string, arity: number): string[] {
  try {
    const parts: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(parts) && parts.length === arity && parts.every(part => typeof part === 'string')) {
      return parts as string[];
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

function iso(value: Date): string {
  return value.toISOString();
}

function optionalDate(value: unknown): Date | undefined {
  return value == null ? undefined : new Date(value as string | Date);
}

function parseJson<T>(value: unknown): T {
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
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
    createdBy: parseJson<KnowledgeProvenance>(row.createdBy),
    updatedBy: parseJson<KnowledgeProvenance>(row.updatedBy),
    createdAt: new Date(row.createdAt as string | Date),
    updatedAt: new Date(row.updatedAt as string | Date),
    ...(row.deletedAt == null ? {} : { deletedAt: new Date(row.deletedAt as string | Date) }),
    ...(row.deletedBy == null ? {} : { deletedBy: String(row.deletedBy) }),
  };
}

function toNote(row: Row): KnowledgeNote {
  const when = optionalDate(row.when);
  const deletedAt = optionalDate(row.deletedAt);
  return {
    id: String(row.id),
    pageId: String(row.pageId),
    text: String(row.text),
    ...(when ? { when } : {}),
    stampScopeIds: (row.stampScopeIds as string[] | null) ?? [],
    mentions: (row.mentions as string[] | null) ?? [],
    provenance: parseJson<KnowledgeProvenance>(row.provenance),
    version: Number(row.version),
    createdAt: new Date(row.createdAt as string | Date),
    updatedAt: new Date(row.updatedAt as string | Date),
    ...(deletedAt ? { deletedAt } : {}),
    ...(row.deletedBy == null ? {} : { deletedBy: String(row.deletedBy) }),
  };
}

function toPin(row: Row): KnowledgePin {
  return {
    id: String(row.id),
    pageId: String(row.pageId),
    audience: (row.audience as string[]) ?? [],
    createdBy: String(row.createdBy),
    createdAt: new Date(row.createdAt as string | Date),
    updatedAt: new Date(row.updatedAt as string | Date),
  };
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, match => `\\${match}`);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === PG_UNIQUE_VIOLATION;
}

/**
 * Postgres implementation of the schema-4 {@link KnowledgePageStore}.
 *
 * Visibility is computed with live joins (a note's page home scope, its stamps, its mentioned pages'
 * current home scopes), so a move or merge, which rewrites `scopeId` on the moved pages in the same
 * transaction, can never leave a stale denormalized copy.
 */
export class PgKnowledgePages implements KnowledgePageStore {
  readonly #client: DbClient;
  readonly #schemaName?: string;
  readonly #bounds: () => Promise<PgKnowledgePagesBounds>;
  readonly #q: (table: string) => string;

  constructor(options: { client: DbClient; schemaName?: string; bounds: () => Promise<PgKnowledgePagesBounds> }) {
    this.#client = options.client;
    this.#schemaName = options.schemaName;
    this.#bounds = options.bounds;
    this.#q = qualifier(options.schemaName);
  }

  get #pages() {
    return this.#q(PG_KNOWLEDGE_PAGES_TABLES.pages);
  }
  get #notes() {
    return this.#q(PG_KNOWLEDGE_PAGES_TABLES.notes);
  }
  get #stamps() {
    return this.#q(PG_KNOWLEDGE_PAGES_TABLES.stamps);
  }
  get #mentions() {
    return this.#q(PG_KNOWLEDGE_PAGES_TABLES.mentions);
  }
  get #pins() {
    return this.#q(PG_KNOWLEDGE_PAGES_TABLES.pins);
  }
  get #activity() {
    return this.#q(PG_KNOWLEDGE_PAGES_TABLES.activity);
  }

  async #rows(db: Queryable, sql: string, params: unknown[] = []): Promise<Row[]> {
    const result = await db.query(sql, params);
    return result.rows as Row[];
  }

  #tx<T>(operation: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.#client.tx(operation);
  }

  /** The read-side `FROM` for notes: the note, its page, and the page's home scope. */
  #visibleNotes(filter: ReadFilter, alias = 'n'): string {
    return `${this.#notes} ${alias}
      JOIN ${this.#pages} np ON np."id" = ${alias}."pageId"
      JOIN ${this.#pages} nps ON nps."id" = np."scopeId"
      WHERE ${filter.readable('nps')}
        AND EXISTS (SELECT 1 FROM ${this.#stamps} st JOIN ${this.#pages} sts ON sts."id" = st."scopeId" WHERE st."noteId" = ${alias}."id" AND ${filter.readable('sts')})
        AND NOT EXISTS (SELECT 1 FROM ${this.#mentions} mn JOIN ${this.#pages} mp ON mp."id" = mn."pageId" JOIN ${this.#pages} mps ON mps."id" = mp."scopeId" WHERE mn."noteId" = ${alias}."id" AND NOT ${filter.readable('mps')})`;
  }

  /** Same note visibility as a bare predicate, for filters that start from another table. */
  #noteVisible(filter: ReadFilter, noteIdColumn: string): string {
    return `EXISTS (SELECT 1 FROM ${this.#notes} vn JOIN ${this.#pages} vp ON vp."id" = vn."pageId" JOIN ${this.#pages} vps ON vps."id" = vp."scopeId"
        WHERE vn."id" = ${noteIdColumn} AND ${filter.readable('vps')}
        AND EXISTS (SELECT 1 FROM ${this.#stamps} vst JOIN ${this.#pages} vsts ON vsts."id" = vst."scopeId" WHERE vst."noteId" = vn."id" AND ${filter.readable('vsts')})
        AND NOT EXISTS (SELECT 1 FROM ${this.#mentions} vmn JOIN ${this.#pages} vmp ON vmp."id" = vmn."pageId" JOIN ${this.#pages} vmps ON vmps."id" = vmp."scopeId" WHERE vmn."noteId" = vn."id" AND NOT ${filter.readable('vmps')}))`;
  }

  #noteColumns(alias = 'n'): string {
    return `${alias}.*,
      ARRAY(SELECT st."scopeId" FROM ${this.#stamps} st WHERE st."noteId" = ${alias}."id" ORDER BY st."scopeId") AS "stampScopeIds",
      ARRAY(SELECT mn."pageId" FROM ${this.#mentions} mn WHERE mn."noteId" = ${alias}."id" ORDER BY mn."pageId") AS "mentions"`;
  }

  async #logActivity(
    db: Queryable,
    event: {
      action: KnowledgePageActivityAction;
      scopeId: string;
      pageId: string;
      noteId?: string;
      provenance: KnowledgeProvenance;
      at: Date;
    },
  ): Promise<void> {
    await db.query(
      `INSERT INTO ${this.#activity} ("id","action","scopeId","pageId","noteId","provenance","createdAt") VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [
        createKnowledgeUlid(),
        event.action,
        event.scopeId,
        event.pageId,
        event.noteId ?? null,
        JSON.stringify(event.provenance),
        iso(event.at),
      ],
    );
  }

  async #lockPage(db: Queryable, id: string): Promise<KnowledgePage | null> {
    const rows = await this.#rows(db, `SELECT * FROM ${this.#pages} WHERE "id" = $1 FOR UPDATE`, [id]);
    return rows[0] ? toPage(rows[0]) : null;
  }

  async #requireLivePage(db: Queryable, id: string, lock = true): Promise<KnowledgePage> {
    const rows = await this.#rows(db, `SELECT * FROM ${this.#pages} WHERE "id" = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
    const page = rows[0] ? toPage(rows[0]) : null;
    if (!page || page.deletedAt) throw new KnowledgeNotFoundError('page', id);
    return page;
  }

  /** Position after the last live child of `parentId`. */
  async #lastPosition(db: Queryable, parentId: string | null): Promise<string | undefined> {
    const rows = await this.#rows(
      db,
      parentId === null
        ? `SELECT "position" FROM ${this.#pages} WHERE "parentId" IS NULL AND "deletedAt" IS NULL ORDER BY "position" DESC LIMIT 1`
        : `SELECT "position" FROM ${this.#pages} WHERE "parentId" = $1 AND "deletedAt" IS NULL ORDER BY "position" DESC LIMIT 1`,
      parentId === null ? [] : [parentId],
    );
    return rows[0] ? String(rows[0].position) : undefined;
  }

  /** Ordinary descendants of `rootId` (excluding it), as a recursive CTE named `sub`. */
  #subtree(rootParam: string): string {
    return `WITH RECURSIVE sub("id") AS (
      SELECT c."id" FROM ${this.#pages} c WHERE c."parentId" = ${rootParam} AND NOT c."isScope"
      UNION ALL
      SELECT c."id" FROM ${this.#pages} c JOIN sub ON c."parentId" = sub."id" WHERE NOT c."isScope"
    )`;
  }

  /** Live descendants, capped, and the deepest live level. */
  async #subtreeStats(db: Queryable, rootId: string): Promise<{ live: number; maxDepth: number }> {
    const core = await loadPagesCore();
    const rows = await this.#rows(
      db,
      `${this.#subtree('$1')}
       SELECT (SELECT count(*) FROM (SELECT 1 FROM sub JOIN ${this.#pages} p ON p."id" = sub."id" WHERE p."deletedAt" IS NULL LIMIT ${core.MAX_KNOWLEDGE_MOVE_PAGES + 1}) l) AS live,
              (SELECT COALESCE(max(p."depth"), 0) FROM sub JOIN ${this.#pages} p ON p."id" = sub."id" WHERE p."deletedAt" IS NULL) AS "maxDepth"`,
      [rootId],
    );
    return { live: Number(rows[0]?.live ?? 0), maxDepth: Number(rows[0]?.maxDepth ?? 0) };
  }

  /**
   * Refuses before any write when a live page arriving under `parentId` has a key a live child of
   * `parentId` already uses: the moved root itself, or, for a merge, the source's live children.
   */
  async #assertNoKeyConflicts(db: Queryable, arriving: { rootId?: string; childrenOf?: string }, parentId: string) {
    const core = await loadPagesCore();
    const arrivingWhere = arriving.rootId ? `c."id" = $1` : `c."parentId" = $1 AND NOT c."isScope"`;
    const rows = await this.#rows(
      db,
      `SELECT c."key" FROM ${this.#pages} c
       JOIN ${this.#pages} t ON t."parentId" = $2 AND t."key" = c."key" AND t."deletedAt" IS NULL AND t."id" <> c."id"
       WHERE ${arrivingWhere} AND c."key" IS NOT NULL AND c."deletedAt" IS NULL
       LIMIT 1`,
      [arriving.rootId ?? arriving.childrenOf, parentId],
    );
    if (rows[0]) throw new core.KnowledgePageKeyConflictError(String(rows[0].key), parentId);
  }

  async #isInSubtree(db: Queryable, rootId: string, candidateId: string): Promise<boolean> {
    const rows = await this.#rows(db, `${this.#subtree('$1')} SELECT 1 FROM sub WHERE "id" = $2 LIMIT 1`, [
      rootId,
      candidateId,
    ]);
    return rows.length > 0;
  }

  // Scopes ---------------------------------------------------------------------------------------

  async materializeScope(input: MaterializeKnowledgeScopeInput): Promise<MaterializeKnowledgeScopeResult> {
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

    return this.#tx(async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `mastra-knowledge-scope:${this.#schemaName ?? ''}:${input.address}`,
      ]);
      const now = new Date();
      const existing = await this.#scopeByAddress(tx, input.address);
      let scope = existing;
      let created = false;
      let parentConflict: MaterializeKnowledgeScopeResult['parentConflict'];

      if (!scope) {
        if (input.parentId) await this.#requireLivePage(tx, input.parentId, false);
        scope = await this.#insertScope(tx, {
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
        // Late link: the first non-null parent wins; the advisory lock above makes it atomic.
        await this.#requireLivePage(tx, input.parentId, false);
        const rows = await this.#rows(
          tx,
          `UPDATE ${this.#pages} SET "parentId" = $2 WHERE "id" = $1 AND "parentId" IS NULL RETURNING *`,
          [scope.id, input.parentId],
        );
        scope = toPage(rows[0]!);
      } else if (input.parentId !== undefined && (input.parentId ?? null) !== scope.parentId) {
        parentConflict = { existingParentId: scope.parentId, requestedParentId: input.parentId ?? null };
      }

      for (const child of input.children ?? []) {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `mastra-knowledge-scope:${this.#schemaName ?? ''}:${child.address}`,
        ]);
        if (await this.#scopeByAddress(tx, child.address)) continue;
        await this.#insertScope(tx, {
          address: child.address,
          declaration: child.declaration,
          name: child.name,
          description: child.description,
          parentId: scope.id,
          provenance: input.provenance,
          at: now,
        });
      }

      await this.#materializeTemplates(tx, scope, input.pages ?? [], input.provenance, now);

      return { scope, created, ...(parentConflict ? { parentConflict } : {}) };
    });
  }

  async #materializeTemplates(
    db: Queryable,
    parent: KnowledgePage,
    templates: KnowledgePageTemplateInput[],
    provenance: KnowledgeProvenance,
    at: Date,
  ): Promise<void> {
    const core = await loadPagesCore();
    for (const template of templates) {
      const problem = knowledgePageKeyProblem(template.key);
      if (problem) throw new Error(problem);
      const rows = await this.#rows(
        db,
        `SELECT * FROM ${this.#pages} WHERE "parentId" = $1 AND "key" = $2 AND "deletedAt" IS NULL`,
        [parent.id, template.key],
      );
      const page =
        rows[0] === undefined
          ? await this.#insertPage(db, {
              parent,
              key: template.key,
              name: template.name,
              description: template.description,
              provenance,
              at,
            })
          : toPage(rows[0]);
      if (template.pages?.length) await this.#materializeTemplates(db, page, template.pages, provenance, at);
    }
  }

  async #scopeByAddress(db: Queryable, address: string): Promise<KnowledgePage | null> {
    const rows = await this.#rows(db, `SELECT * FROM ${this.#pages} WHERE "isScope" AND "address" = $1`, [address]);
    return rows[0] ? toPage(rows[0]) : null;
  }

  async #insertScope(
    db: Queryable,
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
    const position = core.knowledgePositionBetween(await this.#lastPosition(db, input.parentId));
    const rows = await this.#rows(
      db,
      `INSERT INTO ${this.#pages} ("id","scopeId","parentId","isScope","address","declaration","position","name","canonicalName","description","depth","version","createdBy","updatedBy","createdAt","updatedAt")
       VALUES ($1,$1,$2,TRUE,$3,$4,$5,$6,$7,$8,0,1,$9::jsonb,$9::jsonb,$10,$10) RETURNING *`,
      [
        id,
        input.parentId,
        input.address,
        input.declaration,
        position,
        input.name,
        core.canonicalKnowledgeName(input.name),
        input.description ?? null,
        JSON.stringify(input.provenance),
        iso(input.at),
      ],
    );
    await this.#logActivity(db, {
      action: 'scope-created',
      scopeId: id,
      pageId: id,
      provenance: input.provenance,
      at: input.at,
    });
    return toPage(rows[0]!);
  }

  async getScopesByAddress(addresses: string[]): Promise<KnowledgePage[]> {
    if (addresses.length === 0) return [];
    const rows = await this.#rows(
      this.#client,
      `SELECT * FROM ${this.#pages} WHERE "isScope" AND "address" = ANY($1::text[])`,
      [addresses],
    );
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
    const params = new Params();
    const where = [`"isScope"`, `"deletedAt" IS NULL`];
    where.push(input.parentId === null ? `"parentId" IS NULL` : `"parentId" = ${params.add(input.parentId)}`);
    if (input.cursor) {
      const [position, id] = decodeCursor(input.cursor, 2);
      where.push(`("position", "id") > (${params.add(position)}, ${params.add(id)})`);
    }
    const rows = await this.#rows(
      this.#client,
      `SELECT * FROM ${this.#pages} WHERE ${where.join(' AND ')} ORDER BY "position", "id" LIMIT ${limit + 1}`,
      params.values,
    );
    return this.#pageOutput(rows, limit, page => [page.position, page.id]);
  }

  #pageOutput(rows: Row[], limit: number, cursorOf: (page: KnowledgePage) => string[]): KnowledgePageListOutput {
    const pages = rows.slice(0, limit).map(toPage);
    const last = pages[pages.length - 1];
    return { pages, ...(rows.length > limit && last ? { nextCursor: encodeCursor(cursorOf(last)) } : {}) };
  }

  // Pages ----------------------------------------------------------------------------------------

  async getPage(input: { id: string; read: KnowledgeReadScope }): Promise<KnowledgePage | null> {
    const params = new Params();
    const id = params.add(input.id);
    const filter = new ReadFilter(input.read, params);
    const rows = await this.#rows(
      this.#client,
      `SELECT p.* FROM ${this.#pages} p JOIN ${this.#pages} s ON s."id" = p."scopeId" WHERE p."id" = ${id} AND ${filter.readable('s')}`,
      params.values,
    );
    return rows[0] ? toPage(rows[0]) : null;
  }

  async getPageByPath(input: {
    scopeId: string;
    path: string[];
    read: KnowledgeReadScope;
  }): Promise<KnowledgePage | null> {
    if (!input.path.length) return null;
    let page: KnowledgePage | undefined;
    let parentId = input.scopeId;
    for (const key of input.path) {
      const params = new Params();
      const filter = new ReadFilter(input.read, params);
      const rows = await this.#rows(
        this.#client,
        `SELECT p.* FROM ${this.#pages} p JOIN ${this.#pages} s ON s."id" = p."scopeId"
         WHERE p."parentId" = ${params.add(parentId)} AND p."key" = ${params.add(key)} AND p."deletedAt" IS NULL AND NOT p."isScope" AND ${filter.readable('s')}`,
        params.values,
      );
      if (!rows[0]) return null;
      page = toPage(rows[0]);
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
    const params = new Params();
    const where = [
      `p."canonicalName" = ${params.add(core.canonicalKnowledgeName(input.name))}`,
      `p."deletedAt" IS NULL`,
    ];
    if (input.scopeId) where.push(`p."scopeId" = ${params.add(input.scopeId)}`);
    const filter = new ReadFilter(input.read, params);
    where.push(filter.readable('s'));
    const rows = await this.#rows(
      this.#client,
      `SELECT p.* FROM ${this.#pages} p JOIN ${this.#pages} s ON s."id" = p."scopeId"
       WHERE ${where.join(' AND ')} ORDER BY p."createdAt" DESC, p."id" DESC LIMIT ${limit}`,
      params.values,
    );
    return rows.map(toPage);
  }

  async listChildPages(input: {
    parentId: string;
    read: KnowledgeReadScope;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgePageListOutput> {
    const core = await loadPagesCore();
    const limit = clampLimit(input.limit, core.MAX_KNOWLEDGE_PAGE_LIST_LIMIT);
    const params = new Params();
    const where = [`p."parentId" = ${params.add(input.parentId)}`, `NOT p."isScope"`, `p."deletedAt" IS NULL`];
    const filter = new ReadFilter(input.read, params);
    where.push(filter.readable('s'));
    if (input.cursor) {
      const [position, id] = decodeCursor(input.cursor, 2);
      where.push(`(p."position", p."id") > (${params.add(position)}, ${params.add(id)})`);
    }
    const rows = await this.#rows(
      this.#client,
      `SELECT p.* FROM ${this.#pages} p JOIN ${this.#pages} s ON s."id" = p."scopeId"
       WHERE ${where.join(' AND ')} ORDER BY p."position", p."id" LIMIT ${limit + 1}`,
      params.values,
    );
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
    const params = new Params();
    const where = [`NOT p."isScope"`, `p."deletedAt" IS NULL`];
    if (input.scopeId) where.push(`p."scopeId" = ${params.add(input.scopeId)}`);
    if (input.namePrefix)
      where.push(`starts_with(p."canonicalName", ${params.add(core.canonicalKnowledgeName(input.namePrefix))})`);
    const filter = new ReadFilter(input.read, params);
    where.push(filter.readable('s'));
    if (input.cursor) {
      const [name, id] = decodeCursor(input.cursor, 2);
      where.push(`(p."name", p."id") > (${params.add(name)}, ${params.add(id)})`);
    }
    const rows = await this.#rows(
      this.#client,
      `SELECT p.* FROM ${this.#pages} p JOIN ${this.#pages} s ON s."id" = p."scopeId"
       WHERE ${where.join(' AND ')} ORDER BY p."name", p."id" LIMIT ${limit + 1}`,
      params.values,
    );
    return this.#pageOutput(rows, limit, page => [page.name, page.id]);
  }

  async createPage(input: CreateKnowledgePageInput): Promise<KnowledgePage> {
    const bounds = await this.#bounds();
    bounds.assertKnowledgePageDescriptionWithinBound(input.description);
    const core = await loadPagesCore();
    if (input.key !== undefined) {
      const problem = knowledgePageKeyProblem(input.key);
      if (problem) throw new Error(problem);
    }
    return this.#tx(async tx => {
      const parent = await this.#requireLivePage(tx, input.parentId);
      return this.#insertPage(tx, {
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
    db: Queryable,
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
    const depth = input.parent.isScope ? 1 : (await this.#depthOf(db, input.parent.id)) + 1;
    if (depth > core.MAX_KNOWLEDGE_PAGE_DEPTH) throw new core.KnowledgePageDepthError(id);
    const position = input.position ?? core.knowledgePositionBetween(await this.#lastPosition(db, input.parent.id));
    try {
      const rows = await this.#rows(
        db,
        `INSERT INTO ${this.#pages} ("id","scopeId","parentId","isScope","key","position","name","canonicalName","description","body","depth","version","createdBy","updatedBy","createdAt","updatedAt")
         VALUES ($1,$2,$3,FALSE,$4,$5,$6,$7,$8,$9,$10,1,$11::jsonb,$11::jsonb,$12,$12) RETURNING *`,
        [
          id,
          scopeId,
          input.parent.id,
          input.key ?? null,
          position,
          input.name,
          core.canonicalKnowledgeName(input.name),
          input.description ?? null,
          input.body ?? null,
          depth,
          JSON.stringify(input.provenance),
          iso(input.at),
        ],
      );
      await this.#logActivity(db, {
        action: 'page-created',
        scopeId,
        pageId: id,
        provenance: input.provenance,
        at: input.at,
      });
      return toPage(rows[0]!);
    } catch (error) {
      if (isUniqueViolation(error)) {
        if (input.key) throw new core.KnowledgePageKeyConflictError(input.key, input.parent.id);
        throw new KnowledgeConflictError(id);
      }
      throw error;
    }
  }

  async #depthOf(db: Queryable, id: string): Promise<number> {
    const rows = await this.#rows(db, `SELECT "depth" FROM ${this.#pages} WHERE "id" = $1`, [id]);
    return Number(rows[0]?.depth ?? 0);
  }

  async updatePage(input: UpdateKnowledgePageInput): Promise<KnowledgePage> {
    const core = await loadPagesCore();
    const bounds = await this.#bounds();
    bounds.assertKnowledgePageDescriptionWithinBound(input.description);
    return this.#tx(async tx => {
      const page = await this.#requireLivePage(tx, input.id);
      if (page.version !== input.expectedVersion) throw new KnowledgeConflictError(input.id);
      const now = new Date();
      const sets = [`"version" = "version" + 1`, `"updatedAt" = $2`, `"updatedBy" = $3::jsonb`];
      const params = new Params();
      params.add(input.id);
      params.add(iso(now));
      params.add(JSON.stringify(input.provenance));
      if (input.name !== undefined) {
        sets.push(
          `"name" = ${params.add(input.name)}`,
          `"canonicalName" = ${params.add(core.canonicalKnowledgeName(input.name))}`,
        );
      }
      if (input.description !== undefined)
        sets.push(`"description" = ${params.add(input.description === '' ? null : input.description)}`);
      if (input.body !== undefined) sets.push(`"body" = ${params.add(input.body)}`);
      const rows = await this.#rows(
        tx,
        `UPDATE ${this.#pages} SET ${sets.join(', ')} WHERE "id" = $1 RETURNING *`,
        params.values,
      );
      await this.#logActivity(tx, {
        action: 'page-updated',
        scopeId: page.scopeId,
        pageId: page.id,
        provenance: input.provenance,
        at: now,
      });
      return toPage(rows[0]!);
    });
  }

  async movePage(input: MoveKnowledgePageInput): Promise<KnowledgePage> {
    const core = await loadPagesCore();
    return this.#tx(async tx => {
      const page = await this.#requireLivePage(tx, input.id);
      if (page.version !== input.expectedVersion) throw new KnowledgeConflictError(input.id);
      if (page.isScope) throw new Error(`Knowledge scope page ${input.id} can't be moved`);
      if (input.parentId === input.id || (await this.#isInSubtree(tx, input.id, input.parentId))) {
        throw new Error(`Knowledge page ${input.id} can't move under itself or its own subtree`);
      }
      const parent = await this.#requireLivePage(tx, input.parentId);
      const stats = await this.#subtreeStats(tx, input.id);
      if (stats.live + 1 > core.MAX_KNOWLEDGE_MOVE_PAGES) {
        throw new core.KnowledgeMoveTooLargeError(input.id, stats.live + 1);
      }
      const newScopeId = parent.isScope ? parent.id : parent.scopeId;
      const newDepth = parent.isScope ? 1 : (await this.#depthOf(tx, parent.id)) + 1;
      const delta = newDepth - (await this.#depthOf(tx, page.id));
      await this.#assertNoKeyConflicts(tx, { rootId: input.id }, parent.id);
      if (stats.maxDepth + delta > core.MAX_KNOWLEDGE_PAGE_DEPTH || newDepth > core.MAX_KNOWLEDGE_PAGE_DEPTH) {
        throw new core.KnowledgePageDepthError(input.id);
      }
      const position = input.position ?? core.knowledgePositionBetween(await this.#lastPosition(tx, parent.id));
      const now = new Date();
      try {
        await tx.query(
          `${this.#subtree('$1')} UPDATE ${this.#pages} SET "scopeId" = $2, "depth" = "depth" + $3 WHERE "id" IN (SELECT "id" FROM sub)`,
          [input.id, newScopeId, delta],
        );
        const rows = await this.#rows(
          tx,
          `UPDATE ${this.#pages} SET "parentId" = $2, "scopeId" = $3, "depth" = $4, "position" = $5, "version" = "version" + 1, "updatedAt" = $6, "updatedBy" = $7::jsonb WHERE "id" = $1 RETURNING *`,
          [input.id, parent.id, newScopeId, newDepth, position, iso(now), JSON.stringify(input.provenance)],
        );
        await this.#logActivity(tx, {
          action: 'page-moved',
          scopeId: newScopeId,
          pageId: input.id,
          provenance: input.provenance,
          at: now,
        });
        return toPage(rows[0]!);
      } catch (error) {
        if (isUniqueViolation(error))
          throw new KnowledgeConflictError(page.key ? `${newScopeId}#${page.key}` : input.id);
        throw error;
      }
    });
  }

  async mergePages(input: MergeKnowledgePagesInput): Promise<KnowledgePage> {
    const core = await loadPagesCore();
    return this.#tx(async tx => {
      if (input.sourceId === input.targetId)
        throw new Error(`Knowledge page ${input.sourceId} can't merge into itself or its own subtree`);
      // Lock in id order so two opposing merges can't deadlock.
      const [firstId, secondId] = [input.sourceId, input.targetId].sort();
      await this.#lockPage(tx, firstId!);
      await this.#lockPage(tx, secondId!);
      const source = await this.#requireLivePage(tx, input.sourceId, false);
      const target = await this.#requireLivePage(tx, input.targetId, false);
      if (source.version !== input.sourceVersion) throw new KnowledgeConflictError(input.sourceId);
      if (source.isScope || target.isScope) throw new Error("Knowledge scope pages can't be merged");
      if (await this.#isInSubtree(tx, source.id, target.id)) {
        throw new Error(`Knowledge page ${source.id} can't merge into itself or its own subtree`);
      }
      const stats = await this.#subtreeStats(tx, source.id);
      if (stats.live > core.MAX_KNOWLEDGE_MOVE_PAGES) throw new core.KnowledgeMoveTooLargeError(source.id, stats.live);
      // Source's children become target's children, one level below the target.
      const delta = (await this.#depthOf(tx, target.id)) - (await this.#depthOf(tx, source.id));
      await this.#assertNoKeyConflicts(tx, { childrenOf: source.id }, target.id);
      if (stats.maxDepth > 0 && stats.maxDepth + delta > core.MAX_KNOWLEDGE_PAGE_DEPTH) {
        throw new core.KnowledgePageDepthError(source.id);
      }
      const now = new Date();
      try {
        await tx.query(
          `${this.#subtree('$1')} UPDATE ${this.#pages} SET "scopeId" = $2, "depth" = "depth" + $3 WHERE "id" IN (SELECT "id" FROM sub)`,
          [source.id, target.scopeId, delta],
        );
        await tx.query(`UPDATE ${this.#pages} SET "parentId" = $2 WHERE "parentId" = $1 AND NOT "isScope"`, [
          source.id,
          target.id,
        ]);
      } catch (error) {
        if (isUniqueViolation(error)) throw new KnowledgeConflictError(source.id);
        throw error;
      }
      await tx.query(`UPDATE ${this.#notes} SET "pageId" = $2 WHERE "pageId" = $1`, [source.id, target.id]);
      await tx.query(
        `DELETE FROM ${this.#mentions} m WHERE m."pageId" = $1 AND EXISTS (SELECT 1 FROM ${this.#mentions} t WHERE t."noteId" = m."noteId" AND t."pageId" = $2)`,
        [source.id, target.id],
      );
      await tx.query(`UPDATE ${this.#mentions} SET "pageId" = $2 WHERE "pageId" = $1`, [source.id, target.id]);

      const sourcePin = (
        await this.#rows(tx, `SELECT * FROM ${this.#pins} WHERE "pageId" = $1 FOR UPDATE`, [source.id])
      )[0];
      if (sourcePin) {
        await this.#upsertPinAudience(
          tx,
          target.id,
          (sourcePin.audience as string[]) ?? [],
          String(sourcePin.createdBy),
          now,
        );
        await tx.query(`DELETE FROM ${this.#pins} WHERE "id" = $1`, [String(sourcePin.id)]);
      }

      await tx.query(
        `UPDATE ${this.#pages} SET "deletedAt" = $2, "deletedBy" = $3, "mergedInto" = $4, "scopeId" = $6, "version" = "version" + 1, "updatedAt" = $2, "updatedBy" = $5::jsonb WHERE "id" = $1`,
        [source.id, iso(now), input.provenance.author, target.id, JSON.stringify(input.provenance), target.scopeId],
      );
      const rows = await this.#rows(tx, `SELECT * FROM ${this.#pages} WHERE "id" = $1`, [target.id]);
      await this.#logActivity(tx, {
        action: 'page-merged',
        scopeId: target.scopeId,
        pageId: source.id,
        provenance: input.provenance,
        at: now,
      });
      return toPage(rows[0]!);
    });
  }

  async deletePage(input: { id: string; expectedVersion: number; deletedBy: string }): Promise<KnowledgePage> {
    const core = await loadPagesCore();
    return this.#tx(async tx => {
      const page = await this.#requireLivePage(tx, input.id);
      if (page.version !== input.expectedVersion) throw new KnowledgeConflictError(input.id);
      if (page.isScope) throw new Error(`Knowledge scope page ${input.id} can't be deleted`);
      const children = await this.#rows(
        tx,
        `SELECT 1 FROM ${this.#pages} WHERE "parentId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
        [input.id],
      );
      if (children.length) throw new core.KnowledgePageHasChildrenError(input.id);
      const now = new Date();
      const rows = await this.#rows(
        tx,
        `UPDATE ${this.#pages} SET "deletedAt" = $2, "deletedBy" = $3, "version" = "version" + 1, "updatedAt" = $2, "updatedBy" = $4::jsonb WHERE "id" = $1 RETURNING *`,
        [input.id, iso(now), input.deletedBy, JSON.stringify({ author: input.deletedBy })],
      );
      await tx.query(`DELETE FROM ${this.#pins} WHERE "pageId" = $1`, [input.id]);
      await this.#logActivity(tx, {
        action: 'page-deleted',
        scopeId: page.scopeId,
        pageId: page.id,
        provenance: { author: input.deletedBy },
        at: now,
      });
      return toPage(rows[0]!);
    });
  }

  // Notes ----------------------------------------------------------------------------------------

  async getNote(input: {
    id: string;
    read: KnowledgeReadScope;
    includeDeleted?: boolean;
  }): Promise<KnowledgeNote | null> {
    const params = new Params();
    const id = params.add(input.id);
    const filter = new ReadFilter(input.read, params);
    const rows = await this.#rows(
      this.#client,
      `SELECT ${this.#noteColumns()} FROM ${this.#visibleNotes(filter)} AND n."id" = ${id}${input.includeDeleted ? '' : ' AND n."deletedAt" IS NULL'}`,
      params.values,
    );
    return rows[0] ? toNote(rows[0]) : null;
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
    const params = new Params();
    const filter = new ReadFilter(input.read, params);
    const extra = [`n."pageId" = ${params.add(input.pageId)}`];
    if (!input.includeDeleted) extra.push(`n."deletedAt" IS NULL`);
    if (input.cursor) {
      const [createdAt, id] = decodeCursor(input.cursor, 2);
      extra.push(`(n."createdAt", n."id") > (${params.add(createdAt)}::timestamptz, ${params.add(id)})`);
    }
    const rows = await this.#rows(
      this.#client,
      `SELECT ${this.#noteColumns()} FROM ${this.#visibleNotes(filter)} AND ${extra.join(' AND ')} ORDER BY n."createdAt", n."id" LIMIT ${limit + 1}`,
      params.values,
    );
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
    const params = new Params();
    const filter = new ReadFilter(input.read, params);
    const pageParam = params.add(input.pageId);
    const extra = [
      `n."deletedAt" IS NULL`,
      `n."pageId" <> ${pageParam}`,
      `np."deletedAt" IS NULL`,
      `EXISTS (SELECT 1 FROM ${this.#mentions} tm WHERE tm."noteId" = n."id" AND tm."pageId" = ${pageParam})`,
    ];
    if (input.cursor) {
      const [createdAt, id] = decodeCursor(input.cursor, 2);
      extra.push(`(n."createdAt", n."id") < (${params.add(createdAt)}::timestamptz, ${params.add(id)})`);
    }
    const rows = await this.#rows(
      this.#client,
      `SELECT ${this.#noteColumns()} FROM ${this.#visibleNotes(filter)} AND ${extra.join(' AND ')} ORDER BY n."createdAt" DESC, n."id" DESC LIMIT ${limit + 1}`,
      params.values,
    );
    return this.#noteOutput(rows, limit);
  }

  #noteOutput(rows: Row[], limit: number): KnowledgeNoteListOutput {
    const notes = rows.slice(0, limit).map(toNote);
    const last = notes[notes.length - 1];
    return {
      notes,
      ...(rows.length > limit && last ? { nextCursor: encodeCursor([iso(last.createdAt), last.id]) } : {}),
    };
  }

  async addNote(input: AddKnowledgeNoteInput): Promise<KnowledgeNote> {
    const bounds = await this.#bounds();
    bounds.assertKnowledgeNoteTextWithinBound(input.text);
    if (input.stampScopeIds.length === 0) throw new Error('A Knowledge note needs at least one stamp scope');
    return this.#tx(async tx => {
      const page = await this.#requireLivePage(tx, input.pageId, false);
      const stampIds = [...new Set(input.stampScopeIds)];
      await this.#assertScopePages(tx, stampIds);
      const mentionIds = [...new Set(input.mentions)];
      if (mentionIds.length) {
        const found = await this.#rows(tx, `SELECT "id" FROM ${this.#pages} WHERE "id" = ANY($1::text[])`, [
          mentionIds,
        ]);
        const missing = mentionIds.find(id => !found.some(row => row.id === id));
        if (missing) throw new KnowledgeNotFoundError('page', missing);
      }
      const id = input.id ?? createKnowledgeUlid();
      const now = new Date();
      await tx.query(
        `INSERT INTO ${this.#notes} ("id","pageId","text","when","provenance","version","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5::jsonb,1,$6,$6)`,
        [id, page.id, input.text, input.when ? iso(input.when) : null, JSON.stringify(input.provenance), iso(now)],
      );
      await tx.query(`INSERT INTO ${this.#stamps} ("noteId","scopeId") SELECT $1, unnest($2::text[])`, [id, stampIds]);
      if (mentionIds.length) {
        await tx.query(`INSERT INTO ${this.#mentions} ("noteId","pageId") SELECT $1, unnest($2::text[])`, [
          id,
          mentionIds,
        ]);
      }
      await this.#logActivity(tx, {
        action: 'note-added',
        scopeId: page.scopeId,
        pageId: page.id,
        noteId: id,
        provenance: input.provenance,
        at: now,
      });
      return this.#noteById(tx, id);
    });
  }

  async #assertScopePages(db: Queryable, ids: string[]): Promise<void> {
    const rows = await this.#rows(db, `SELECT "id" FROM ${this.#pages} WHERE "id" = ANY($1::text[]) AND "isScope"`, [
      ids,
    ]);
    const missing = ids.find(id => !rows.some(row => row.id === id));
    if (missing) throw new Error(`Knowledge note stamp ${missing} is not a scope page`);
  }

  async #noteById(db: Queryable, id: string, lock = false): Promise<KnowledgeNote> {
    const rows = await this.#rows(
      db,
      `SELECT ${this.#noteColumns()} FROM ${this.#notes} n WHERE n."id" = $1${lock ? ' FOR UPDATE' : ''}`,
      [id],
    );
    if (!rows[0]) throw new KnowledgeNotFoundError('note', id);
    return toNote(rows[0]);
  }

  async restampNote(input: {
    id: string;
    expectedVersion: number;
    stampScopeIds: string[];
    provenance: KnowledgeProvenance;
  }): Promise<KnowledgeNote> {
    if (input.stampScopeIds.length === 0) throw new Error('A Knowledge note needs at least one stamp scope');
    return this.#tx(async tx => {
      const lockedRows = await this.#rows(tx, `SELECT * FROM ${this.#notes} WHERE "id" = $1 FOR UPDATE`, [input.id]);
      const note = lockedRows[0];
      if (!note || note.deletedAt) throw new KnowledgeNotFoundError('note', input.id);
      if (Number(note.version) !== input.expectedVersion) throw new KnowledgeConflictError(input.id);
      const stampIds = [...new Set(input.stampScopeIds)];
      await this.#assertScopePages(tx, stampIds);
      const now = new Date();
      await tx.query(`DELETE FROM ${this.#stamps} WHERE "noteId" = $1`, [input.id]);
      await tx.query(`INSERT INTO ${this.#stamps} ("noteId","scopeId") SELECT $1, unnest($2::text[])`, [
        input.id,
        stampIds,
      ]);
      await tx.query(`UPDATE ${this.#notes} SET "version" = "version" + 1, "updatedAt" = $2 WHERE "id" = $1`, [
        input.id,
        iso(now),
      ]);
      const page = await this.#pageScope(tx, String(note.pageId));
      await this.#logActivity(tx, {
        action: 'note-restamped',
        scopeId: page,
        pageId: String(note.pageId),
        noteId: input.id,
        provenance: input.provenance,
        at: now,
      });
      return this.#noteById(tx, input.id);
    });
  }

  async #pageScope(db: Queryable, pageId: string): Promise<string> {
    const rows = await this.#rows(db, `SELECT "scopeId" FROM ${this.#pages} WHERE "id" = $1`, [pageId]);
    return String(rows[0]?.scopeId);
  }

  async removeNote(input: { id: string; deletedBy: string; provenance: KnowledgeProvenance }): Promise<KnowledgeNote> {
    return this.#tx(async tx => {
      const note = await this.#noteById(tx, input.id, true);
      if (note.deletedAt) return note;
      const now = new Date();
      await tx.query(
        `UPDATE ${this.#notes} SET "deletedAt" = $2, "deletedBy" = $3, "version" = "version" + 1, "updatedAt" = $2 WHERE "id" = $1`,
        [input.id, iso(now), input.deletedBy],
      );
      await this.#logActivity(tx, {
        action: 'note-removed',
        scopeId: await this.#pageScope(tx, note.pageId),
        pageId: note.pageId,
        noteId: input.id,
        provenance: input.provenance,
        at: now,
      });
      return this.#noteById(tx, input.id);
    });
  }

  async restoreNote(input: { id: string; provenance: KnowledgeProvenance }): Promise<KnowledgeNote> {
    return this.#tx(async tx => {
      const note = await this.#noteById(tx, input.id, true);
      if (!note.deletedAt) return note;
      const now = new Date();
      await tx.query(
        `UPDATE ${this.#notes} SET "deletedAt" = NULL, "deletedBy" = NULL, "version" = "version" + 1, "updatedAt" = $2 WHERE "id" = $1`,
        [input.id, iso(now)],
      );
      await this.#logActivity(tx, {
        action: 'note-restored',
        scopeId: await this.#pageScope(tx, note.pageId),
        pageId: note.pageId,
        noteId: input.id,
        provenance: input.provenance,
        at: now,
      });
      return this.#noteById(tx, input.id);
    });
  }

  // Search and activity ----------------------------------------------------------------------------

  async searchPages(input: SearchKnowledgePagesInput): Promise<KnowledgePageSearchHit[]> {
    const core = await loadPagesCore();
    const limit = clampLimit(input.limit, core.MAX_KNOWLEDGE_PAGE_LIST_LIMIT);
    const words = knowledgeSearchWords(input.query);
    if (!words.length) return [];
    const phrase = input.query.trim().toLowerCase().replace(/\s+/g, ' ');
    const hits: KnowledgePageSearchHit[] = [];

    {
      const params = new Params();
      const filter = new ReadFilter(input.read, params);
      const patterns = words.map(word => params.add(`%${escapeLike(word)}%`));
      const phrasePattern = params.add(`%${escapeLike(phrase)}%`);
      const where = [`p."deletedAt" IS NULL`, `NOT p."isScope"`, filter.readable('s')];
      if (input.scopeIds?.length) where.push(`p."scopeId" = ANY(${params.add(input.scopeIds)}::text[])`);
      for (const pattern of patterns) {
        where.push(`(p."name" ILIKE ${pattern} OR p."description" ILIKE ${pattern} OR p."body" ILIKE ${pattern})`);
      }
      const nameHasAll = patterns.map(pattern => `p."name" ILIKE ${pattern}`).join(' AND ');
      const tier = `CASE WHEN p."canonicalName" LIKE ${phrasePattern} THEN 0 WHEN ${nameHasAll} THEN 1 ELSE 2 END`;
      const rows = await this.#rows(
        this.#client,
        `SELECT p.* FROM ${this.#pages} p JOIN ${this.#pages} s ON s."id" = p."scopeId" WHERE ${where.join(' AND ')} ORDER BY ${tier}, p."updatedAt" DESC, p."id" ASC LIMIT ${limit}`,
        params.values,
      );
      for (const row of rows) hits.push({ type: 'page', page: toPage(row) });
    }
    if (hits.length >= limit) return hits;

    {
      const params = new Params();
      const filter = new ReadFilter(input.read, params);
      const extra = [`n."deletedAt" IS NULL`, `np."deletedAt" IS NULL`];
      if (input.scopeIds?.length) extra.push(`np."scopeId" = ANY(${params.add(input.scopeIds)}::text[])`);
      for (const word of words) extra.push(`n."text" ILIKE ${params.add(`%${escapeLike(word)}%`)}`);
      const rows = await this.#rows(
        this.#client,
        `SELECT ${this.#noteColumns()}, row_to_json(np) AS "pageJson" FROM ${this.#visibleNotes(filter)} AND ${extra.join(' AND ')} ORDER BY n."updatedAt" DESC, n."id" DESC LIMIT ${limit - hits.length}`,
        params.values,
      );
      for (const row of rows) {
        hits.push({ type: 'note', note: toNote(row), page: toPage(parseJson<Row>(row.pageJson)) });
      }
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
    const params = new Params();
    const filter = new ReadFilter(input.read, params);
    const where = [filter.readable('s'), `(a."noteId" IS NULL OR ${this.#noteVisible(filter, 'a."noteId"')})`];
    if (input.scopeId) where.push(`s."id" = ${params.add(input.scopeId)}`);
    if (input.pageId) where.push(`a."pageId" = ${params.add(input.pageId)}`);
    if (input.cursor) {
      const [createdAt, id] = decodeCursor(input.cursor, 2);
      where.push(`(a."createdAt", a."id") < (${params.add(createdAt)}::timestamptz, ${params.add(id)})`);
    }
    const rows = await this.#rows(
      this.#client,
      `SELECT a.* FROM ${this.#activity} a JOIN ${this.#pages} p ON p."id" = a."pageId" JOIN ${this.#pages} s ON s."id" = p."scopeId"
       WHERE ${where.join(' AND ')} ORDER BY a."createdAt" DESC, a."id" DESC LIMIT ${limit + 1}`,
      params.values,
    );
    const events = rows.slice(0, limit).map((row): KnowledgePageActivityEvent => ({
      id: String(row.id),
      action: String(row.action) as KnowledgePageActivityAction,
      scopeId: String(row.scopeId),
      pageId: String(row.pageId),
      ...(row.noteId == null ? {} : { noteId: String(row.noteId) }),
      provenance: parseJson<KnowledgeProvenance>(row.provenance),
      createdAt: new Date(row.createdAt as string | Date),
    }));
    const last = events[events.length - 1];
    return {
      events,
      ...(rows.length > limit && last ? { nextCursor: encodeCursor([iso(last.createdAt), last.id]) } : {}),
    };
  }

  // Pins -----------------------------------------------------------------------------------------

  async addPinAudience(input: { pageId: string; audience: string[]; createdBy: string }): Promise<KnowledgePin> {
    return this.#tx(async tx => {
      const page = await this.#requireLivePage(tx, input.pageId, false);
      const now = new Date();
      const { pin, changed } = await this.#upsertPinAudience(tx, page.id, input.audience, input.createdBy, now);
      if (changed) {
        await this.#logActivity(tx, {
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
    db: Queryable,
    pageId: string,
    audience: string[],
    createdBy: string,
    now: Date,
  ): Promise<{ pin: KnowledgePin; changed: boolean }> {
    const existing = (await this.#rows(db, `SELECT * FROM ${this.#pins} WHERE "pageId" = $1 FOR UPDATE`, [pageId]))[0];
    if (!existing) {
      const rows = await this.#rows(
        db,
        `INSERT INTO ${this.#pins} ("id","pageId","audience","createdBy","createdAt","updatedAt") VALUES ($1,$2,$3::text[],$4,$5,$5) RETURNING *`,
        [createKnowledgeUlid(), pageId, [...new Set(audience)], createdBy, iso(now)],
      );
      return { pin: toPin(rows[0]!), changed: true };
    }
    const current = (existing.audience as string[]) ?? [];
    const merged = [...new Set([...current, ...audience])];
    if (merged.length === current.length) return { pin: toPin(existing), changed: false };
    const rows = await this.#rows(
      db,
      `UPDATE ${this.#pins} SET "audience" = $2::text[], "updatedAt" = $3 WHERE "id" = $1 RETURNING *`,
      [String(existing.id), merged, iso(now)],
    );
    return { pin: toPin(rows[0]!), changed: true };
  }

  async removePinAudience(input: {
    pageId: string;
    audience: string[];
    removedBy: string;
  }): Promise<KnowledgePin | null> {
    return this.#tx(async tx => {
      const existing = (
        await this.#rows(tx, `SELECT * FROM ${this.#pins} WHERE "pageId" = $1 FOR UPDATE`, [input.pageId])
      )[0];
      if (!existing) return null;
      const current = (existing.audience as string[]) ?? [];
      const remaining = current.filter(entry => !input.audience.includes(entry));
      if (remaining.length === current.length) return toPin(existing);
      const now = new Date();
      let pin: KnowledgePin | null = null;
      if (remaining.length === 0) {
        await tx.query(`DELETE FROM ${this.#pins} WHERE "id" = $1`, [String(existing.id)]);
      } else {
        const rows = await this.#rows(
          tx,
          `UPDATE ${this.#pins} SET "audience" = $2::text[], "updatedAt" = $3 WHERE "id" = $1 RETURNING *`,
          [String(existing.id), remaining, iso(now)],
        );
        pin = toPin(rows[0]!);
      }
      await this.#logActivity(tx, {
        action: 'pin-removed',
        scopeId: await this.#pageScope(tx, input.pageId),
        pageId: input.pageId,
        provenance: { author: input.removedBy },
        at: now,
      });
      return pin;
    });
  }

  /** Deletes every row but keeps the tables and the schema-version marker. */
  async clearAll(): Promise<void> {
    const t = PG_KNOWLEDGE_PAGES_TABLES;
    const tables = [t.activity, t.pins, t.mentions, t.stamps, t.notes, t.pages].map(name => this.#q(name)).join(', ');
    await this.#client.query(`TRUNCATE ${tables}`);
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
    const params = new Params();
    const filter = new ReadFilter(input.read, params);
    const where = [`p."deletedAt" IS NULL`, filter.readable('s')];
    if (input.audience !== 'all') where.push(`pn."audience" && ${params.add(input.audience)}::text[]`);
    if (input.pageIds) where.push(`pn."pageId" = ANY(${params.add(input.pageIds)}::text[])`);
    if (input.cursor) {
      const [createdAt, id] = decodeCursor(input.cursor, 2);
      where.push(`(pn."createdAt", pn."id") < (${params.add(createdAt)}::timestamptz, ${params.add(id)})`);
    }
    const rows = await this.#rows(
      this.#client,
      `SELECT pn.* FROM ${this.#pins} pn JOIN ${this.#pages} p ON p."id" = pn."pageId" JOIN ${this.#pages} s ON s."id" = p."scopeId"
       WHERE ${where.join(' AND ')} ORDER BY pn."createdAt" DESC, pn."id" DESC LIMIT ${limit + 1}`,
      params.values,
    );
    const pins = rows.slice(0, limit).map(toPin);
    const last = pins[pins.length - 1];
    return {
      pins,
      ...(rows.length > limit && last ? { nextCursor: encodeCursor([iso(last.createdAt), last.id]) } : {}),
    };
  }
}

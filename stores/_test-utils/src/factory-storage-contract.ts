/**
 * Shared FactoryStorage contract test suite.
 *
 * Every backend runs this exact suite (e.g. `@mastra/libsql` against
 * `:memory:`, `@mastra/pg` against its docker database) so the semantics
 * app-table domains rely on — value normalization, UniqueViolation mapping,
 * keyset pagination, updateAtomic serialization — are pinned identically
 * across dialects, not per-backend.
 */

import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';

import { UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorage } from '@mastra/core/storage';

export interface FactoryStorageContractHarness {
  storage: FactoryStorage;
  close(): Promise<void>;
}

/** Collection exercising every column type and both partial-unique forms. */
const CONTRACT_ITEMS: CollectionSchema = {
  name: 'contract_items',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    name: { type: 'text' },
    source_key: { type: 'text', nullable: true },
    owner_id: { type: 'text', nullable: true },
    count: { type: 'integer' },
    big: { type: 'bigint', nullable: true },
    enabled: { type: 'boolean' },
    payload: { type: 'json' },
    occurred_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    { name: 'contract_items_org_name_unique', columns: ['org_id', 'name'] },
    {
      name: 'contract_items_org_source_key_unique',
      columns: ['org_id', 'source_key'],
      whereNotNull: 'source_key',
    },
    {
      name: 'contract_items_org_shared_unique',
      columns: ['org_id', 'count'],
      whereNull: 'owner_id',
    },
  ],
  indexes: [{ name: 'contract_items_org_occurred_idx', columns: ['org_id', 'occurred_at'] }],
};

/** Natural (caller-supplied) primary key, like a login-session table. */
const CONTRACT_SESSIONS: CollectionSchema = {
  name: 'contract_sessions',
  columns: {
    session_id: { type: 'text', primaryKey: true },
    org_id: { type: 'text' },
    pending: { type: 'json' },
    next_poll_at: { type: 'timestamp', nullable: true },
  },
};

interface ContractItemRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  name: string;
  source_key: string | null;
  owner_id: string | null;
  count: number;
  big: number | null;
  enabled: boolean;
  payload: Record<string, unknown>;
  occurred_at: Date;
}

interface ContractSessionRow extends Record<string, unknown> {
  session_id: string;
  org_id: string;
  pending: Record<string, unknown>;
  next_poll_at: Date | null;
}

function baseItem(overrides: Partial<ContractItemRow> = {}): Partial<ContractItemRow> {
  return {
    org_id: 'org-1',
    name: `item-${Math.random().toString(36).slice(2)}`,
    source_key: null,
    owner_id: 'user-1',
    count: 0,
    big: null,
    enabled: false,
    payload: {},
    occurred_at: new Date('2026-07-17T10:00:00.000Z'),
    ...overrides,
  };
}

export function describeFactoryStorageContract(
  backendName: string,
  makeHarness: () => Promise<FactoryStorageContractHarness>,
): void {
  describe(`FactoryStorage contract (${backendName})`, () => {
    let harness: FactoryStorageContractHarness;
    let storage: FactoryStorage;

    beforeAll(async () => {
      harness = await makeHarness();
      storage = harness.storage;
      await storage.init();
      await storage.ensureCollections([CONTRACT_ITEMS, CONTRACT_SESSIONS]);
    });

    afterAll(async () => {
      await harness.close();
    });

    beforeEach(async () => {
      await storage.ops.deleteMany(CONTRACT_ITEMS.name, {});
      await storage.ops.deleteMany(CONTRACT_SESSIONS.name, {});
    });

    describe('lifecycle', () => {
      it('init and ensureCollections are idempotent', async () => {
        await storage.init();
        await storage.ensureCollections([CONTRACT_ITEMS, CONTRACT_SESSIONS]);
        await storage.ensureCollections([CONTRACT_ITEMS]);
      });

      it('getMastraStorage returns the same instance on repeat calls', () => {
        expect(storage.getMastraStorage()).toBe(storage.getMastraStorage());
      });

      it('rejects operations on unregistered collections', async () => {
        await expect(storage.ops.findOne('no_such_collection', {})).rejects.toThrow(/no_such_collection/);
      });

      it('rejects filters on unregistered columns', async () => {
        await expect(storage.ops.findOne(CONTRACT_ITEMS.name, { 'no_such_column; DROP TABLE x': 1 })).rejects.toThrow(
          /no_such_column/,
        );
      });

      it('relaxes NOT NULL when a column becomes nullable in the schema', async () => {
        const v1: CollectionSchema = {
          name: 'contract_relax',
          columns: {
            id: { type: 'uuid-pk' },
            org_id: { type: 'text' },
            note: { type: 'text' },
          },
          uniqueIndexes: [{ name: 'contract_relax_org_unique', columns: ['org_id'] }],
        };
        await storage.ensureCollections([v1]);
        await storage.ops.deleteMany(v1.name, {});
        await storage.ops.insertOne(v1.name, { org_id: 'org-1', note: 'kept' });

        const v2: CollectionSchema = {
          ...v1,
          columns: { ...v1.columns, note: { type: 'text', nullable: true } },
        };
        await storage.ensureCollections([v2]);

        const inserted = await storage.ops.insertOne<Record<string, unknown>>(v2.name, {
          org_id: 'org-2',
          note: null,
        });
        expect(inserted.note).toBeNull();
        // Pre-existing rows survive the relaxation.
        const prior = await storage.ops.findOne<Record<string, unknown>>(v2.name, { org_id: 'org-1' });
        expect(prior?.note).toBe('kept');
        // Unique indexes are still enforced afterwards.
        await expect(storage.ops.insertOne(v2.name, { org_id: 'org-1', note: 'dup' })).rejects.toThrow(
          UniqueViolationError,
        );
      });
    });

    describe('insertOne', () => {
      it('generates a uuid primary key and round-trips every column type', async () => {
        const occurredAt = new Date('2026-07-17T12:34:56.789Z');
        const row = await storage.ops.insertOne<ContractItemRow>(CONTRACT_ITEMS.name, {
          org_id: 'org-1',
          name: 'alpha',
          source_key: 'src-1',
          owner_id: null,
          count: 7,
          big: 3244037880, // > 2^31: pins bigint → JS number normalization
          enabled: true,
          payload: { nested: { list: [1, 'two', false] } },
          occurred_at: occurredAt,
        });

        expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(row.count).toBe(7);
        expect(row.big).toBe(3244037880);
        expect(row.enabled).toBe(true);
        expect(row.source_key).toBe('src-1');
        expect(row.owner_id).toBeNull();
        expect(row.payload).toEqual({ nested: { list: [1, 'two', false] } });
        expect(row.occurred_at).toBeInstanceOf(Date);
        expect(row.occurred_at.getTime()).toBe(occurredAt.getTime());

        const read = await storage.ops.findOne<ContractItemRow>(CONTRACT_ITEMS.name, { id: row.id });
        expect(read).toEqual(row);
      });

      it('supports natural primary keys and nullable timestamps', async () => {
        const row = await storage.ops.insertOne<ContractSessionRow>(CONTRACT_SESSIONS.name, {
          session_id: 'sess-1',
          org_id: 'org-1',
          pending: { verifier: 'v' },
          next_poll_at: null,
        });
        expect(row.session_id).toBe('sess-1');
        expect(row.next_poll_at).toBeNull();

        await expect(
          storage.ops.insertOne<ContractSessionRow>(CONTRACT_SESSIONS.name, {
            session_id: 'sess-1',
            org_id: 'org-2',
            pending: {},
            next_poll_at: null,
          }),
        ).rejects.toBeInstanceOf(UniqueViolationError);
      });

      it('maps duplicate unique-index rows to UniqueViolationError', async () => {
        await storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ name: 'dup' }));
        const err = await storage.ops
          .insertOne(CONTRACT_ITEMS.name, baseItem({ name: 'dup' }))
          .then(() => null)
          .catch((e: unknown) => e);
        expect(err).toBeInstanceOf(UniqueViolationError);
        expect((err as UniqueViolationError).collection).toBe(CONTRACT_ITEMS.name);
      });

      it('does not map NOT NULL violations to UniqueViolationError', async () => {
        const err = await storage.ops
          .insertOne(CONTRACT_ITEMS.name, baseItem({ name: null as unknown as string }))
          .then(() => null)
          .catch((e: unknown) => e);
        expect(err).toBeTruthy();
        expect(err).not.toBeInstanceOf(UniqueViolationError);
      });

      it('enforces partial unique only where the column is NOT NULL', async () => {
        // Two null source_keys coexist…
        await storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ source_key: null }));
        await storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ source_key: null }));
        // …but a non-null source_key is unique per org…
        await storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ source_key: 'issue-1' }));
        await expect(
          storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ source_key: 'issue-1' })),
        ).rejects.toBeInstanceOf(UniqueViolationError);
        // …and free in a different org.
        await storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ org_id: 'org-2', source_key: 'issue-1' }));
      });

      it('enforces partial unique only where the column IS NULL', async () => {
        // Org-scoped rows (owner_id null) are unique per (org, count)…
        await storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ owner_id: null, count: 42 }));
        await expect(
          storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ owner_id: null, count: 42 })),
        ).rejects.toBeInstanceOf(UniqueViolationError);
        // …while user-scoped rows with the same (org, count) coexist freely.
        await storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ owner_id: 'user-1', count: 42 }));
        await storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ owner_id: 'user-2', count: 42 }));
      });
    });

    describe('upsertOne', () => {
      it('inserts when absent, updates non-key columns when present, keeps the id', async () => {
        const first = await storage.ops.upsertOne<ContractItemRow>(CONTRACT_ITEMS.name, ['org_id', 'name'], {
          ...baseItem({ name: 'settings' }),
          payload: { theme: 'light' },
        });
        const second = await storage.ops.upsertOne<ContractItemRow>(CONTRACT_ITEMS.name, ['org_id', 'name'], {
          ...baseItem({ name: 'settings' }),
          payload: { theme: 'dark' },
          count: 5,
        });

        expect(second.id).toBe(first.id);
        expect(second.payload).toEqual({ theme: 'dark' });
        expect(second.count).toBe(5);
        const all = await storage.ops.findMany(CONTRACT_ITEMS.name, { org_id: 'org-1', name: 'settings' });
        expect(all).toHaveLength(1);
      });

      it('rejects conflict keys that are incomplete, non-unique, or inapplicable to a partial index', async () => {
        await expect(
          storage.ops.upsertOne(CONTRACT_ITEMS.name, ['org_id'], baseItem({ name: 'not-unique' })),
        ).rejects.toThrow(/primary key or unique index/);
        await expect(
          storage.ops.upsertOne(CONTRACT_ITEMS.name, ['org_id', 'name'], { org_id: 'org-1' }),
        ).rejects.toThrow(/present in the row/);
        await expect(
          storage.ops.upsertOne(
            CONTRACT_ITEMS.name,
            ['org_id', 'source_key'],
            baseItem({ name: 'partial-miss', source_key: null }),
          ),
        ).rejects.toThrow(/primary key or unique index/);
      });
    });

    describe('find', () => {
      it('findOne matches equality and IS NULL; returns null on miss', async () => {
        const inserted = await storage.ops.insertOne<ContractItemRow>(
          CONTRACT_ITEMS.name,
          baseItem({ name: 'target', source_key: null }),
        );

        const byName = await storage.ops.findOne<ContractItemRow>(CONTRACT_ITEMS.name, {
          org_id: 'org-1',
          name: 'target',
        });
        expect(byName?.id).toBe(inserted.id);

        const byNull = await storage.ops.findOne<ContractItemRow>(CONTRACT_ITEMS.name, {
          org_id: 'org-1',
          source_key: null,
        });
        expect(byNull?.id).toBe(inserted.id);

        expect(await storage.ops.findOne(CONTRACT_ITEMS.name, { org_id: 'org-1', name: 'missing' })).toBeNull();
      });

      it('findMany supports `in` filters, ordering, and limit', async () => {
        for (const [name, count] of [
          ['a', 3],
          ['b', 1],
          ['c', 2],
          ['d', 4],
        ] as const) {
          await storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ name, count }));
        }

        const filtered = await storage.ops.findMany<ContractItemRow>(
          CONTRACT_ITEMS.name,
          { org_id: 'org-1', name: { in: ['a', 'c', 'nope'] } },
          { orderBy: [['count', 'asc']] },
        );
        expect(filtered.map(r => r.name)).toEqual(['c', 'a']);

        const nullable = await storage.ops.findMany<ContractItemRow>(
          CONTRACT_ITEMS.name,
          { org_id: 'org-1', source_key: { in: [null, 'missing'] } },
          { orderBy: [['count', 'asc']] },
        );
        expect(nullable.map(r => r.name)).toEqual(['b', 'c', 'a', 'd']);

        const limited = await storage.ops.findMany<ContractItemRow>(
          CONTRACT_ITEMS.name,
          { org_id: 'org-1' },
          { orderBy: [['count', 'desc']], limit: 2 },
        );
        expect(limited.map(r => r.count)).toEqual([4, 3]);
      });

      it('paginates with a keyset cursor over (timestamp desc, id desc) including ties', async () => {
        const early = new Date('2026-07-17T09:00:00.000Z');
        const late = new Date('2026-07-17T11:00:00.000Z');
        // Two rows tie on occurred_at so the cursor must fall back to id.
        const rows = [
          await storage.ops.insertOne<ContractItemRow>(CONTRACT_ITEMS.name, baseItem({ occurred_at: late })),
          await storage.ops.insertOne<ContractItemRow>(CONTRACT_ITEMS.name, baseItem({ occurred_at: late })),
          await storage.ops.insertOne<ContractItemRow>(CONTRACT_ITEMS.name, baseItem({ occurred_at: early })),
          await storage.ops.insertOne<ContractItemRow>(CONTRACT_ITEMS.name, baseItem({ occurred_at: early })),
          await storage.ops.insertOne<ContractItemRow>(CONTRACT_ITEMS.name, baseItem({ occurred_at: early })),
        ];

        const orderBy: [string, 'asc' | 'desc'][] = [
          ['occurred_at', 'desc'],
          ['id', 'desc'],
        ];
        const seen: ContractItemRow[] = [];
        let cursor: { values: (Date | string)[] } | undefined;
        for (let guard = 0; guard < 10; guard++) {
          const page = await storage.ops.findMany<ContractItemRow>(
            CONTRACT_ITEMS.name,
            { org_id: 'org-1' },
            { orderBy, limit: 2, ...(cursor ? { cursor } : {}) },
          );
          if (page.length === 0) break;
          seen.push(...page);
          const last = page[page.length - 1]!;
          cursor = { values: [last.occurred_at, last.id] };
        }

        expect(seen).toHaveLength(rows.length);
        expect(new Set(seen.map(r => r.id)).size).toBe(rows.length);
        for (let i = 1; i < seen.length; i++) {
          const prev = seen[i - 1]!;
          const cur = seen[i]!;
          const before =
            prev.occurred_at.getTime() > cur.occurred_at.getTime() ||
            (prev.occurred_at.getTime() === cur.occurred_at.getTime() && prev.id > cur.id);
          expect(before).toBe(true);
        }
      });
    });

    describe('updateMany / deleteMany', () => {
      it('updates matching rows and reports the count', async () => {
        await storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ name: 'u1', enabled: false }));
        await storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ name: 'u2', enabled: false }));
        await storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ org_id: 'org-2', name: 'u3', enabled: false }));

        const updated = await storage.ops.updateMany(
          CONTRACT_ITEMS.name,
          { org_id: 'org-1' },
          { enabled: true, payload: { touched: true } },
        );
        expect(updated).toBe(2);

        const rows = await storage.ops.findMany<ContractItemRow>(CONTRACT_ITEMS.name, { org_id: 'org-1' });
        expect(rows.every(r => r.enabled === true)).toBe(true);
        expect(rows.every(r => r.payload && (r.payload as { touched?: boolean }).touched === true)).toBe(true);

        const other = await storage.ops.findOne<ContractItemRow>(CONTRACT_ITEMS.name, { org_id: 'org-2' });
        expect(other?.enabled).toBe(false);
      });

      it('deletes matching rows and reports the count', async () => {
        await storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ name: 'd1' }));
        await storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ name: 'd2' }));
        await storage.ops.insertOne(CONTRACT_ITEMS.name, baseItem({ org_id: 'org-2', name: 'd3' }));

        expect(await storage.ops.deleteMany(CONTRACT_ITEMS.name, { org_id: 'org-1' })).toBe(2);
        expect(await storage.ops.findMany(CONTRACT_ITEMS.name, {})).toHaveLength(1);
        expect(await storage.ops.deleteMany(CONTRACT_ITEMS.name, { org_id: 'org-1' })).toBe(0);
      });
    });

    describe('updateAtomic', () => {
      it('applies a read-modify-write and returns the updated row', async () => {
        const inserted = await storage.ops.insertOne<ContractItemRow>(
          CONTRACT_ITEMS.name,
          baseItem({ name: 'atomic', count: 1, payload: { history: ['created'] } }),
        );

        const updated = await storage.ops.updateAtomic<ContractItemRow>(
          CONTRACT_ITEMS.name,
          { id: inserted.id },
          row => ({
            count: row.count + 1,
            payload: { history: [...(row.payload as { history: string[] }).history, 'bumped'] },
          }),
        );

        expect(updated?.count).toBe(2);
        expect(updated?.payload).toEqual({ history: ['created', 'bumped'] });
        const read = await storage.ops.findOne<ContractItemRow>(CONTRACT_ITEMS.name, { id: inserted.id });
        expect(read).toEqual(updated);
      });

      it('returns null when no row matches', async () => {
        const result = await storage.ops.updateAtomic<ContractItemRow>(
          CONTRACT_ITEMS.name,
          { org_id: 'org-1', name: 'missing' },
          () => ({ count: 99 }),
        );
        expect(result).toBeNull();
      });

      it('aborts without writing when fn returns null, returning the unmodified row', async () => {
        const inserted = await storage.ops.insertOne<ContractItemRow>(
          CONTRACT_ITEMS.name,
          baseItem({ name: 'abort', count: 5 }),
        );

        let sawCount: number | undefined;
        const result = await storage.ops.updateAtomic<ContractItemRow>(
          CONTRACT_ITEMS.name,
          { id: inserted.id },
          row => {
            sawCount = row.count;
            return null;
          },
        );

        expect(sawCount).toBe(5);
        expect(result?.count).toBe(5);
        const read = await storage.ops.findOne<ContractItemRow>(CONTRACT_ITEMS.name, { id: inserted.id });
        expect(read?.count).toBe(5);
      });

      it('supports async fn and serializes concurrent writers (no lost updates)', async () => {
        const inserted = await storage.ops.insertOne<ContractItemRow>(
          CONTRACT_ITEMS.name,
          baseItem({ name: 'counter', count: 0 }),
        );

        const attempts = 10;
        await Promise.all(
          Array.from({ length: attempts }, () =>
            storage.ops.updateAtomic<ContractItemRow>(CONTRACT_ITEMS.name, { id: inserted.id }, async row => {
              await new Promise(resolve => setTimeout(resolve, 1));
              return { count: row.count + 1 };
            }),
          ),
        );

        const read = await storage.ops.findOne<ContractItemRow>(CONTRACT_ITEMS.name, { id: inserted.id });
        expect(read?.count).toBe(attempts);
      });
    });
  });
}

import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { expect, it } from 'vitest';
import { AdvisoryStore } from '../src/advisory/store.js';
import { detailSchema } from '../src/advisory/contracts.js';
import { AdvisoryTriage } from '../src/advisory/triage.js';
import { DomainStore } from '../src/core/store.js';

it('excludes bounded vendor package metadata from stored advisories and owner planning', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scanner-advisory-package-'));
  const url = `file:${join(directory, 'package.db')}`;
  const advisory = new AdvisoryStore(url);
  const id = 'CVE-2026-765435';
  const marker = 'PRIVATE_VENDOR_PACKAGE_METADATA';
  try {
    await advisory.initialize();
    const detail = detailSchema.parse({
      id,
      status: 'published',
      title: 'Owned advisory',
      affected: [{ vendor: 'PHP', product: 'Runtime', ranges: [], package: { name: marker } }],
      sources: [{ name: 'Owned feed', url: 'https://example.invalid/advisory', license: 'fixture' }],
      modifiedAt: '2026-11-03T00:00:00.000Z',
    });
    expect(JSON.stringify(detail)).not.toContain(marker);
    await advisory.importPage('head', [detail], null);
    const saved = await advisory.get(id);
    expect(detailSchema.parse(saved.detail).affected).toEqual([{ vendor: 'PHP', product: 'Runtime', ranges: [] }]);
    const planning = await advisory.planningCandidate(id, saved.revision);
    expect(planning).toMatchObject({
      applicability: 'APPLICABILITY_UNKNOWN',
      affectedProducts: [{ vendor: 'PHP', product: 'Runtime' }],
    });
    expect(JSON.stringify(planning)).not.toContain(marker);
    const db = createClient({ url });
    try {
      const rows = await db.execute('SELECT detail FROM scanner_advisories WHERE id=?', [id]);
      expect(String(rows.rows[0]?.detail)).not.toContain(marker);
    } finally {
      db.close();
    }
  } finally {
    advisory.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);

it('keeps two persisted owners isolated across ignore, undo, cases and advisory revisions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scanner-advisory-owners-'));
  const url = `file:${join(directory, 'owners.db')}`;
  const advisory = new AdvisoryStore(url);
  const domain = new DomainStore(url);
  const triage = new AdvisoryTriage(url, advisory, domain);
  const first = 'operator-a',
    second = 'operator-b';
  const firstTarget = randomUUID(),
    secondTarget = randomUUID();
  const id = 'CVE-2026-765432';
  try {
    await domain.initialize();
    await advisory.initialize();
    await triage.initialize();
    await domain.write(async transaction => {
      await domain.insert('target', { id: firstTarget, owner: first, revision: 1 }, transaction);
      await domain.insert('target', { id: secondTarget, owner: second, revision: 1 }, transaction);
    });
    const detail = detailSchema.parse({
      id,
      aliases: [],
      status: 'published' as const,
      title: 'Owned advisory',
      originalDescription: 'Untrusted source prose',
      affected: [{ vendor: 'PHP', product: 'Runtime', ranges: [] }],
      sources: [{ name: 'Owned feed', url: 'https://example.invalid/advisory', license: 'fixture' }],
      modifiedAt: '2026-11-02T00:00:00.000Z',
    });
    await advisory.importPage('head', [detail], null);
    await triage.ignore(id, { scope: 'all_targets', targetId: null, reason: 'First private reason' }, first);
    await triage.investigate(id, { notes: 'First private notes', evidenceRefs: ['private:first'] }, first);
    expect(await triage.planNew(first)).toMatchObject({ pending: 0, ready: 0 });
    expect(await triage.planNew(second)).toMatchObject({ pending: 1, ready: 0 });
    const secondView = await triage.state(id, undefined, second);
    expect(secondView.ignores).toEqual([]);
    expect(secondView.cases).toEqual([]);
    expect(secondView.suggested).toBe(true);
    expect(JSON.stringify(secondView)).not.toContain('First private');
    await triage.ignore(id, { scope: 'all_targets', targetId: null, reason: 'Second private reason' }, second);
    expect((await triage.state(id, undefined, first)).ignores).toMatchObject([
      { operator: first, reason: 'First private reason' },
    ]);
    await triage.ignore(id, { scope: 'target', targetId: firstTarget, reason: 'First target reason' }, first);
    await expect(triage.unignore(id, 'target', firstTarget, second)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await triage.state(id, firstTarget, first)).suggested).toBe(false);
    await triage.unignore(id, 'all_targets', null, second);
    expect((await triage.state(id, undefined, first)).suggested).toBe(false);
    expect((await triage.state(id, undefined, second)).suggested).toBe(true);
    await triage.unignore(id, 'target', firstTarget, first);
    await triage.ignore(id, { scope: 'target', targetId: secondTarget, reason: 'Second target reason' }, second);
    expect((await triage.state(id, secondTarget, second)).suggested).toBe(false);
    expect((await triage.state(id, firstTarget, first)).suggested).toBe(false);
    await advisory.importPage(
      'rotation',
      [{ ...detail, originalDescription: 'Revised source prose', modifiedAt: '2026-11-03T00:00:00.000Z' }],
      null,
    );
    const db = createClient({ url });
    try {
      const rows = await db.execute(
        'SELECT operator_id,scope,target_id,reason,cleared_at FROM scanner_advisory_ignores ORDER BY operator_id,scope,target_id',
      );
      expect(rows.rows).toHaveLength(4);
    } finally {
      db.close();
    }
    expect((await triage.state(id, undefined, first)).cases).toHaveLength(1);
    expect((await triage.state(id, undefined, second)).cases).toHaveLength(0);
    const restarted = new AdvisoryTriage(url, advisory, domain);
    try {
      await restarted.initialize();
      expect((await restarted.state(id, undefined, first)).cases).toMatchObject([
        { notes: 'First private notes', evidenceRefs: ['private:first'] },
      ]);
      expect((await restarted.state(id, undefined, second)).cases).toEqual([]);
      expect((await restarted.state(id, secondTarget, second)).suggested).toBe(false);
    } finally {
      await restarted.close();
    }
  } finally {
    await triage.close();
    advisory.close();
    domain.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);

it('keeps an unattributed earlier E ignore unchanged and refuses startup migration', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scanner-advisory-unattributed-'));
  const url = `file:${join(directory, 'unattributed.db')}`;
  const advisory = new AdvisoryStore(url);
  const domain = new DomainStore(url);
  const triage = new AdvisoryTriage(url, advisory, domain);
  const db = createClient({ url });
  try {
    await db.execute(`CREATE TABLE scanner_advisory_ignores (
      advisory_id TEXT NOT NULL, scope TEXT NOT NULL, target_id TEXT NOT NULL, operator_id TEXT NOT NULL,
      reason TEXT NOT NULL, ignored_at TEXT NOT NULL, cleared_at TEXT,
      PRIMARY KEY(advisory_id,scope,target_id))`);
    await db.execute({
      sql: 'INSERT INTO scanner_advisory_ignores VALUES (?,?,?,?,?,?,NULL)',
      args: ['CVE-2026-765434', 'all_targets', '', '', 'Unattributed record', '2026-11-02T00:00:00.000Z'],
    });
    await expect(triage.initialize()).rejects.toMatchObject({ code: 'ADVISORY_OWNER_MIGRATION_REQUIRED' });
    const rows = await db.execute('SELECT operator_id,reason FROM scanner_advisory_ignores');
    expect(rows.rows.map(row => [row.operator_id, row.reason])).toEqual([['', 'Unattributed record']]);
  } finally {
    db.close();
    await triage.close();
    advisory.close();
    domain.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);

it('migrates the earlier E ignore key without changing its recorded operator', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scanner-advisory-owner-migration-'));
  const url = `file:${join(directory, 'migration.db')}`;
  const advisory = new AdvisoryStore(url);
  const domain = new DomainStore(url);
  const triage = new AdvisoryTriage(url, advisory, domain);
  const id = 'CVE-2026-765433';
  try {
    await domain.initialize();
    await advisory.initialize();
    await advisory.importPage(
      'head',
      [
        detailSchema.parse({
          id,
          aliases: [],
          status: 'published',
          title: 'Existing owned advisory',
          affected: [{ vendor: 'PHP', product: 'Runtime', ranges: [] }],
          sources: [{ name: 'Owned feed', url: 'https://example.invalid/advisory', license: 'fixture' }],
          modifiedAt: '2026-11-02T00:00:00.000Z',
        }),
      ],
      null,
    );
    const db = createClient({ url });
    try {
      await db.execute(`CREATE TABLE scanner_advisory_ignores (
        advisory_id TEXT NOT NULL, scope TEXT NOT NULL, target_id TEXT NOT NULL, operator_id TEXT NOT NULL,
        reason TEXT NOT NULL, ignored_at TEXT NOT NULL, cleared_at TEXT,
        PRIMARY KEY(advisory_id,scope,target_id))`);
      await db.execute({
        sql: 'INSERT INTO scanner_advisory_ignores VALUES (?,?,?,?,?,?,NULL)',
        args: [id, 'all_targets', '', 'operator-a', 'Previously attributed to A', '2026-11-02T00:00:00.000Z'],
      });
    } finally {
      db.close();
    }
    await triage.initialize();
    expect((await triage.state(id, undefined, 'operator-a')).ignores).toMatchObject([
      { reason: 'Previously attributed to A', operator: 'operator-a' },
    ]);
    expect((await triage.state(id, undefined, 'operator-b')).ignores).toEqual([]);
    await triage.ignore(id, { scope: 'all_targets', targetId: null, reason: 'B remains independent' }, 'operator-b');
    expect((await triage.state(id, undefined, 'operator-a')).ignores[0]?.reason).toBe('Previously attributed to A');
    expect((await triage.state(id, undefined, 'operator-b')).ignores[0]?.reason).toBe('B remains independent');
    const inspect = createClient({ url });
    try {
      const rows = await inspect.execute(
        'SELECT operator_id,reason FROM scanner_advisory_ignores ORDER BY operator_id',
      );
      expect(rows.rows.map(row => [row.operator_id, row.reason])).toEqual([
        ['operator-a', 'Previously attributed to A'],
        ['operator-b', 'B remains independent'],
      ]);
    } finally {
      inspect.close();
    }
  } finally {
    await triage.close();
    advisory.close();
    domain.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';

import { resolveSourceRevision } from '../src/evals/source-revision.js';
import { createMastraSqliteClient } from '../src/storage/mastra-sqlite-client.js';

describe('standalone template compatibility', () => {
  it('supports downloads and new Git repositories without inventing a commit', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kyc-revision-'));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
    try {
      expect(resolveSourceRevision(directory)).toBe('unversioned');
      git('init', '--quiet');
      expect(resolveSourceRevision(directory)).toBe('unversioned');
      git(
        '-c',
        'user.name=Template Test',
        '-c',
        'user.email=test@example.invalid',
        'commit',
        '--quiet',
        '--allow-empty',
        '--no-gpg-sign',
        '-m',
        'Test provenance',
      );
      expect(resolveSourceRevision(directory)).toBe(git('rev-parse', 'HEAD'));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('preserves SQLite batch, transaction, and connection behavior for Mastra', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kyc-sqlite-'));
    const raw = createClient({ url: `file:${join(directory, 'storage.db')}` });
    const client = createMastraSqliteClient(raw);
    try {
      await client.execute('CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)');
      const [inserted] = await client.batch([{ sql: 'INSERT INTO items (value) VALUES (?)', args: ['first'] }]);
      expect(inserted?.lastInsertRowid).toBe(1n);
      expect(inserted?.rowsAffected).toBe(1);
      const transaction = await client.transaction('write');
      await transaction.execute("INSERT INTO items (value) VALUES ('rolled back')");
      await transaction.rollback();
      expect(transaction.closed).toBe(true);
      const committed = await client.transaction('write');
      await committed.execute("INSERT INTO items (value) VALUES ('committed')");
      await committed.commit();
      committed.close();
      const selected = await client.execute('SELECT value FROM items ORDER BY id');
      expect(selected.rows.map(row => row.value)).toEqual(['first', 'committed']);
      expect(selected.columns).toEqual(['value']);
      if (selected.lastInsertRowid === undefined) expect(selected).not.toHaveProperty('lastInsertRowid');
      expect(client.protocol).toBe(raw.protocol);
    } finally {
      await client.close();
      await rm(directory, { recursive: true, force: true });
    }
    expect(client.closed).toBe(true);
    expect(raw.closed).toBe(true);
  });
});

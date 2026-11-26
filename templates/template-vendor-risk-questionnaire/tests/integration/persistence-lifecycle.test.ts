import { it, expect } from 'vitest';
import { createClient } from '@libsql/client';
import { resolve } from 'node:path';
import { writeFile, readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createNativeStorage, openDatabase, openReadOnlyDatabase } from '../../src/mastra/persistence/database.ts';
import { recoverWriterLease, writerLease } from '../../src/mastra/persistence/ownership.ts';
import { controlledClient } from '../support/persistence.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';

it('reports_writer_conflicts_without_opening_storage_or_failing_cleanup', async () => {
  const root = await temporaryDirectory(),
    url = `file:${resolve(root, 'owned.db')}`,
    guard = writerLease(url),
    blocked = createNativeStorage('blocked-writer', url);
  try {
    guard.acquire();
    const ownerPath = `${url.slice(5)}.writer/owner.json`,
      owner = await readFile(ownerPath, 'utf8');
    await expect(blocked.storage.init()).rejects.toThrow('DATABASE_WRITER_OWNED');
    await expect(blocked.close()).resolves.toBeUndefined();
    expect(await readFile(ownerPath, 'utf8')).toBe(owner);
    await expect(stat(url.slice(5))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stat(`${url.slice(5)}.telemetry.duckdb`)).rejects.toMatchObject({ code: 'ENOENT' });
    guard.release();
    const retry = createNativeStorage('retry-writer', url);
    try {
      await retry.storage.init();
    } finally {
      await retry.close();
    }
  } finally {
    await blocked.close().catch(() => {});
    guard.release();
    await cleanupDirectory(root);
  }
});

it('excludes_a_second_writer_process_allows_query_only_status_and_requires_explicit_crash_recovery', async () => {
  const root = await temporaryDirectory(),
    url = `file:${resolve(root, 'process.db')}`;
  const native = createNativeStorage('writer', url);
  const child = resolve(root, 'probe.ts'),
    module = resolve('src/mastra/persistence/database.ts');
  const childSource = `import {openDatabase,openReadOnlyDatabase,createNativeStorage} from ${JSON.stringify(module)}; const url=${JSON.stringify(url)}; if(process.argv[2]==='native'){const native=createNativeStorage('child-native',process.argv[3]??url);try{await native.storage.init();console.log('NATIVE_ACCEPTED')}catch{console.log('NATIVE_REFUSED')}await native.close().catch(()=>{})}else if(process.argv[2]==='write'){try{const db=await openDatabase(url);await db.drain();console.log('WRITER_ACCEPTED')}catch(e){console.log(e.message)}}else{const db=await openReadOnlyDatabase(url);console.log(JSON.stringify((await db.execute('SELECT v FROM proof')).rows));try{await db.execute('INSERT INTO proof VALUES(2)')}catch{console.log('READ_ONLY_WRITE_REFUSED')}await db.drain().catch(()=>{})}`;
  try {
    await native.storage.init();
    const db = await openDatabase(url);
    await db.execute('CREATE TABLE proof(v INTEGER)');
    await db.execute('INSERT INTO proof VALUES(1)');
    await db.drain();
    await writeFile(child, childSource);
    const run = (mode: string) => execFileSync(process.execPath, [child, mode], { encoding: 'utf8' });
    expect(run('write')).toContain('DATABASE_WRITER_OWNED');
    expect(run('native')).toContain('NATIVE_REFUSED');
    expect(run('read')).toContain('READ_ONLY_WRITE_REFUSED');
    const absentUrl = `file:${resolve(root, 'absent.db')}`,
      guard = writerLease(absentUrl);
    guard.acquire();
    try {
      expect(execFileSync(process.execPath, [child, 'native', absentUrl], { encoding: 'utf8' })).toContain(
        'NATIVE_REFUSED',
      );
      await expect(stat(absentUrl.slice(5))).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      guard.release();
    }
    const owner = JSON.parse(await readFile(`${url.slice(5)}.writer/owner.json`, 'utf8'));
    expect(() => recoverWriterLease(url, owner.token)).toThrow('DATABASE_WRITER_STILL_ACTIVE');
    await native.close();
    expect(run('write')).toContain('WRITER_ACCEPTED');
    const crash = resolve(root, 'crash.ts');
    await writeFile(
      crash,
      `import {openDatabase} from ${JSON.stringify(module)};await openDatabase(${JSON.stringify(url)});process.exit(0)`,
    );
    execFileSync(process.execPath, [crash]);
    expect(run('write')).toContain('DATABASE_WRITER_OWNED');
    const abandoned = JSON.parse(await readFile(`${url.slice(5)}.writer/owner.json`, 'utf8'));
    expect(() => recoverWriterLease(url, 'wrong-token')).toThrow('DATABASE_WRITER_OWNERSHIP_CHANGED');
    recoverWriterLease(url, abandoned.token);
    expect(run('write')).toContain('WRITER_ACCEPTED');
  } finally {
    await native.close().catch(() => {});
    await cleanupDirectory(root);
  }
});

it('repository_reopen_rechecks_admission_when_close_begins_after_group_selection', async () => {
  const root = await temporaryDirectory(),
    url = `file:${resolve(root, 'selection.db')}`;
  const raw = controlledClient(createClient({ url }), () => {});
  try {
    const processing = await openProcessingStore(url, undefined, undefined, raw.client);
    const marker = await openDatabase(url);
    await marker.execute('CREATE TABLE proof(v INTEGER)');
    await marker.execute('INSERT INTO proof VALUES(11)');
    await marker.drain();
    // Processing close awaits pending work before releasing its borrower. The new
    // borrower selects that group before close starts draining the physical client.
    const closing = processing.close();
    const opening = openDatabase(url);
    await closing;
    const reopened = await opening;
    expect((await reopened.execute('SELECT v FROM proof')).rows[0]!.v).toBe(11);
    expect(raw.calls.filter(call => call.method === 'close')).toHaveLength(1);
    await reopened.drain();
    const fresh = await openReadOnlyDatabase(url);
    expect((await fresh.execute('SELECT v FROM proof')).rows[0]!.v).toBe(11);
    await fresh.drain();
  } finally {
    await cleanupDirectory(root);
  }
});

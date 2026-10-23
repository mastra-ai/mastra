import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createClient } from '@libsql/client';
import { LibSQLVector } from '@mastra/libsql';
import { describe, expect, it, vi } from 'vitest';

import { googleFixture, pdf } from '../../fixtures/records.js';
import { catalog, s3Fixture } from '../../fixtures/s3.js';
import { index } from './helpers/runtime.js';

describe('S3 multi-mount integration', () => {
  it('S3 incremental refresh preserves committed state', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'organization-s3-'));
    const s3 = s3Fixture();
    try {
      const object = {
        key: 'organization/archive.md',
        content: Buffer.from('Archive retention is seven years.'),
        etag: '"one"',
        modifiedAt: new Date('2026-01-01'),
      };
      s3.objects.set(object.key, object);
      const first = await index(directory, googleFixture(), s3);
      await first.sourceIndex.sync();
      const reads = s3.calls.filter(call => call.operation === 'GetObjectCommand').length;
      const embeddings = first.embedded.length;
      await first.sourceIndex.sync();
      expect(s3.calls.filter(call => call.operation === 'GetObjectCommand')).toHaveLength(reads);
      expect(first.embedded).toHaveLength(embeddings);
      object.etag = '"validator-only"';
      await first.sourceIndex.sync();
      expect(first.embedded).toHaveLength(embeddings);
      await first.sourceIndex.close();
      const reopened = await index(directory, googleFixture(), s3);
      await reopened.sourceIndex.sync();
      expect(s3.calls.filter(call => call.operation === 'GetObjectCommand')).toHaveLength(reads + 1);
      object.content = Buffer.from('Archive retention is eight years.');
      object.etag = '"two"';
      await reopened.sourceIndex.sync();
      expect((await reopened.sourceIndex.search('eight years')).some(hit => hit.content.includes('eight years'))).toBe(
        true,
      );
      const committedRaceRecord = (await reopened.sourceIndex.search('eight years')).find(
        hit => hit.metadata.path === '/archive/archive.md',
      )!;
      const cacheBeforeRaceDatabase = createClient({ url: 'file:' + join(directory, 'state', 'index.db') });
      const cacheBeforeRace = JSON.parse(
        String(
          (await cacheBeforeRaceDatabase.execute('SELECT data FROM oi_committed_records')).rows.find(candidate =>
            String(candidate.data).includes('"sourceId":"archive"'),
          )!.data,
        ),
      ).cache;
      cacheBeforeRaceDatabase.close();
      object.content = Buffer.from('Archive retention is an uncommitted replacement.');
      object.etag = '"listing-race"';
      s3.setMutateOnRead(true);
      const revisionRace = await reopened.sourceIndex.sync();
      s3.setMutateOnRead(false);
      expect(revisionRace.sources[1]).toMatchObject({ status: 'partial', failed: 1, changed: 0 });
      const retainedRaceRecord = (await reopened.sourceIndex.search('eight years')).find(
        hit => hit.metadata.path === '/archive/archive.md',
      )!;
      expect(retainedRaceRecord.metadata.revision).toBe(committedRaceRecord.metadata.revision);
      expect(retainedRaceRecord.content).toContain('eight years');
      expect(retainedRaceRecord.content).not.toContain('uncommitted replacement');
      const cacheAfterRaceDatabase = createClient({ url: 'file:' + join(directory, 'state', 'index.db') });
      const cacheAfterRace = JSON.parse(
        String(
          (await cacheAfterRaceDatabase.execute('SELECT data FROM oi_committed_records')).rows.find(candidate =>
            String(candidate.data).includes('"sourceId":"archive"'),
          )!.data,
        ),
      ).cache;
      cacheAfterRaceDatabase.close();
      expect(cacheAfterRace).toEqual(cacheBeforeRace);
      await reopened.sourceIndex.close();
      const reopenedAfterRace = await index(directory, googleFixture(), s3);
      const durableRaceRecord = (await reopenedAfterRace.sourceIndex.search('eight years')).find(
        hit => hit.metadata.path === '/archive/archive.md',
      )!;
      expect(durableRaceRecord.metadata.revision).toBe(committedRaceRecord.metadata.revision);
      expect(durableRaceRecord.content).toContain('eight years');
      expect(durableRaceRecord.content).not.toContain('uncommitted replacement');
      const cacheAfterRaceReopenDatabase = createClient({ url: 'file:' + join(directory, 'state', 'index.db') });
      const cacheAfterRaceReopen = JSON.parse(
        String(
          (await cacheAfterRaceReopenDatabase.execute('SELECT data FROM oi_committed_records')).rows.find(candidate =>
            String(candidate.data).includes('"sourceId":"archive"'),
          )!.data,
        ),
      ).cache;
      cacheAfterRaceReopenDatabase.close();
      expect(cacheAfterRaceReopen).toEqual(cacheBeforeRace);
      expect(reopenedAfterRace.sourceIndex.sourceStatus().find(status => status.sourceId === 'archive')).toMatchObject({
        stale: true,
      });
      expect((await reopenedAfterRace.sourceIndex.sync()).sources[1]).toMatchObject({ changed: 1, status: 'success' });
      expect(
        (await reopenedAfterRace.sourceIndex.search('uncommitted replacement')).some(
          hit => hit.metadata.path === '/archive/archive.md',
        ),
      ).toBe(true);
      await reopenedAfterRace.sourceIndex.close();
      const cacheAfterRecoveryDatabase = createClient({ url: 'file:' + join(directory, 'state', 'index.db') });
      const cacheAfterRecovery = JSON.parse(
        String(
          (await cacheAfterRecoveryDatabase.execute('SELECT data FROM oi_committed_records')).rows.find(candidate =>
            String(candidate.data).includes('"sourceId":"archive"'),
          )!.data,
        ),
      ).cache;
      cacheAfterRecoveryDatabase.close();
      expect(cacheAfterRecovery).not.toEqual(cacheBeforeRace);
      s3.objects.set('organization/new.md', {
        key: 'organization/new.md',
        content: Buffer.from('New archive evidence requires a quarterly review.'),
        etag: '"new"',
        modifiedAt: new Date(),
      });
      const afterRecovery = await index(directory, googleFixture(), s3);
      expect((await afterRecovery.sourceIndex.sync()).sources[1]).toMatchObject({ discovered: 2, indexed: 1 });
      expect(
        (await afterRecovery.sourceIndex.search('quarterly review')).some(
          hit => hit.metadata.path === '/archive/new.md',
        ),
      ).toBe(true);
      await afterRecovery.sourceIndex.close();

      let entered!: () => void;
      let release!: () => void;
      const embeddingEntered = new Promise<void>(resolve => {
        entered = resolve;
      });
      const embeddingReleased = new Promise<void>(resolve => {
        release = resolve;
      });
      let holdEmbedding = false;
      const held = await index(directory, googleFixture(), s3, catalog(), async text => {
        if (holdEmbedding && text.includes('nine years')) {
          entered();
          await embeddingReleased;
        }
        return [text.includes('nine') ? 1 : 0, text.includes('Archive') ? 1 : 0];
      });
      object.content = Buffer.from('Archive retention is nine years.');
      object.etag = '"three"';
      holdEmbedding = true;
      const pending = held.sourceIndex.sync();
      await embeddingEntered;
      expect((await held.sourceIndex.sync()).status).toBe('skipped');
      expect(
        (await held.sourceIndex.search('retention')).some(hit => hit.content.includes('uncommitted replacement')),
      ).toBe(true);
      release();
      await pending;
      expect((await held.sourceIndex.search('retention')).some(hit => hit.content.includes('nine years'))).toBe(true);

      object.content = Buffer.from('Archive retention must never be published.');
      object.etag = '"failed-publication"';
      const publicationFailure = vi
        .spyOn(LibSQLVector.prototype, 'upsert')
        .mockRejectedValueOnce(new Error('synthetic S3 publication failure'));
      expect((await held.sourceIndex.sync()).status).toBe('failed');
      publicationFailure.mockRestore();
      expect((await held.sourceIndex.search('retention')).some(hit => hit.content.includes('nine years'))).toBe(true);
      await held.sourceIndex.close();

      object.content = Buffer.from('Archive retention is nine years.');
      object.etag = '"three"';
      const durable = await index(directory, googleFixture(), s3);
      expect((await durable.sourceIndex.search('retention')).some(hit => hit.content.includes('nine years'))).toBe(
        true,
      );
      await durable.sourceIndex.close();

      const database = createClient({ url: 'file:' + join(directory, 'state', 'index.db') });
      const records = (await database.execute('SELECT id,data FROM oi_committed_records')).rows;
      const archive = records.find(candidate => {
        const value = JSON.parse(String(candidate.data)) as { sourceId?: string };
        return value.sourceId === 'archive';
      });
      expect(archive).toBeDefined();
      const staleVersion = JSON.parse(String(archive!.data)) as {
        cache?: { validator: unknown; extractionVersion: string };
      };
      expect(staleVersion.cache).toBeDefined();
      await database.execute({
        sql: 'UPDATE oi_committed_records SET data=? WHERE id=?',
        args: [
          JSON.stringify({
            ...staleVersion,
            cache: { ...staleVersion.cache!, extractionVersion: 'obsolete-extraction-version' },
          }),
          String(archive!.id),
        ],
      });
      database.close();
      const readsBeforeVersionRepair = s3.calls.filter(call => call.operation === 'GetObjectCommand').length;
      const repairedVersion = await index(directory, googleFixture(), s3);
      await repairedVersion.sourceIndex.sync();
      expect(s3.calls.filter(call => call.operation === 'GetObjectCommand')).toHaveLength(readsBeforeVersionRepair + 1);
      await repairedVersion.sourceIndex.close();

      const cacheDatabase = createClient({ url: 'file:' + join(directory, 'state', 'index.db') });
      const cachedRows = (await cacheDatabase.execute('SELECT id,data FROM oi_committed_records')).rows;
      const cachedArchive = cachedRows.find(candidate => {
        const value = JSON.parse(String(candidate.data)) as { sourceId?: string };
        return value.sourceId === 'archive';
      });
      const missingMetadata = JSON.parse(String(cachedArchive!.data)) as { cache?: unknown };
      delete missingMetadata.cache;
      await cacheDatabase.execute({
        sql: 'UPDATE oi_committed_records SET data=? WHERE id=?',
        args: [JSON.stringify(missingMetadata), String(cachedArchive!.id)],
      });
      cacheDatabase.close();
      const readsBeforeMissingMetadata = s3.calls.filter(call => call.operation === 'GetObjectCommand').length;
      const repairedMetadata = await index(directory, googleFixture(), s3);
      await repairedMetadata.sourceIndex.sync();
      expect(s3.calls.filter(call => call.operation === 'GetObjectCommand')).toHaveLength(
        readsBeforeMissingMetadata + 1,
      );
      await repairedMetadata.sourceIndex.close();

      const mixed = await index(directory, googleFixture(), s3);
      s3.objects.set('organization/mixed.pdf', {
        key: 'organization/mixed.pdf',
        content: pdf(['Archive warning evidence.', '']),
        etag: '"mixed"',
        modifiedAt: new Date(),
      });
      expect((await mixed.sourceIndex.sync()).sources[1]).toMatchObject({ status: 'partial' });
      const warningReads = s3.calls.filter(call => call.operation === 'GetObjectCommand').length;
      const cachedWarning = await mixed.sourceIndex.sync();
      expect(cachedWarning.sources[1]).toMatchObject({ status: 'partial' });
      expect(s3.calls.filter(call => call.operation === 'GetObjectCommand')).toHaveLength(warningReads);
      await mixed.sourceIndex.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { googleFixture } from '../../fixtures/records.js';
import { catalog, s3Fixture } from '../../fixtures/s3.js';
import { index } from './helpers/runtime.js';

describe('S3 multi-mount integration', () => {
  it('S3 failures recover without false deletion', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'organization-s3-'));
    const s3 = s3Fixture();
    const drive = googleFixture();
    try {
      drive.files.set('drive-evidence', {
        id: 'drive-evidence',
        parent: 'drive-root',
        name: 'drive.md',
        mimeType: 'text/markdown',
        content: Buffer.from('Drive evidence is initially current.'),
      });
      s3.objects.set('organization/archive.md', {
        key: 'organization/archive.md',
        content: Buffer.from('Archive evidence remains.'),
        etag: '"one"',
        modifiedAt: new Date(),
      });
      const { sourceIndex } = await index(directory, drive, s3);
      await sourceIndex.sync();
      const committedRecord = (await sourceIndex.search('Archive evidence')).find(
        hit => hit.metadata.path === '/archive/archive.md',
      )!;
      const archiveObject = s3.objects.get('organization/archive.md')!;
      archiveObject.content = Buffer.from('Unreadable replacement must not replace committed evidence.');
      archiveObject.etag = '"unreadable"';
      s3.setUnreadable(archiveObject.key, true);
      const unreadableReplacement = await sourceIndex.sync();
      expect(unreadableReplacement.sources[1]).toMatchObject({ status: 'partial', failed: 1, changed: 0 });
      const retainedUnreadable = (await sourceIndex.search('Archive evidence')).find(
        hit => hit.metadata.path === '/archive/archive.md',
      )!;
      expect(retainedUnreadable.metadata.revision).toBe(committedRecord.metadata.revision);
      expect(retainedUnreadable.content).toContain('Archive evidence remains');
      expect(retainedUnreadable.content).not.toContain('Unreadable replacement');
      expect(sourceIndex.sourceStatus().find(status => status.sourceId === 'archive')).toMatchObject({ stale: true });
      s3.setUnreadable(archiveObject.key, false);
      expect((await sourceIndex.sync()).sources[1]).toMatchObject({ changed: 1, status: 'success' });
      expect(
        (await sourceIndex.search('Unreadable replacement')).some(hit => hit.metadata.path === '/archive/archive.md'),
      ).toBe(true);
      s3.setFailed(true);
      drive.files.get('drive-evidence')!.content = Buffer.from('Drive evidence progressed while R2 was unavailable.');
      const partial = await sourceIndex.sync();
      expect(partial.status).toBe('partial');
      expect(partial.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sourceId: 'drive', changed: 1, status: 'success' }),
          expect.objectContaining({ sourceId: 'archive', status: 'partial' }),
        ]),
      );
      expect(
        (await sourceIndex.search('Unreadable replacement')).some(hit => hit.metadata.sourceId === 'archive'),
      ).toBe(true);
      expect((await sourceIndex.search('progressed')).some(hit => hit.metadata.sourceId === 'drive')).toBe(true);
      expect(sourceIndex.sourceStatus().find(status => status.sourceId === 'archive')).toMatchObject({
        stale: true,
        records: 1,
      });
      const withNeverIndexed = catalog();
      const archiveSource = withNeverIndexed.sources[1]!;
      if (archiveSource.provider !== 's3') throw new Error('Expected S3 archive fixture.');
      withNeverIndexed.sources.push({
        ...archiveSource,
        id: 'never-indexed',
        mountPath: '/never-indexed',
        prefix: 'never-indexed/',
      });
      const neverIndexed = await index(directory, drive, s3, withNeverIndexed);
      const unavailable = await neverIndexed.sourceIndex.sync();
      expect(unavailable.sources.find(source => source.sourceId === 'never-indexed')).toMatchObject({
        status: 'failed',
        discovered: 0,
      });
      expect(neverIndexed.sourceIndex.sourceStatus().find(status => status.sourceId === 'never-indexed')).toMatchObject(
        {
          ready: false,
          records: 0,
        },
      );
      await neverIndexed.sourceIndex.close();
      await sourceIndex.close();
      const restarted = await index(directory, drive, s3);
      expect(
        (await restarted.sourceIndex.search('Unreadable replacement')).some(hit => hit.metadata.sourceId === 'archive'),
      ).toBe(true);
      expect(restarted.sourceIndex.sourceStatus().find(status => status.sourceId === 'archive')).toMatchObject({
        stale: true,
        lastSuccessAt: expect.any(String),
      });
      const disabled = catalog();
      disabled.sources[1]!.enabled = false;
      const disabledRestart = await index(directory, drive, s3, disabled);
      expect(
        (await disabledRestart.sourceIndex.search('Unreadable replacement')).every(
          hit => hit.metadata.sourceId !== 'archive',
        ),
      ).toBe(true);
      expect(
        (await disabledRestart.sourceIndex.search('progressed')).some(hit => hit.metadata.sourceId === 'drive'),
      ).toBe(true);
      await disabledRestart.sourceIndex.close();
      await restarted.sourceIndex.close();
      s3.setFailed(false);
      s3.objects.clear();
      const recovery = await index(directory, drive, s3);
      expect((await recovery.sourceIndex.sync()).sources[1]).toMatchObject({
        removed: 1,
        indexed: 0,
        status: 'success',
      });
      expect(
        (await recovery.sourceIndex.search('Unreadable replacement')).every(
          hit => hit.metadata.path !== '/archive/archive.md',
        ),
      ).toBe(true);
      expect(recovery.sourceIndex.sourceStatus().find(status => status.sourceId === 'archive')).toMatchObject({
        ready: true,
        stale: false,
        records: 0,
      });
      s3.objects.set('organization/renamed.md', {
        key: 'organization/renamed.md',
        content: Buffer.from('Renamed archive evidence is current.'),
        etag: '"renamed"',
        modifiedAt: new Date(),
      });
      expect((await recovery.sourceIndex.sync()).sources[1]).toMatchObject({
        removed: 0,
        indexed: 1,
        status: 'success',
      });
      expect(
        (await recovery.sourceIndex.search('Renamed archive')).some(hit => hit.metadata.path === '/archive/renamed.md'),
      ).toBe(true);
      s3.objects.delete('organization/renamed.md');
      s3.objects.set('organization/renamed-again.md', {
        key: 'organization/renamed-again.md',
        content: Buffer.from('Same-scan rename archive evidence is current.'),
        etag: '"renamed-again"',
        modifiedAt: new Date(),
      });
      expect((await recovery.sourceIndex.sync()).sources[1]).toMatchObject({
        removed: 1,
        indexed: 1,
        status: 'success',
      });
      expect(
        (await recovery.sourceIndex.search('Renamed archive')).every(
          hit => hit.metadata.path !== '/archive/renamed.md',
        ),
      ).toBe(true);
      expect(
        (await recovery.sourceIndex.search('Same-scan rename')).some(
          hit => hit.metadata.path === '/archive/renamed-again.md',
        ),
      ).toBe(true);
      await recovery.sourceIndex.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

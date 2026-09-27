import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { MAX_INSPECTION_BYTES } from '../../../src/mastra/workspaces/s3-source.js';
import { docx, googleFixture, officeArchive, pdf } from '../../fixtures/records.js';
import { s3Fixture } from '../../fixtures/s3.js';
import { index, runtime } from './helpers/runtime.js';

describe('S3 multi-mount integration', () => {
  it('S3 ingestion bounds pagination downloads and formats', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'organization-s3-'));
    const s3 = s3Fixture();
    try {
      s3.objects.set('organization/a.md', {
        key: 'organization/a.md',
        content: Buffer.from('# Archive\nArchive retention is ten years.'),
        etag: '"a"',
        modifiedAt: new Date(),
      });
      s3.objects.set('organization/evidence.pdf', {
        key: 'organization/evidence.pdf',
        content: pdf(['Archive cover.', 'Archive certificate is retained.']),
        etag: '"pdf"',
        modifiedAt: new Date(),
      });
      s3.objects.set('organization/table.docx', {
        key: 'organization/table.docx',
        content: docx(),
        etag: '"docx"',
        modifiedAt: new Date(),
      });
      s3.objects.set('organization/%2e%2e', {
        key: 'organization/%2e%2e',
        content: Buffer.from('never'),
        etag: '"b"',
        modifiedAt: new Date(),
      });
      const { sourceIndex } = await index(directory, googleFixture(), s3);
      const run = await sourceIndex.sync();
      expect(run.sources[1]).toMatchObject({ discovered: 3, indexed: 3, status: 'partial' });
      expect(run.sources[1]?.errors.join(' ')).toContain('unsafe key');
      expect((await sourceIndex.search('ten years')).some(hit => hit.metadata.path === '/archive/a.md')).toBe(true);
      expect(
        (await sourceIndex.search('certificate')).find(hit => hit.metadata.path === '/archive/evidence.pdf')?.metadata
          .locator,
      ).toBe('page 2');
      expect(
        (await sourceIndex.search('Archivist')).find(hit => hit.metadata.path === '/archive/table.docx')?.content,
      ).toContain('Archivist');
      s3.objects.delete('organization/%2e%2e');
      s3.objects.set('organization/unsupported.exe', {
        key: 'organization/unsupported.exe',
        content: Buffer.from('unsupported'),
        etag: '"unsupported"',
        modifiedAt: new Date(),
      });
      s3.objects.set('organization/corrupt.docx', {
        key: 'organization/corrupt.docx',
        content: Buffer.from('not an Office archive'),
        etag: '"corrupt"',
        modifiedAt: new Date(),
      });
      s3.objects.set('organization/inflated.docx', {
        key: 'organization/inflated.docx',
        content: officeArchive({ 'word/document.xml': 'x'.repeat(33 * 1024 * 1024) }),
        etag: '"inflated"',
        modifiedAt: new Date(),
      });
      const malformed = await sourceIndex.sync();
      expect(malformed.sources[1]).toMatchObject({ status: 'partial', failed: 2 });
      expect(malformed.sources[1]?.errors.join(' ')).toContain('Unsupported S3 format');
      expect((await sourceIndex.search('ten years')).some(hit => hit.metadata.path === '/archive/a.md')).toBe(true);
      s3.setIncomplete(true);
      const incomplete = await sourceIndex.sync();
      expect(incomplete.sources[1]).toMatchObject({ removed: 0, status: 'partial' });
      expect(incomplete.sources[1]?.errors.join(' ')).toContain('repeated');
      expect((await sourceIndex.search('ten years')).some(hit => hit.metadata.path === '/archive/a.md')).toBe(true);
      s3.setIncomplete(false);
      s3.objects.clear();
      s3.objects.set('other/leak.md', {
        key: 'other/leak.md',
        content: Buffer.from('outside the configured prefix'),
        etag: '"outside"',
        modifiedAt: new Date(),
      });
      s3.setIncludesOutOfPrefix(true);
      const outOfPrefix = await sourceIndex.sync();
      expect(outOfPrefix).toMatchObject({ status: 'partial' });
      expect(outOfPrefix.sources[1]?.errors.join(' ')).toContain('out-of-prefix');
      s3.setIncludesOutOfPrefix(false);
      s3.objects.clear();
      s3.objects.set('organization/stream.md', {
        key: 'organization/stream.md',
        content: Buffer.alloc(20 * 1024 * 1024 + 1),
        announcedSize: 1,
        etag: '"stream"',
        modifiedAt: new Date(),
      });
      const streamRuntime = await runtime(join(directory, 'stream'), googleFixture(), s3);
      const streamReader = streamRuntime.s3Readers.get('archive')!;
      const streamObject = (await streamReader.list()).objects[0]!;
      await expect(streamReader.extract(streamObject)).rejects.toThrow('20 MiB');
      expect(s3.cancelledBodies).toBeGreaterThan(0);
      s3.objects.clear();
      s3.objects.set('organization/timeout.md', {
        key: 'organization/timeout.md',
        content: Buffer.from('the body will not yield'),
        etag: '"timeout"',
        modifiedAt: new Date(),
      });
      s3.setHangingBody(true);
      const timeoutObject = (await streamReader.list()).objects[0]!;
      vi.useFakeTimers();
      const timedOut = expect(streamReader.extract(timeoutObject)).rejects.toThrow('body could not be read');
      await vi.advanceTimersByTimeAsync(30_000);
      await timedOut;
      vi.useRealTimers();
      s3.setHangingBody(false);
      expect(s3.cancelledBodies).toBeGreaterThan(1);
      s3.objects.clear();
      for (let number = 0; number < 201; number++) {
        const key = `organization/pages/${number}.md`;
        s3.objects.set(key, { key, content: Buffer.from('page'), etag: `"page-${number}"`, modifiedAt: new Date() });
      }
      expect(await streamReader.list()).toMatchObject({
        complete: false,
        errors: [expect.stringContaining('100 pages')],
      });
      s3.setPageSize(1_000);
      s3.objects.clear();
      for (let number = 0; number < 1_001; number++) {
        const key = `organization/entries/${number}.md`;
        s3.objects.set(key, { key, content: Buffer.from('entry'), etag: `"entry-${number}"`, modifiedAt: new Date() });
      }
      expect(await streamReader.list()).toMatchObject({
        complete: false,
        errors: [expect.stringContaining('1,000 entries')],
      });
      s3.objects.clear();
      const deepKey = 'organization/' + Array.from({ length: 33 }, (_, index) => `d${index}`).join('/') + '/deep.md';
      s3.objects.set(deepKey, { key: deepKey, content: Buffer.from('deep'), etag: '"deep"', modifiedAt: new Date() });
      expect(await streamReader.list()).toMatchObject({
        complete: false,
        errors: [expect.stringContaining('nesting limit')],
      });
      s3.objects.clear();
      s3.objects.set('organization/race.md', {
        key: 'organization/race.md',
        content: Buffer.alloc(MAX_INSPECTION_BYTES + 1),
        headSize: 1,
        etag: '"race"',
        modifiedAt: new Date(),
      });
      const raceRuntime = await runtime(join(directory, 'race'), googleFixture(), s3);
      await expect(raceRuntime.workspace.filesystem!.readFile('/archive/race.md')).rejects.toThrow('0.0625 MiB');
      s3.objects.clear();
      s3.objects.set('organization/big.md', {
        key: 'organization/big.md',
        content: Buffer.alloc(MAX_INSPECTION_BYTES + 1),
        etag: '"big"',
        modifiedAt: new Date(),
      });
      const sources = await runtime(join(directory, 'inspection'), googleFixture(), s3);
      await expect(sources.inspect('archive', 'big.md')).resolves.toMatchObject({
        status: 'available',
        error: expect.stringContaining('inspection limit'),
      });
      await sourceIndex.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

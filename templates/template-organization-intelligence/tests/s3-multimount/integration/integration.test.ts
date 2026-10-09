import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { googleFixture } from '../../fixtures/records.js';
import { s3Fixture } from '../../fixtures/s3.js';
import { runtime } from './helpers/runtime.js';

describe('S3 multi-mount integration', () => {
  it('Drive and S3 share one workspace file API', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'organization-s3-'));
    const drive = googleFixture();
    const s3 = s3Fixture();
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string | URL | Request) => {
          const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
          if (url.pathname.startsWith('/drive/v3/files/drive-root'))
            return Response.json({
              id: 'drive-root',
              name: 'drive-root',
              mimeType: 'application/vnd.google-apps.folder',
            });
          if (url.pathname === '/drive/v3/files')
            return Response.json({
              files: [{ id: 'drive-policy', name: 'policy.md', mimeType: 'text/markdown', size: '13' }],
            });
          if (url.searchParams.get('alt') === 'media' && url.pathname.endsWith('/drive-policy'))
            return new Response('Drive policy.');
          return new Response('', { status: 404 });
        }),
      );
      drive.files.set('drive-policy', {
        id: 'drive-policy',
        parent: 'drive-root',
        name: 'policy.md',
        mimeType: 'text/markdown',
        content: Buffer.from('Drive policy.'),
      });
      s3.objects.set('organization/policy.md', {
        key: 'organization/policy.md',
        content: Buffer.from('Archive policy.'),
        etag: '"one"',
        modifiedAt: new Date('2026-01-01T00:00:00Z'),
      });
      s3.objects.set('organization/nested/guide.md', {
        key: 'organization/nested/guide.md',
        content: Buffer.from('Nested archive guide.'),
        etag: '"nested"',
        modifiedAt: new Date('2026-01-01T00:00:00Z'),
      });
      const sources = await runtime(directory, drive, s3);
      const mounted = sources.workspace.filesystem!;
      expect((await mounted.readdir('/drive')).map(entry => entry.name)).toContain('policy.md');
      expect((await mounted.readdir('/archive')).map(entry => entry.name)).toContain('policy.md');
      expect(await mounted.stat('/drive/policy.md')).toMatchObject({ type: 'file', size: 13 });
      expect(await mounted.stat('/archive/policy.md')).toMatchObject({ type: 'file', size: 15 });
      expect(await mounted.readFile('/drive/policy.md', { encoding: 'utf8' })).toBe('Drive policy.');
      expect(await mounted.readFile('/archive/policy.md', { encoding: 'utf8' })).toBe('Archive policy.');
      expect(await mounted.exists('/archive/policy.md')).toBe(true);
      expect(await mounted.isFile('/archive/policy.md')).toBe(true);
      expect(await mounted.isDirectory('/archive')).toBe(true);
      expect(await mounted.stat('/archive/')).toMatchObject({ type: 'directory' });
      expect((await mounted.readdir('/archive')).find(entry => entry.name === 'nested')).toMatchObject({
        type: 'directory',
      });
      expect(await mounted.stat('/archive/nested')).toMatchObject({ type: 'directory' });
      expect(await mounted.exists('/archive/nested')).toBe(true);
      expect(await sources.inspect('drive', 'policy.md')).toMatchObject({ content: 'Drive policy.' });
      expect(await sources.inspect('archive', 'policy.md')).toMatchObject({ content: 'Archive policy.' });
      const filesystem = mounted;
      await Promise.all([
        expect(filesystem.writeFile('/archive/policy.md', 'replace')).rejects.toThrow(),
        expect(filesystem.appendFile('/archive/policy.md', 'replace')).rejects.toThrow(),
        expect(filesystem.deleteFile('/archive/policy.md')).rejects.toThrow(),
        expect(filesystem.copyFile('/archive/policy.md', '/archive/copy.md')).rejects.toThrow(),
        expect(filesystem.moveFile('/archive/policy.md', '/archive/move.md')).rejects.toThrow(),
        expect(filesystem.mkdir('/archive/new')).rejects.toThrow(),
        expect(filesystem.rmdir('/archive/new')).rejects.toThrow(),
      ]);
      expect(s3.calls.map(call => call.operation)).toContain('HeadObjectCommand');
      expect(s3.calls.map(call => call.operation)).toContain('GetObjectCommand');
    } finally {
      vi.unstubAllGlobals();
      await rm(directory, { recursive: true, force: true });
    }
  });
});

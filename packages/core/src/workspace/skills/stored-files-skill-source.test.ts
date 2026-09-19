import { describe, expect, it } from 'vitest';

import type { StorageSkillFileNode } from '../../storage/types';
import { collectSkillForPublish, collectSkillForPublishFromFiles } from './publish';
import type { SkillSource } from './skill-source';

const skillMd = `---
name: stored-skill
description: A stored skill
---
# Stored Skill

Follow these instructions.`;

function file(name: string, content: string, options?: Pick<StorageSkillFileNode, 'encoding' | 'mimeType'>) {
  return { name, type: 'file' as const, content, ...options };
}

describe('collectSkillForPublishFromFiles', () => {
  it('collects a nested stored file snapshot into blobs and a tree', async () => {
    const files: StorageSkillFileNode[] = [
      file('SKILL.md', skillMd),
      {
        name: 'references',
        type: 'folder',
        children: [file('api.md', '# API')],
      },
    ];

    const result = await collectSkillForPublishFromFiles(files);

    expect(result.snapshot).toMatchObject({
      name: 'stored-skill',
      description: 'A stored skill',
      instructions: '# Stored Skill\n\nFollow these instructions.',
      references: ['api.md'],
    });
    expect(Object.keys(result.tree.entries)).toEqual(['SKILL.md', 'references/api.md']);
    expect(result.blobs).toHaveLength(2);
  });

  it('produces the same tree and blobs as an equivalent filesystem-like source', async () => {
    const files: StorageSkillFileNode[] = [
      file('SKILL.md', skillMd),
      { name: 'references', type: 'folder', children: [file('api.md', '# API')] },
    ];
    const content = new Map([
      ['skill/SKILL.md', skillMd],
      ['skill/references/api.md', '# API'],
    ]);
    const source: SkillSource = {
      exists: async path => path === 'skill' || path === 'skill/references' || content.has(path),
      stat: async path => ({
        name: path.split('/').at(-1)!,
        type: content.has(path) ? 'file' : 'directory',
        size: Buffer.byteLength(content.get(path) ?? ''),
        createdAt: new Date(0),
        modifiedAt: new Date(0),
      }),
      readFile: async path => content.get(path)!,
      readdir: async path =>
        path === 'skill'
          ? [
              { name: 'SKILL.md', type: 'file' },
              { name: 'references', type: 'directory' },
            ]
          : [{ name: 'api.md', type: 'file' }],
    };

    const [storedResult, sourceResult] = await Promise.all([
      collectSkillForPublishFromFiles(files),
      collectSkillForPublish(source, 'skill'),
    ]);

    expect(storedResult.tree).toEqual(sourceResult.tree);
    expect(storedResult.blobs.map(({ createdAt: _, ...blob }) => blob)).toEqual(
      sourceResult.blobs.map(({ createdAt: _, ...blob }) => blob),
    );
  });

  it.each([
    ['UTF-8 first', [file('text.txt', 'abc'), file('binary.bin', 'YWJj', { encoding: 'base64' })]],
    ['Base64 first', [file('binary.bin', 'YWJj', { encoding: 'base64' }), file('text.txt', 'abc')]],
  ])('deduplicates identical raw bytes with canonical blob content when %s', async (_name, sharedFiles) => {
    const result = await collectSkillForPublishFromFiles([file('SKILL.md', skillMd), ...sharedFiles]);
    const textEntry = result.tree.entries['text.txt'];
    const binaryEntry = result.tree.entries['binary.bin'];

    expect(textEntry?.blobHash).toBe(binaryEntry?.blobHash);
    expect(textEntry).toMatchObject({ encoding: 'base64', sourceEncoding: 'utf-8' });
    expect(binaryEntry).toMatchObject({ encoding: 'base64', sourceEncoding: 'base64' });
    expect(result.blobs.filter(blob => blob.hash === textEntry?.blobHash)).toEqual([
      expect.objectContaining({ content: 'YWJj', size: 3 }),
    ]);
  });

  it('decodes only explicitly base64-encoded files and preserves their metadata', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const files: StorageSkillFileNode[] = [
      file('SKILL.md', skillMd),
      {
        name: 'assets',
        type: 'folder',
        children: [file('logo.png', png.toString('base64'), { encoding: 'base64', mimeType: 'image/png' })],
      },
    ];

    const result = await collectSkillForPublishFromFiles(files);
    const entry = result.tree.entries['assets/logo.png'];

    expect(entry).toMatchObject({ encoding: 'base64', mimeType: 'image/png', size: png.length });
    expect(result.blobs.find(blob => blob.hash === entry?.blobHash)?.content).toBe(png.toString('base64'));
    expect(result.files[1]?.children?.[0]).toMatchObject({
      name: 'logo.png',
      content: png.toString('base64'),
      encoding: 'base64',
      mimeType: 'image/png',
    });
  });

  it('treats legacy string content as UTF-8 even when the extension is binary', async () => {
    const files: StorageSkillFileNode[] = [
      file('SKILL.md', skillMd),
      { name: 'assets', type: 'folder', children: [file('legacy.png', 'not-base64')] },
    ];

    const result = await collectSkillForPublishFromFiles(files);
    const entry = result.tree.entries['assets/legacy.png'];

    expect(entry).toMatchObject({ encoding: 'base64', sourceEncoding: 'utf-8' });
    expect(entry?.size).toBe(Buffer.byteLength('not-base64'));
    expect(result.blobs.find(blob => blob.hash === entry?.blobHash)?.content).toBe(
      Buffer.from('not-base64').toString('base64'),
    );
  });

  it('rejects malformed or non-canonical base64 content', async () => {
    const files: StorageSkillFileNode[] = [
      file('SKILL.md', skillMd),
      file('asset.bin', 'not base64!', { encoding: 'base64' }),
    ];

    await expect(collectSkillForPublishFromFiles(files)).rejects.toThrow(/valid base64/i);
  });

  it('rejects duplicate flattened paths', async () => {
    const files: StorageSkillFileNode[] = [
      file('SKILL.md', skillMd),
      file('duplicate.md', 'one'),
      file('duplicate.md', 'two'),
    ];

    await expect(collectSkillForPublishFromFiles(files)).rejects.toThrow(/duplicate.*duplicate\.md/i);
  });

  it('rejects unsafe file and folder names', async () => {
    await expect(
      collectSkillForPublishFromFiles([file('SKILL.md', skillMd), file('../outside.md', 'unsafe')]),
    ).rejects.toThrow(/invalid.*name/i);
  });

  it('rejects structurally invalid file and folder nodes', async () => {
    await expect(
      collectSkillForPublishFromFiles([
        file('SKILL.md', skillMd),
        { name: 'bad-file', type: 'file', content: '', children: [] },
      ]),
    ).rejects.toThrow(/files cannot have children/i);
    await expect(
      collectSkillForPublishFromFiles([
        file('SKILL.md', skillMd),
        { name: 'bad-folder', type: 'folder', content: 'unexpected', children: [] },
      ]),
    ).rejects.toThrow(/folders cannot have file content/i);
  });

  it('publishes missing UTF-8 content as an empty file', async () => {
    const result = await collectSkillForPublishFromFiles([
      file('SKILL.md', skillMd),
      { name: 'empty.txt', type: 'file' },
    ]);
    const entry = result.tree.entries['empty.txt'];

    expect(entry?.size).toBe(0);
    expect(entry).toMatchObject({ encoding: 'base64', sourceEncoding: 'utf-8' });
    expect(result.blobs.find(blob => blob.hash === entry?.blobHash)?.content).toBe('');
  });

  it('requires SKILL.md', async () => {
    await expect(collectSkillForPublishFromFiles([file('README.md', '# Missing')])).rejects.toThrow(
      'SKILL.md not found',
    );
  });
});

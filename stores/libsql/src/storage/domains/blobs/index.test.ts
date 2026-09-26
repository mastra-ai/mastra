import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createClient } from '@libsql/client';
import type { SkillVersionTree, StorageSkillFileNode } from '@mastra/core/storage';
import { publishSkillFromFiles, VersionedSkillSource } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BlobsLibSQL } from '.';

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

async function readWithPrePrDecoder(tree: SkillVersionTree, path: string, blobStore: BlobsLibSQL) {
  const entry = tree.entries[path]!;
  const blob = await blobStore.get(entry.blobHash);
  if (!blob) throw new Error(`Missing blob: ${entry.blobHash}`);
  return entry.encoding === 'base64' ? Buffer.from(blob.content, 'base64') : blob.content;
}

describe('BlobsLibSQL', () => {
  let tempDir: string;
  let client: ReturnType<typeof createClient>;
  let blobStore: BlobsLibSQL;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-libsql-blobs-'));
    client = createClient({ url: `file:${join(tempDir, 'blobs.db')}` });
    blobStore = new BlobsLibSQL({ client });
    await blobStore.init();
  });

  afterEach(async () => {
    await client.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('preserves legacy rows and publishes artifacts readable across mixed versions', async () => {
    const skillMd = '---\nname: legacy-skill\ndescription: Legacy skill\n---\n\n# Legacy skill';
    const oldReference = '# Old reference';
    const changedReference = '# Changed reference';
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const skillMdHash = sha256(skillMd);
    const oldReferenceHash = sha256(oldReference);
    const changedReferenceHash = sha256(changedReference);
    const pngHash = sha256(png);
    const createdAt = new Date('2024-06-01');

    await blobStore.putMany([
      {
        hash: skillMdHash,
        content: skillMd,
        size: Buffer.byteLength(skillMd, 'utf-8'),
        mimeType: 'text/markdown',
        createdAt,
      },
      {
        hash: oldReferenceHash,
        content: oldReference,
        size: Buffer.byteLength(oldReference, 'utf-8'),
        mimeType: 'text/markdown',
        createdAt,
      },
    ]);

    const legacyTree: SkillVersionTree = {
      entries: {
        'SKILL.md': {
          blobHash: skillMdHash,
          size: Buffer.byteLength(skillMd, 'utf-8'),
          mimeType: 'text/markdown',
          encoding: 'utf-8',
        },
        'references/guide.md': {
          blobHash: oldReferenceHash,
          size: Buffer.byteLength(oldReference, 'utf-8'),
          mimeType: 'text/markdown',
          encoding: 'utf-8',
        },
      },
    };
    const files: StorageSkillFileNode[] = [
      { name: 'SKILL.md', type: 'file', content: skillMd },
      {
        name: 'references',
        type: 'folder',
        children: [{ name: 'guide.md', type: 'file', content: changedReference }],
      },
      {
        name: 'assets',
        type: 'folder',
        children: [
          {
            name: 'logo.png',
            type: 'file',
            content: png.toString('base64'),
            encoding: 'base64',
            mimeType: 'image/png',
          },
        ],
      },
    ];

    const published = await publishSkillFromFiles(files, blobStore);

    expect(await blobStore.get(skillMdHash)).toMatchObject({ content: skillMd });
    expect(await blobStore.get(oldReferenceHash)).toMatchObject({ content: oldReference });
    expect(await blobStore.get(changedReferenceHash)).toMatchObject({ content: changedReference });
    expect(await blobStore.get(pngHash)).toMatchObject({ content: png.toString('base64') });

    await expect(readWithPrePrDecoder(published.tree, 'SKILL.md', blobStore)).resolves.toBe(skillMd);
    await expect(readWithPrePrDecoder(published.tree, 'references/guide.md', blobStore)).resolves.toBe(
      changedReference,
    );
    await expect(readWithPrePrDecoder(published.tree, 'assets/logo.png', blobStore)).resolves.toEqual(png);

    const oldVersion = new VersionedSkillSource(legacyTree, blobStore, createdAt);
    await expect(oldVersion.readFile('SKILL.md')).resolves.toBe(skillMd);
    await expect(oldVersion.readFile('references/guide.md')).resolves.toBe(oldReference);
  });
});

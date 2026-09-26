import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { BlobStore } from '../../storage/domains/blobs/base';
import { InMemoryBlobStore } from '../../storage/domains/blobs/inmemory';
import type { SkillVersionTree, StorageSkillFileNode } from '../../storage/types';
import { publishSkillFromFiles } from './publish';

const skillMd = `---
name: compatible-skill
description: A compatibility fixture
---
# Compatible Skill`;
const reference = '# Reference';
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

async function readWithPrePrDecoder(tree: SkillVersionTree, path: string, blobStore: BlobStore) {
  const entry = tree.entries[path];
  if (!entry) throw new Error(`Missing tree entry: ${path}`);
  const blob = await blobStore.get(entry.blobHash);
  if (!blob) throw new Error(`Missing blob: ${entry.blobHash}`);

  // Freeze the decoder used before this PR. Do not replace this with VersionedSkillSource:
  // this test protects rolling deployments and downgrades where an old process reads a new tree.
  return entry.encoding === 'base64' ? Buffer.from(blob.content, 'base64') : blob.content;
}

function storedSnapshot(): StorageSkillFileNode[] {
  return [
    { name: 'SKILL.md', type: 'file', content: skillMd },
    {
      name: 'references',
      type: 'folder',
      children: [{ name: 'guide.md', type: 'file', content: reference }],
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
}

describe('published skill mixed-version compatibility', () => {
  it('emits text and binary artifacts readable by the pre-PR decoder', async () => {
    const blobStore = new InMemoryBlobStore();
    const published = await publishSkillFromFiles(storedSnapshot(), blobStore);

    const skillEntry = published.tree.entries['SKILL.md']!;
    const referenceEntry = published.tree.entries['references/guide.md']!;
    const binaryEntry = published.tree.entries['assets/logo.png']!;

    expect(skillEntry.encoding).toBeUndefined();
    expect(referenceEntry.encoding).toBeUndefined();
    expect(binaryEntry.encoding).toBe('base64');
    expect(await blobStore.get(skillEntry.blobHash)).toMatchObject({ content: skillMd });
    expect(await blobStore.get(referenceEntry.blobHash)).toMatchObject({ content: reference });
    expect(await blobStore.get(binaryEntry.blobHash)).toMatchObject({ content: png.toString('base64') });

    await expect(readWithPrePrDecoder(published.tree, 'SKILL.md', blobStore)).resolves.toBe(skillMd);
    await expect(readWithPrePrDecoder(published.tree, 'references/guide.md', blobStore)).resolves.toBe(reference);
    await expect(readWithPrePrDecoder(published.tree, 'assets/logo.png', blobStore)).resolves.toEqual(png);
  });

  it('keeps a new text tree readable by the pre-PR decoder when its legacy row already exists', async () => {
    const blobStore = new InMemoryBlobStore();
    const hash = sha256(skillMd);
    await blobStore.put({
      hash,
      content: skillMd,
      size: Buffer.byteLength(skillMd, 'utf-8'),
      mimeType: 'text/markdown',
      createdAt: new Date('2024-01-01'),
    });

    const published = await publishSkillFromFiles(storedSnapshot(), blobStore);

    expect(published.tree.entries['SKILL.md']).toMatchObject({ blobHash: hash });
    expect(published.tree.entries['SKILL.md']?.encoding).toBeUndefined();
    expect(await blobStore.get(hash)).toMatchObject({ content: skillMd });
    await expect(readWithPrePrDecoder(published.tree, 'SKILL.md', blobStore)).resolves.toBe(skillMd);
  });
});

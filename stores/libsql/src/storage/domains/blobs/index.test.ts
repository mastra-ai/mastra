import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createClient } from '@libsql/client';
import type { SkillVersionTree, StorageSkillFileNode } from '@mastra/core/storage';
import { publishSkillFromFiles, VersionedSkillSource } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BlobsLibSQL } from '.';

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
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

  it('preserves legacy blobs when a canonical republish contains unchanged files', async () => {
    const skillMd = '---\nname: legacy-skill\ndescription: Legacy skill\n---\n\n# Legacy skill';
    const oldReference = '# Old reference';
    const changedReference = '# Changed reference';
    const skillMdHash = sha256(skillMd);
    const oldReferenceHash = sha256(oldReference);
    const changedReferenceHash = sha256(changedReference);
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
    ];

    await publishSkillFromFiles(files, blobStore);

    expect(await blobStore.get(skillMdHash)).toMatchObject({ content: skillMd });
    expect(await blobStore.get(oldReferenceHash)).toMatchObject({ content: oldReference });
    expect(await blobStore.get(changedReferenceHash)).toMatchObject({
      content: Buffer.from(changedReference, 'utf-8').toString('base64'),
    });

    const oldVersion = new VersionedSkillSource(legacyTree, blobStore, createdAt);
    await expect(oldVersion.readFile('SKILL.md')).resolves.toBe(skillMd);
    await expect(oldVersion.readFile('references/guide.md')).resolves.toBe(oldReference);
  });
});

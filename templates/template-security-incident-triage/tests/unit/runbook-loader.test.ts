import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { chunkRunbook } from '../../src/mastra/knowledge/chunker.js';
import { loadRunbook, loadRunbooks } from '../../src/mastra/knowledge/loader.js';

const temporaryDirectories: string[] = [];
const runbookRoot = resolve(process.cwd(), 'runbooks');

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true })));
});

describe('runbook loader and chunking', () => {
  it('validates the checked-in runbooks and produces stable isolated chunks', async () => {
    const runbooks = await loadRunbooks(runbookRoot);
    expect(runbooks.map(runbook => runbook.metadata.id).sort()).toEqual([
      'RB-IDENTITY-001',
      'RB-IDENTITY-002',
      'RB-IDENTITY-003',
    ]);
    for (const runbook of runbooks) {
      const generation = {
        generationId: 'generation-stable',
        indexName: 'rb_test_stable',
      };
      const first = await chunkRunbook(runbook, generation);
      const second = await chunkRunbook(runbook, generation);
      expect(second).toEqual(first);
      expect(first).toHaveLength(9);
      expect(new Set(first.map(chunk => chunk.id)).size).toBe(first.length);
      expect(first.every(chunk => chunk.text.startsWith('## '))).toBe(true);
      expect(first.map(chunk => chunk.metadata.sectionOrdinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  });

  it('accepts a product-owned identifier and owner without a fixed catalog', async () => {
    const directory = await makeDirectory();
    const original = await readFile(join(runbookRoot, 'unauthorized-privilege-change.md'), 'utf8');
    await writeFile(
      join(directory, 'custom-role-change.md'),
      original
        .replace('id: RB-IDENTITY-001', 'id: RB-CUSTOM-ROLE-CHANGE')
        .replace('owner: security', 'owner: identity-platform'),
    );

    const [runbook] = await loadRunbooks(directory);
    expect(runbook?.metadata).toMatchObject({
      id: 'RB-CUSTOM-ROLE-CHANGE',
      owner: 'identity-platform',
      incidentKinds: ['unauthorized_privilege_change'],
    });
  });

  it('rejects more than one active authority for the same incident kind', async () => {
    const directory = await makeDirectory();
    const original = await readFile(join(runbookRoot, 'unauthorized-privilege-change.md'), 'utf8');
    await writeFile(join(directory, 'primary.md'), original);
    await writeFile(
      join(directory, 'competing.md'),
      original.replace('id: RB-IDENTITY-001', 'id: RB-COMPETING-AUTHORITY'),
    );

    await expect(loadRunbooks(directory)).rejects.toMatchObject({
      code: 'RUNBOOK_VALIDATION_FAILED',
    });
  });

  it.each([
    ['duplicate field', (value: string) => value.replace('owner: security', 'owner: security\nowner: security')],
    ['unknown field', (value: string) => value.replace('owner: security', 'owner: security\ncapability: shell')],
    ['YAML alias', (value: string) => value.replace('owner: security', 'owner: &owner security')],
    ['YAML merge key', (value: string) => value.replace('owner: security', '<<: owner')],
    ['noncanonical SemVer', (value: string) => value.replace('version: 1.0.0', 'version: 1.0.0-rc.1')],
    ['CRLF', (value: string) => value.replaceAll('\n', '\r\n')],
    ['missing section', (value: string) => value.replace('## Severity Rules', '### Severity Rules')],
    [
      'wrong kind',
      (value: string) =>
        value.replace('Incident kind: `unauthorized_privilege_change`', 'Incident kind: `unknown_device_login`'),
    ],
    ['unknown allowed action', (value: string) => value.replace('`restore_previous_role`', '`delete_account`')],
    ['unsafe link', (value: string) => value.replace('Confirm tenant', '[Confirm](javascript:alert) tenant')],
    ['duplicate section', (value: string) => `${value}\n## Purpose and Preconditions\nextra\n`],
  ])('rejects %s before chunking', async (_name, mutate) => {
    const directory = await makeDirectory();
    const original = await readFile(join(runbookRoot, 'unauthorized-privilege-change.md'), 'utf8');
    await writeFile(join(directory, 'unauthorized-privilege-change.md'), mutate(original));
    await expect(loadRunbook(directory, 'unauthorized-privilege-change.md')).rejects.toMatchObject({
      code: 'RUNBOOK_VALIDATION_FAILED',
    });
  });

  it('rejects oversized content, path traversal and symlinks', async () => {
    const directory = await makeDirectory();
    const originalPath = join(runbookRoot, 'unauthorized-privilege-change.md');
    await writeFile(join(directory, 'good.md'), await readFile(originalPath, 'utf8'));
    await writeFile(join(directory, 'large.md'), Buffer.alloc(65_537, 0x61));
    await symlink(join(directory, 'good.md'), join(directory, 'linked.md'));
    await expect(loadRunbook(directory, 'large.md')).rejects.toMatchObject({
      code: 'RUNBOOK_VALIDATION_FAILED',
    });
    await expect(loadRunbook(directory, '../unauthorized-privilege-change.md')).rejects.toMatchObject({
      code: 'RUNBOOK_VALIDATION_FAILED',
    });
    await expect(loadRunbook(directory, 'linked.md')).rejects.toMatchObject({
      code: 'RUNBOOK_VALIDATION_FAILED',
    });
  });

  it('rejects BOM, NUL and invalid UTF-8 bytes', async () => {
    const directory = await makeDirectory();
    const original = await readFile(join(runbookRoot, 'unauthorized-privilege-change.md'));
    for (const [name, bytes] of [
      ['bom.md', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), original])],
      ['nul.md', Buffer.concat([original, Buffer.from([0])])],
      ['invalid.md', Buffer.concat([original, Buffer.from([0xc3, 0x28])])],
    ] as const) {
      await writeFile(join(directory, name), bytes);
      await expect(loadRunbook(directory, name)).rejects.toMatchObject({
        code: 'RUNBOOK_VALIDATION_FAILED',
      });
    }
  });
});

async function makeDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'security-runbooks-'));
  temporaryDirectories.push(directory);
  return directory;
}

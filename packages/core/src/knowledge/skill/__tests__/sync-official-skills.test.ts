import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseArgs, syncOfficialSkills } from '../../../../../../scripts/sync-official-skills';

const sourceRoot = resolve(import.meta.dirname, '../../../../../..');
const temporaryDirectories: string[] = [];

async function createTarget(): Promise<string> {
  const targetRoot = await mkdtemp(join(tmpdir(), 'mastra-skills-sync-'));
  temporaryDirectories.push(targetRoot);
  await writeFile(join(targetRoot, 'README.md'), '# Mastra skills\n', { flag: 'w' });
  await mkdir(join(targetRoot, 'skills/mastra'), { recursive: true });
  await writeFile(
    join(targetRoot, 'skills/mastra/SKILL.md'),
    '---\nname: mastra\ndescription: Mastra framework guidance.\n---\n\n# Mastra\n',
  );
  return targetRoot;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('official Knowledge skill synchronization', () => {
  it('defaults the source root when the CLI omits --source', () => {
    expect(parseArgs(['--target', '/tmp/skills'])).toMatchObject({
      sourceRoot: process.cwd(),
      targetRoot: '/tmp/skills',
      check: false,
      release: false,
    });
    expect(parseArgs(['--target', '/tmp/skills', '--release']).release).toBe(true);
    expect(() => parseArgs(['--target', '--check'])).toThrow('--target requires a value');
  });

  it('keeps the embedded skill loader-valid with resolvable references', async () => {
    const skillPath = join(sourceRoot, 'packages/core/src/knowledge/skill/SKILL.md');
    const skill = await readFile(skillPath, 'utf8');
    expect(skill).toMatch(/^---\nname: mastra-knowledge\ndescription: .+\nmetadata:/);

    const links = [...skill.matchAll(/\]\((\.\/references\/[^)]+)\)/g)].map(match => match[1]!);
    expect(links).toHaveLength(7);
    await expect(
      Promise.all(links.map(link => readFile(resolve(dirname(skillPath), link), 'utf8'))),
    ).resolves.toHaveLength(7);
  });

  it('writes deterministic provenance and detects drift', async () => {
    const targetRoot = await createTarget();
    const options = {
      sourceRoot,
      targetRoot,
      check: false,
      sourceCommit: '0123456789abcdef0123456789abcdef01234567',
      sourceDate: '2026-09-03T00:00:00Z',
    };

    await syncOfficialSkills(options);
    const referencePath = join(targetRoot, 'skills/mastra/references/knowledge.md');
    const first = await readFile(referencePath, 'utf8');
    expect(first).toContain('source-commit: 0123456789abcdef0123456789abcdef01234567');
    expect(first).toContain('source-date: 2026-09-03T00:00:00Z');
    expect(first).toContain('# Access and scopes');
    const anchors = new Set(
      [...first.matchAll(/^#+\s+(.+)$/gm)].map(match =>
        match[1]!
          .toLowerCase()
          .replaceAll(/[^a-z0-9 -]/g, '')
          .replaceAll(/\s+/g, '-'),
      ),
    );
    const localLinks = [...first.matchAll(/\]\(#([^)]+)\)/g)].map(match => match[1]!);
    expect(localLinks.length).toBeGreaterThan(0);
    expect(localLinks.every(anchor => anchors.has(anchor))).toBe(true);
    expect(await readFile(join(targetRoot, 'skills/mastra/SKILL.md'), 'utf8')).toContain(
      '[Knowledge](references/knowledge.md)',
    );

    await syncOfficialSkills({ ...options, check: true });
    await writeFile(referencePath, `${first}\ndrift\n`);
    await expect(syncOfficialSkills(options)).rejects.toThrow(
      'Refusing to overwrite a manually edited official Knowledge reference',
    );
    await expect(syncOfficialSkills({ ...options, check: true })).rejects.toThrow('Official skill drift detected');
  });
});

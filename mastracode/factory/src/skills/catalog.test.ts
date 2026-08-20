import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isInlineSkill } from '@mastra/core/skills';
import { afterEach, describe, expect, it } from 'vitest';

import {
  FACTORY_SKILL_NAMES,
  createFactorySkillCatalog,
  loadFactorySkillCatalog,
  type FactorySkillCatalog,
} from './catalog.js';

const temporaryDirectories: string[] = [];

async function temporarySkillRoot(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'factory-skills-'));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeSkill(
  root: string,
  name: string,
  options: { frontmatter?: string; instructions?: string; references?: Record<string, string> } = {},
): Promise<void> {
  const directory = join(root, name);
  await mkdir(directory, { recursive: true });
  const frontmatter =
    options.frontmatter ??
    `name: ${name}\ndescription: ${name} description\nlicense: MIT\ncompatibility: Mastra Factory\nuser-invocable: true\nmetadata:\n  owner: factory`;
  await writeFile(join(directory, 'SKILL.md'), `---\n${frontmatter}\n---\n\n${options.instructions ?? `# ${name}`}\n`);
  for (const [referencePath, content] of Object.entries(options.references ?? {})) {
    const absolutePath = join(directory, 'references', referencePath);
    await mkdir(join(absolutePath, '..'), { recursive: true });
    await writeFile(absolutePath, content);
  }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('Factory skill catalog', () => {
  it('loads all bundled Factory skills as one immutable inline catalog', async () => {
    const catalog = await loadFactorySkillCatalog();

    expect(catalog.skills).toHaveLength(FACTORY_SKILL_NAMES.size);
    expect(catalog.list).toHaveLength(FACTORY_SKILL_NAMES.size);
    expect(catalog.skills.every(isInlineSkill)).toBe(true);
    expect(catalog.skills.map(skill => skill.name).sort()).toEqual([...FACTORY_SKILL_NAMES].sort());
    expect(catalog.get('factory-triage')).toBe(catalog.skills.find(skill => skill.name === 'factory-triage'));
    expect(catalog.get('factory-triage')?.instructions).toContain('# Factory Triage');
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.skills)).toBe(true);
    expect(Object.isFrozen(catalog.list)).toBe(true);
  });

  it('preserves supported frontmatter and reference contents', async () => {
    const root = await temporarySkillRoot();
    await writeSkill(root, 'factory-test', {
      instructions: '# Test instructions',
      references: { 'nested/checklist.md': '# Checklist' },
    });

    const catalog = await loadFactorySkillCatalog({ sourcePath: root, names: ['factory-test'] });
    const skill = catalog.get('factory-test')!;

    expect(skill).toMatchObject({
      name: 'factory-test',
      description: 'factory-test description',
      instructions: '# Test instructions',
      license: 'MIT',
      compatibility: 'Mastra Factory',
      'user-invocable': true,
      metadata: { owner: 'factory' },
      references: ['nested/checklist.md'],
    });
    expect(skill.__referenceContents).toEqual({ 'nested/checklist.md': '# Checklist' });
  });

  it('names the missing or malformed bundled asset in startup errors', async () => {
    const root = await temporarySkillRoot();

    await expect(loadFactorySkillCatalog({ sourcePath: root, names: ['factory-missing'] })).rejects.toThrow(
      'Invalid bundled Factory skill "factory-missing"',
    );

    await writeSkill(root, 'factory-malformed', { frontmatter: 'description: missing name' });
    await expect(loadFactorySkillCatalog({ sourcePath: root, names: ['factory-malformed'] })).rejects.toThrow(
      'Invalid bundled Factory skill "factory-malformed"',
    );
  });

  it('rejects duplicate names and keeps lookup stable after mutation attempts', async () => {
    const root = await temporarySkillRoot();
    await writeSkill(root, 'factory-one');
    const skill = (await loadFactorySkillCatalog({ sourcePath: root, names: ['factory-one'] })).skills[0]!;

    expect(() => createFactorySkillCatalog([skill, skill])).toThrow('Duplicate bundled Factory skill "factory-one".');

    const catalog: FactorySkillCatalog = createFactorySkillCatalog([skill]);
    expect(() => catalog.skills.push(skill)).toThrow();
    expect(() => catalog.list.push({ name: 'other', description: 'other', content: 'other' })).toThrow();
    expect(catalog.get('factory-one')).toBe(skill);
  });
});

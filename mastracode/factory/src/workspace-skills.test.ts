import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalSkillSource, Workspace } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUNDLED_FACTORY_SKILLS_PATH, FactorySkillSource, resolveLocalFactorySkillsPath } from './workspace.js';

describe('deployed Factory skills', () => {
  let consumerRoot: string | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (consumerRoot) await rm(consumerRoot, { recursive: true, force: true });
  });

  it('serves custom build-output contents over installed bundled skills from the parent cwd (#27189)', async () => {
    consumerRoot = await mkdtemp(path.join(tmpdir(), 'factory-deployed-skills-'));
    const skillsRoot = path.join(consumerRoot, 'output', 'factory-skills');
    const customTriage =
      '---\nname: factory-triage\ndescription: Project triage\n---\nFollow the project triage rules.\n';
    for (const name of ['factory-triage', 'factory-review', 'project-skill']) {
      await mkdir(path.join(skillsRoot, name), { recursive: true });
      await writeFile(
        path.join(skillsRoot, name, 'SKILL.md'),
        customTriage.replace('name: factory-triage', `name: ${name}`),
      );
    }
    // Factory remains installed separately, with its own stock instructions.
    expect(BUNDLED_FACTORY_SKILLS_PATH.startsWith(consumerRoot)).toBe(false);
    const bundled = new LocalSkillSource({ basePath: BUNDLED_FACTORY_SKILLS_PATH });
    expect(String(await bundled.readFile('factory-triage/SKILL.md'))).not.toBe(customTriage);
    vi.spyOn(process, 'cwd').mockReturnValue(consumerRoot);

    const source = new FactorySkillSource(
      new LocalSkillSource({ basePath: consumerRoot }),
      [],
      undefined,
      async () => false,
    );
    const mount = path.resolve(path.parse(consumerRoot).root, '__mastracode_factory_skills__');
    expect(String(await source.readFile(path.join(mount, 'factory-triage', 'SKILL.md')))).toBe(customTriage);
    const names = (await source.readdir(mount)).map(entry => entry.name);
    expect(names).toContain('project-skill');
    const workspace = new Workspace({ skillSource: source, skills: [mount] });
    await expect(workspace.skills?.get('project-skill')).resolves.toMatchObject({
      name: 'project-skill',
      instructions: 'Follow the project triage rules.',
    });
    expect(names.filter(name => name === 'factory-triage')).toHaveLength(1);
    expect(names).toContain('factory-plan');
    expect(names).not.toContain('factory-review');
    await expect(source.readFile(path.join(mount, 'factory-review', 'SKILL.md'))).rejects.toThrow('ENOENT');
    expect(String(await source.readFile(path.join(mount, 'factory-plan', 'SKILL.md')))).toContain('# Factory Plan');
  });

  it('keeps development candidates ahead of build output in their existing order', async () => {
    consumerRoot = await mkdtemp(path.join(tmpdir(), 'factory-skills-precedence-'));
    const candidates = [
      path.join(consumerRoot, 'src', 'mastra', 'public', 'factory-skills'),
      path.join(consumerRoot, 'public', 'factory-skills'),
      path.join(consumerRoot, 'factory-skills'),
      path.join(consumerRoot, 'output', 'factory-skills'),
    ];
    for (const candidate of candidates) await mkdir(candidate, { recursive: true });
    for (const candidate of candidates) {
      expect(resolveLocalFactorySkillsPath(consumerRoot)).toBe(candidate);
      await rm(candidate, { recursive: true });
    }
    expect(resolveLocalFactorySkillsPath(consumerRoot)).toBeUndefined();
  });
});

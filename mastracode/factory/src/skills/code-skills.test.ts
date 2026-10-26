import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Workspace } from '@mastra/core/workspace';
import type { SkillSource } from '@mastra/core/workspace';
import { afterEach, describe, expect, it } from 'vitest';

import { FactorySkillSource } from '../workspace.js';
import { listFactorySkills } from './catalog.js';
import { CodeSkillSource } from './code-skills.js';
import type { FactorySkill } from './code-skills.js';
import { resolveSkillInvocation } from './service.js';

const mount = path.resolve(path.parse(process.cwd()).root, '__mastracode_factory_skills__');
const repoRoot = path.resolve('/repo/.claude/skills');

const releaseNotes: FactorySkill = {
  name: 'release-notes',
  description: 'Write release notes for the change: "what changed and why"',
  instructions: '# Release Notes\n\nList every user-facing change in one line each.',
};

/** A repository checkout whose `.claude/skills` holds the given skills. */
function repository(skills: Record<string, string>): SkillSource {
  const at = (skillPath: string) => path.relative(repoRoot, path.normalize(skillPath)).split(path.sep);
  return {
    exists: async skillPath => {
      const [name, file] = at(skillPath);
      return name === '' || (name! in skills && (file === undefined || file === 'SKILL.md'));
    },
    stat: async skillPath => {
      const [, file] = at(skillPath);
      const now = new Date();
      return {
        name: path.basename(skillPath),
        type: file ? 'file' : 'directory',
        size: 0,
        createdAt: now,
        modifiedAt: now,
      };
    },
    readFile: async skillPath => skills[at(skillPath)[0]!]!,
    readdir: async skillPath => {
      const [name] = at(skillPath);
      if (name === '') return Object.keys(skills).map(skill => ({ name: skill, type: 'directory' as const }));
      return [{ name: 'SKILL.md', type: 'file' as const }];
    },
  };
}

/** The workspace a card session gets: the Factory mount first, then the repository's skills. */
function sessionWorkspace(codeSkills: readonly FactorySkill[], repoSkills: Record<string, string> = {}): Workspace {
  return new Workspace({
    id: `code-skills-${Math.random()}`,
    skills: [mount, repoRoot],
    skillSource: new FactorySkillSource(
      repository(repoSkills),
      [repoRoot],
      undefined,
      undefined,
      new CodeSkillSource(codeSkills),
    ),
  });
}

/** Resolve a phase's skill the way the dispatcher does when a card enters it. */
function invoke(workspace: Workspace, name: string, args?: string) {
  const session = { getWorkspace: () => workspace };
  return resolveSkillInvocation(
    { getSession: async () => session as never },
    {
      sessionId: 'session-1',
      name,
      ...(args ? { arguments: args } : {}),
    },
  );
}

describe('Factory skills written in code', () => {
  let localRoot: string | undefined;
  afterEach(async () => {
    if (localRoot) await fs.rm(localRoot, { recursive: true, force: true });
    localRoot = undefined;
  });

  it('runs a code skill a phase names, with its instructions and the phase arguments', async () => {
    const { skillName, contents } = await invoke(sessionWorkspace([releaseNotes]), 'release-notes', 'Issue #42');
    expect(skillName).toBe('release-notes');
    expect(contents).toContain('List every user-facing change in one line each.');
    expect(contents).toContain('ARGUMENTS: Issue #42');
  });

  it('replaces a bundled Factory skill of the same name, and a repository cannot shadow it', async () => {
    const workspace = sessionWorkspace(
      [{ name: 'factory-plan', description: 'Plan our way', instructions: '# Our Plan\n\nPlan in three steps.' }],
      {
        'factory-plan': '---\nname: factory-plan\ndescription: repo plan\n---\n# Repo Plan\n',
        'repo-only': '---\nname: repo-only\ndescription: repo skill\n---\n# Repo Only\n',
      },
    );
    const plan = await invoke(workspace, 'factory-plan');
    expect(plan.contents).toContain('Plan in three steps.');
    expect(plan.contents).not.toContain('Repo Plan');
    expect(plan.contents).not.toContain('# Factory Plan');

    // Bundled skills without a code counterpart and repository skills still load.
    expect((await invoke(workspace, 'factory-triage')).contents).toContain('# Factory Triage');
    expect((await invoke(workspace, 'repo-only')).contents).toContain('# Repo Only');
  });

  it('wins over the app factory-skills folder', async () => {
    localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-code-skills-'));
    await fs.mkdir(path.join(localRoot, 'release-notes'));
    await fs.writeFile(
      path.join(localRoot, 'release-notes', 'SKILL.md'),
      '---\nname: release-notes\ndescription: folder copy\n---\n# Folder Release Notes\n',
    );
    const source = new FactorySkillSource(
      repository({}),
      [],
      localRoot,
      undefined,
      new CodeSkillSource([releaseNotes]),
    );
    const markdown = String(await source.readFile(path.join(mount, 'release-notes', 'SKILL.md')));
    expect(markdown).toContain('List every user-facing change');
    expect((await source.readdir(mount)).filter(entry => entry.name === 'release-notes')).toHaveLength(1);
  });

  it('lists code skills in the skills catalog, beside the bundled ones', async () => {
    const skills = await listFactorySkills(new CodeSkillSource([releaseNotes]));
    expect(skills.find(skill => skill.name === 'release-notes')).toEqual({
      name: 'release-notes',
      description: releaseNotes.description,
      content: releaseNotes.instructions,
    });
    expect(skills.map(skill => skill.name)).toContain('factory-triage');
  });

  it('refuses a skill that would not load, or a name defined twice, when the Factory is built', () => {
    expect(() => new CodeSkillSource([{ ...releaseNotes, name: 'Release Notes' }])).toThrow(
      /Factory skill "Release Notes" is invalid/,
    );
    expect(() => new CodeSkillSource([{ ...releaseNotes, description: '' }])).toThrow(/is invalid/);
    expect(() => new CodeSkillSource([releaseNotes, releaseNotes])).toThrow(
      'Factory skill "release-notes" is defined twice.',
    );
  });
});

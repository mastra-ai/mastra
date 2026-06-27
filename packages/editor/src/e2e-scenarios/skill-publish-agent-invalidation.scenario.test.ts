import { describe, expect, it } from 'vitest';
import type { SkillSource, SkillSourceEntry, SkillSourceStat } from '@mastra/core/workspace';
import { createEditorScenarioMastra } from './editor-scenario-utils';

function createMockSkillSource(files: Record<string, string>): SkillSource {
  const dirs = new Set<string>(['']);
  for (const filePath of Object.keys(files)) {
    const parts = filePath.split('/');
    for (let i = 1; i <= parts.length - 1; i++) dirs.add(parts.slice(0, i).join('/'));
  }

  const normalize = (path: string) => path.replace(/^\.\//, '').replace(/^\//, '');

  return {
    exists: async path => files[normalize(path)] !== undefined || dirs.has(normalize(path)),
    stat: async path => {
      const normalized = normalize(path);
      if (files[normalized] !== undefined) {
        return {
          name: normalized.split('/').pop()!,
          type: 'file',
          size: new TextEncoder().encode(files[normalized]).length,
          createdAt: new Date(),
          modifiedAt: new Date(),
        } satisfies SkillSourceStat;
      }
      if (dirs.has(normalized)) {
        return {
          name: normalized.split('/').pop() || normalized,
          type: 'directory',
          size: 0,
          createdAt: new Date(),
          modifiedAt: new Date(),
        } satisfies SkillSourceStat;
      }
      throw new Error(`Not found: ${path}`);
    },
    readFile: async path => {
      const normalized = normalize(path);
      const content = files[normalized];
      if (content === undefined) throw new Error(`Not found: ${path}`);
      return content;
    },
    readdir: async path => {
      const normalized = normalize(path);
      const prefix = normalized === '' ? '' : `${normalized}/`;
      const entries = new Map<string, 'file' | 'directory'>();
      for (const filePath of Object.keys(files)) {
        if (!filePath.startsWith(prefix)) continue;
        const rest = filePath.slice(prefix.length);
        const slashIndex = rest.indexOf('/');
        entries.set(slashIndex === -1 ? rest : rest.slice(0, slashIndex), slashIndex === -1 ? 'file' : 'directory');
      }
      return Array.from(entries).map(([name, type]) => ({ name, type }) satisfies SkillSourceEntry);
    },
  };
}

function skillMd(name: string, body: string) {
  return `---\nname: ${name}\ndescription: Scenario skill\n---\n\n${body}`;
}

describe('editor e2e scenario: skill publish invalidates referencing agents', () => {
  it('evicts cached agents that reference a skill when that skill is republished', async () => {
    // USER STORY: A Studio user publishes a new skill version and agents using the latest skill should reload from the updated active version.
    // ARRANGE
    const { editor, storage } = createEditorScenarioMastra();
    await editor.skill.create({
      id: 'scenario-skill',
      name: 'scenario-skill',
      description: 'Scenario skill',
      instructions: 'Initial instructions',
    });
    await editor.skill.publish(
      'scenario-skill',
      createMockSkillSource({ 'scenario-skill/SKILL.md': skillMd('scenario-skill', 'First published instructions') }),
      'scenario-skill',
    );

    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'skill-consuming-agent',
        name: 'Skill consuming agent',
        instructions: 'Use the latest skill.',
        model: { provider: 'mock', name: 'editor-scenario' },
        skills: { 'scenario-skill': { strategy: 'latest' } },
        workspace: { type: 'inline', config: { name: 'Skill Workspace', skills: ['scenario-skill'] } },
      },
    });
    const firstRuntimeAgent = await editor.agent.getById('skill-consuming-agent');

    // ACT
    const republished = await editor.skill.publish(
      'scenario-skill',
      createMockSkillSource({ 'scenario-skill/SKILL.md': skillMd('scenario-skill', 'Second published instructions') }),
      'scenario-skill',
    );
    const secondRuntimeAgent = await editor.agent.getById('skill-consuming-agent');
    const latestVersion = await (await storage.getStore('skills'))!.getLatestVersion('scenario-skill');

    // ASSERT
    expect(secondRuntimeAgent).not.toBe(firstRuntimeAgent);
    expect(republished.instructions).toContain('Second published instructions');
    expect(latestVersion?.id).toBe(republished.activeVersionId);
  });
});

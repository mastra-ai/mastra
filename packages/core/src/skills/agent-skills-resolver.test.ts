import { describe, it, expect } from 'vitest';

import { resolveAgentSkills } from './agent-skills-resolver';
import { defineSkill } from './define-skill';

describe('resolveAgentSkills', () => {
  it('creates WorkspaceSkills from inline skills', async () => {
    const skill = defineSkill({
      name: 'test-skill',
      description: 'A test skill.',
      instructions: 'Do the thing.',
    });

    const ws = resolveAgentSkills([skill]);

    const list = await ws.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe('test-skill');
    expect(list[0]!.description).toBe('A test skill.');
    expect(list[0]!.path).toBe('inline/test-skill');
  });

  it('creates WorkspaceSkills from multiple inline skills', async () => {
    const skill1 = defineSkill({
      name: 'skill-one',
      description: 'First skill.',
      instructions: 'Do step one.',
    });

    const skill2 = defineSkill({
      name: 'skill-two',
      description: 'Second skill.',
      instructions: 'Do step two.',
    });

    const ws = resolveAgentSkills([skill1, skill2]);

    const list = await ws.list();
    expect(list).toHaveLength(2);
    const names = list.map(s => s.name).sort();
    expect(names).toEqual(['skill-one', 'skill-two']);
  });

  it('resolves skill details via get()', async () => {
    const skill = defineSkill({
      name: 'detail-skill',
      description: 'Skill with details.',
      instructions: '# Detailed\nDo this and that.',
      references: {
        'example.md': '# Example Reference',
      },
    });

    const ws = resolveAgentSkills([skill]);

    const resolved = await ws.get('detail-skill');
    expect(resolved).not.toBeNull();
    expect(resolved!.name).toBe('detail-skill');
    expect(resolved!.instructions).toBe('# Detailed\nDo this and that.');
    expect(resolved!.references).toEqual(['example.md']);
  });

  it('resolves skill details via get() using path', async () => {
    const skill = defineSkill({
      name: 'path-skill',
      description: 'Skill accessible by path.',
      instructions: 'Follow these steps.',
    });

    const ws = resolveAgentSkills([skill]);

    const resolved = await ws.get('inline/path-skill');
    expect(resolved).not.toBeNull();
    expect(resolved!.name).toBe('path-skill');
  });

  it('returns null for non-existent skills', async () => {
    const skill = defineSkill({
      name: 'only-skill',
      description: 'The only skill.',
      instructions: 'Do it.',
    });

    const ws = resolveAgentSkills([skill]);

    const resolved = await ws.get('nonexistent');
    expect(resolved).toBeNull();
  });

  it('supports has() check', async () => {
    const skill = defineSkill({
      name: 'check-skill',
      description: 'Checkable skill.',
      instructions: 'Check this.',
    });

    const ws = resolveAgentSkills([skill]);

    expect(await ws.has('check-skill')).toBe(true);
    expect(await ws.has('nonexistent')).toBe(false);
  });

  it('retrieves reference content', async () => {
    const skill = defineSkill({
      name: 'ref-skill',
      description: 'Skill with references.',
      instructions: 'See references.',
      references: {
        'guide.md': '# Style Guide\nUse consistent naming.',
      },
    });

    const ws = resolveAgentSkills([skill]);

    const refContent = await ws.getReference('ref-skill', 'references/guide.md');
    expect(refContent).toBe('# Style Guide\nUse consistent naming.');
  });

  it('handles empty skills array', async () => {
    const ws = resolveAgentSkills([]);
    const list = await ws.list();
    expect(list).toHaveLength(0);
  });
});

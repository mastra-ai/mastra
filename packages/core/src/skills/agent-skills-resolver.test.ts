import { describe, it, expect } from 'vitest';

import { mergeWorkspaceSkills, resolveAgentSkills } from './agent-skills-resolver';
import { createSkill } from './create-skill';

describe('resolveAgentSkills', () => {
  it('creates WorkspaceSkills from inline skills', async () => {
    const skill = createSkill({
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
    const skill1 = createSkill({
      name: 'skill-one',
      description: 'First skill.',
      instructions: 'Do step one.',
    });

    const skill2 = createSkill({
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
    const skill = createSkill({
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
    const skill = createSkill({
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
    const skill = createSkill({
      name: 'only-skill',
      description: 'The only skill.',
      instructions: 'Do it.',
    });

    const ws = resolveAgentSkills([skill]);

    const resolved = await ws.get('nonexistent');
    expect(resolved).toBeNull();
  });

  it('supports has() check', async () => {
    const skill = createSkill({
      name: 'check-skill',
      description: 'Checkable skill.',
      instructions: 'Check this.',
    });

    const ws = resolveAgentSkills([skill]);

    expect(await ws.has('check-skill')).toBe(true);
    expect(await ws.has('nonexistent')).toBe(false);
  });

  it('retrieves reference content', async () => {
    const skill = createSkill({
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

  it('uses ranked BM25 search for agent skills', async () => {
    const ws = resolveAgentSkills([
      createSkill({
        name: 'deploy-checklist',
        description: 'General deployment checklist.',
        instructions: 'Review the deployment checklist before making changes.',
      }),
      createSkill({
        name: 'production-deploy',
        description: 'Production deployment guide.',
        instructions: 'Deploy services safely to production. Validate the production deployment before release.',
      }),
    ]);

    const results = await ws.search('deployment production', { topK: 1 });

    expect(results).toHaveLength(1);
    expect(results[0]?.skillName).toBe('production-deploy');
    expect(results[0]?.score).toBeGreaterThan(0);
    expect(results[0]?.scoreDetails?.bm25).toBeDefined();
  });

  it('indexes agent skill references for BM25 search', async () => {
    const ws = resolveAgentSkills([
      createSkill({
        name: 'incident-response',
        description: 'Respond to incidents.',
        instructions: 'Follow the operational runbook.',
        references: {
          'runbook.md': 'Incident response steps and escalation procedures for the on-call engineer.',
        },
      }),
    ]);

    const results = await ws.search('incident escalation');

    expect(results[0]?.skillName).toBe('incident-response');
    expect(results[0]?.source).toBe('references/runbook.md');
    expect(results[0]?.scoreDetails?.bm25).toBeDefined();
  });

  it('handles empty skills array', async () => {
    const ws = resolveAgentSkills([]);
    const list = await ws.list();
    expect(list).toHaveLength(0);
  });
});

describe('mergeWorkspaceSkills', () => {
  it('forwards registerLocationAlias so remapped locations resolve on either side', async () => {
    const agentSkills = resolveAgentSkills([
      createSkill({
        name: 'agent-skill',
        description: 'Agent-level skill.',
        instructions: 'Do agent things.',
      }),
    ]);
    const workspaceSkills = resolveAgentSkills([
      createSkill({
        name: 'workspace-skill',
        description: 'Workspace-level skill.',
        instructions: 'Do workspace things.',
      }),
    ]);

    const { merged } = await mergeWorkspaceSkills(agentSkills, workspaceSkills);

    merged.registerLocationAlias?.('/mnt/bundle/agent-skill/SKILL.md', 'inline/agent-skill');
    merged.registerLocationAlias?.('/mnt/bundle/workspace-skill/SKILL.md', 'inline/workspace-skill');

    const fromPrimary = await merged.get('/mnt/bundle/agent-skill/SKILL.md');
    expect(fromPrimary?.name).toBe('agent-skill');

    const fromSecondary = await merged.get('/mnt/bundle/workspace-skill/SKILL.md');
    expect(fromSecondary?.name).toBe('workspace-skill');
  });
});

import { describe, it, expect, vi } from 'vitest';

import { createSkillTools } from './tools';
import type { Skill, SkillMetadata, SkillSearchResult, WorkspaceSkills } from './types';

// =============================================================================
// Mock WorkspaceSkills
// =============================================================================

function createMockWorkspaceSkills(overrides: Partial<WorkspaceSkills> = {}): WorkspaceSkills {
  return {
    list: vi.fn(async () => []),
    get: vi.fn(async () => null),
    has: vi.fn(async () => false),
    refresh: vi.fn(async () => {}),
    maybeRefresh: vi.fn(async () => {}),
    search: vi.fn(async () => []),
    getReference: vi.fn(async () => null),
    getScript: vi.fn(async () => null),
    getAsset: vi.fn(async () => null),
    listReferences: vi.fn(async () => []),
    listScripts: vi.fn(async () => []),
    listAssets: vi.fn(async () => []),
    ...overrides,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    name: 'test-skill',
    description: 'A test skill',
    path: '/skills/test-skill',
    instructions: '# Test Skill\n\nDo the thing.',
    source: { type: 'local', projectPath: '/skills/test-skill' },
    references: [],
    scripts: [],
    assets: [],
    ...overrides,
  };
}

function makeMetadata(overrides: Partial<SkillMetadata> = {}): SkillMetadata {
  return {
    name: 'test-skill',
    description: 'A test skill',
    path: '/skills/test-skill',
    ...overrides,
  };
}

/** Shorthand for calling tool.execute with an empty context (second arg). */
async function exec(tool: { execute?: (...args: any[]) => any }, input: Record<string, unknown>) {
  return tool.execute!(input, {});
}

// =============================================================================
// createSkillTools (factory)
// =============================================================================

describe('createSkillTools', () => {
  it('returns skill, skill_search, and skill_read tools', () => {
    const skills = createMockWorkspaceSkills();
    const tools = createSkillTools(skills);

    expect(tools).toHaveProperty('skill');
    expect(tools).toHaveProperty('skill_search');
    expect(tools).toHaveProperty('skill_read');
  });
});

// =============================================================================
// skill tool (createSkillTool)
// =============================================================================

describe('skill tool', () => {
  it('returns full instructions for an existing skill', async () => {
    const skill = makeSkill({ instructions: '# Brand Guidelines\n\nUse blue.' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
    });
    const { skill: tool } = createSkillTools(skills);

    const result = await exec(tool, { name: 'brand-guidelines' });

    expect(result).toBe('# Brand Guidelines\n\nUse blue.');
  });

  it('appends references section when skill has references', async () => {
    const skill = makeSkill({
      instructions: 'Do stuff.',
      references: ['colors.md', 'fonts.md'],
    });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
    });
    const { skill: tool } = createSkillTools(skills);

    const result = await exec(tool, { name: 'test-skill' });

    expect(result).toContain('Do stuff.');
    expect(result).toContain('## References');
    expect(result).toContain('- references/colors.md');
    expect(result).toContain('- references/fonts.md');
  });

  it('appends scripts section when skill has scripts', async () => {
    const skill = makeSkill({
      instructions: 'Run scripts.',
      scripts: ['build.sh', 'deploy.sh'],
    });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
    });
    const { skill: tool } = createSkillTools(skills);

    const result = await exec(tool, { name: 'test-skill' });

    expect(result).toContain('## Scripts');
    expect(result).toContain('- scripts/build.sh');
    expect(result).toContain('- scripts/deploy.sh');
  });

  it('appends assets section when skill has assets', async () => {
    const skill = makeSkill({
      instructions: 'Use assets.',
      assets: ['logo.png', 'banner.jpg'],
    });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
    });
    const { skill: tool } = createSkillTools(skills);

    const result = await exec(tool, { name: 'test-skill' });

    expect(result).toContain('## Assets');
    expect(result).toContain('- assets/logo.png');
    expect(result).toContain('- assets/banner.jpg');
  });

  it('appends all sections when skill has references, scripts, and assets', async () => {
    const skill = makeSkill({
      instructions: 'Full skill.',
      references: ['ref.md'],
      scripts: ['run.sh'],
      assets: ['icon.svg'],
    });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
    });
    const { skill: tool } = createSkillTools(skills);

    const result = await exec(tool, { name: 'test-skill' });

    expect(result).toContain('Full skill.');
    expect(result).toContain('## References');
    expect(result).toContain('## Scripts');
    expect(result).toContain('## Assets');
  });

  it('omits sections when skill has no references, scripts, or assets', async () => {
    const skill = makeSkill({ instructions: 'Simple skill.' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
    });
    const { skill: tool } = createSkillTools(skills);

    const result = await exec(tool, { name: 'test-skill' });

    expect(result).toBe('Simple skill.');
    expect(result).not.toContain('## References');
    expect(result).not.toContain('## Scripts');
    expect(result).not.toContain('## Assets');
  });

  it('returns error with available skills list when skill is not found', async () => {
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => null),
      list: vi.fn(async () => [makeMetadata({ name: 'alpha' }), makeMetadata({ name: 'beta' })]),
    });
    const { skill: tool } = createSkillTools(skills);

    const result = await exec(tool, { name: 'nonexistent' });

    expect(result).toBe('Skill "nonexistent" not found. Available skills: alpha, beta');
  });

  it('returns error with empty list when no skills exist', async () => {
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => null),
      list: vi.fn(async () => []),
    });
    const { skill: tool } = createSkillTools(skills);

    const result = await exec(tool, { name: 'nonexistent' });

    expect(result).toBe('Skill "nonexistent" not found. Available skills: ');
  });

  it('resolves skill by exact path', async () => {
    const skill = makeSkill({ name: 'my-skill', path: 'team-a/my-skill', instructions: 'Found by path.' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async (p: string) => (p === 'team-a/my-skill' ? skill : null)),
    });
    const { skill: tool } = createSkillTools(skills);

    const result = await exec(tool, { name: 'team-a/my-skill' });

    expect(result).toBe('Found by path.');
  });

  it('resolves unique name when path match fails', async () => {
    const skill = makeSkill({ name: 'unique-skill', path: 'skills/unique-skill', instructions: 'Found by name.' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async (p: string) => (p === 'skills/unique-skill' ? skill : null)),
      list: vi.fn(async () => [makeMetadata({ name: 'unique-skill', path: 'skills/unique-skill' })]),
    });
    const { skill: tool } = createSkillTools(skills);

    const result = await exec(tool, { name: 'unique-skill' });

    expect(result).toBe('Found by name.');
  });

  it('returns disambiguation when multiple skills share the same name', async () => {
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => null),
      list: vi.fn(async () => [
        makeMetadata({ name: 'plan', path: '.mastra/skills/plan' }),
        makeMetadata({ name: 'plan', path: 'user-skills/plan' }),
      ]),
    });
    const { skill: tool } = createSkillTools(skills);

    const result = await exec(tool, { name: 'plan' });

    expect(result).toContain('Multiple skills named "plan" found');
    expect(result).toContain('.mastra/skills/plan');
    expect(result).toContain('user-skills/plan');
  });
});

// =============================================================================
// skill_search tool (createSkillSearchTool)
// =============================================================================

describe('skill_search tool', () => {
  it('returns "No results found." when search returns empty', async () => {
    const skills = createMockWorkspaceSkills({
      search: vi.fn(async () => []),
    });
    const { skill_search: tool } = createSkillTools(skills);

    const result = await exec(tool, { query: 'something' });

    expect(result).toBe('No results found.');
  });

  it('formats results with skill name, score, and preview', async () => {
    const searchResults: SkillSearchResult[] = [
      {
        skillPath: 'skills/brand-guide',
        source: 'SKILL.md',
        content: 'Use the primary blue color #0066CC for all headings.',
        score: 0.85,
      },
    ];
    const skills = createMockWorkspaceSkills({
      search: vi.fn(async () => searchResults),
    });
    const { skill_search: tool } = createSkillTools(skills);

    const result = await exec(tool, { query: 'blue color' });

    expect(result).toContain('[skills/brand-guide]');
    expect(result).toContain('(score: 0.85)');
    expect(result).toContain('Use the primary blue color #0066CC for all headings.');
  });

  it('includes line range when available', async () => {
    const searchResults: SkillSearchResult[] = [
      {
        skillPath: 'skills/code-review',
        source: 'SKILL.md',
        content: 'Always check for null.',
        score: 0.72,
        lineRange: { start: 10, end: 15 },
      },
    ];
    const skills = createMockWorkspaceSkills({
      search: vi.fn(async () => searchResults),
    });
    const { skill_search: tool } = createSkillTools(skills);

    const result = await exec(tool, { query: 'null checks' });

    expect(result).toContain('(lines 10-15)');
  });

  it('truncates preview at 200 characters with ellipsis', async () => {
    const longContent = 'A'.repeat(250);
    const searchResults: SkillSearchResult[] = [
      {
        skillPath: 'skills/verbose-skill',
        source: 'SKILL.md',
        content: longContent,
        score: 0.5,
      },
    ];
    const skills = createMockWorkspaceSkills({
      search: vi.fn(async () => searchResults),
    });
    const { skill_search: tool } = createSkillTools(skills);

    const result = await exec(tool, { query: 'test' });

    expect(result).toContain('A'.repeat(200) + '...');
    expect(result).not.toContain('A'.repeat(201));
  });

  it('does not add ellipsis when content is 200 chars or fewer', async () => {
    const shortContent = 'B'.repeat(200);
    const searchResults: SkillSearchResult[] = [
      {
        skillPath: 'skills/short-skill',
        source: 'SKILL.md',
        content: shortContent,
        score: 0.6,
      },
    ];
    const skills = createMockWorkspaceSkills({
      search: vi.fn(async () => searchResults),
    });
    const { skill_search: tool } = createSkillTools(skills);

    const result = await exec(tool, { query: 'test' });

    expect(result).toContain('B'.repeat(200));
    expect(result).not.toContain('...');
  });

  it('formats multiple results separated by double newlines', async () => {
    const searchResults: SkillSearchResult[] = [
      { skillPath: 'skills/skill-a', source: 'SKILL.md', content: 'First result.', score: 0.9 },
      { skillPath: 'skills/skill-b', source: 'SKILL.md', content: 'Second result.', score: 0.7 },
    ];
    const skills = createMockWorkspaceSkills({
      search: vi.fn(async () => searchResults),
    });
    const { skill_search: tool } = createSkillTools(skills);

    const result = await exec(tool, { query: 'test' });

    const parts = (result as string).split('\n\n');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('[skills/skill-a]');
    expect(parts[1]).toContain('[skills/skill-b]');
  });

  it('maps skillNames to skillPaths and passes topK to the search function', async () => {
    const searchFn = vi.fn(async () => []);
    const skills = createMockWorkspaceSkills({
      search: searchFn,
      list: vi.fn(async () => [
        makeMetadata({ name: 'brand-guide', path: 'skills/brand-guide' }),
        makeMetadata({ name: 'design-system', path: 'skills/design-system' }),
        makeMetadata({ name: 'other', path: 'skills/other' }),
      ]),
    });
    const { skill_search: tool } = createSkillTools(skills);

    await exec(tool, {
      query: 'color palette',
      skillNames: ['brand-guide', 'design-system'],
      topK: 3,
    });

    expect(searchFn).toHaveBeenCalledWith('color palette', {
      topK: 3,
      skillPaths: ['skills/brand-guide', 'skills/design-system'],
    });
  });
});

// =============================================================================
// skill_read tool (createSkillReadTool)
// =============================================================================

describe('skill_read tool', () => {
  it('returns error when skill does not exist', async () => {
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => null),
      list: vi.fn(async () => []),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'nonexistent', path: 'references/file.md' });

    expect(result).toContain('Skill "nonexistent" not found.');
  });

  it('reads a reference file (resolved by name)', async () => {
    const skill = makeSkill({ name: 'brand-guide', path: 'skills/brand-guide' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async (p: string) => (p === 'skills/brand-guide' ? skill : null)),
      list: vi.fn(async () => [makeMetadata({ name: 'brand-guide', path: 'skills/brand-guide' })]),
      getReference: vi.fn(async () => '# Color Palette\n\nBlue: #0066CC'),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'brand-guide', path: 'references/colors.md' });

    expect(result).toBe('# Color Palette\n\nBlue: #0066CC');
  });

  it('falls through to script reader when reference returns null', async () => {
    const skill = makeSkill({ name: 'deploy-skill', path: 'skills/deploy-skill' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async (p: string) => (p === 'skills/deploy-skill' ? skill : null)),
      list: vi.fn(async () => [makeMetadata({ name: 'deploy-skill', path: 'skills/deploy-skill' })]),
      getReference: vi.fn(async () => null),
      getScript: vi.fn(async () => '#!/bin/bash\necho "hello"'),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'deploy-skill', path: 'scripts/run.sh' });

    expect(result).toBe('#!/bin/bash\necho "hello"');
  });

  it('falls through to asset reader when reference and script return null', async () => {
    const skill = makeSkill({ name: 'my-skill', path: 'skills/my-skill' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async (p: string) => (p === 'skills/my-skill' ? skill : null)),
      list: vi.fn(async () => [makeMetadata({ name: 'my-skill', path: 'skills/my-skill' })]),
      getReference: vi.fn(async () => null),
      getScript: vi.fn(async () => null),
      getAsset: vi.fn(async () => Buffer.from('asset content')),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'my-skill', path: 'assets/data.txt' });

    expect(result).toBe('asset content');
  });

  it('returns error with file list when file is not found in any reader', async () => {
    const skill = makeSkill({ name: 'brand-guide', path: 'skills/brand-guide' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async (p: string) => (p === 'skills/brand-guide' ? skill : null)),
      list: vi.fn(async () => [makeMetadata({ name: 'brand-guide', path: 'skills/brand-guide' })]),
      getReference: vi.fn(async () => null),
      getScript: vi.fn(async () => null),
      getAsset: vi.fn(async () => null),
      listReferences: vi.fn(async () => ['colors.md', 'fonts.md']),
      listScripts: vi.fn(async () => ['build.sh']),
      listAssets: vi.fn(async () => ['logo.png']),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'brand-guide', path: 'references/missing.md' });

    expect(result).toContain('File "references/missing.md" not found in skill "brand-guide".');
    expect(result).toContain('references/colors.md');
    expect(result).toContain('references/fonts.md');
    expect(result).toContain('scripts/build.sh');
    expect(result).toContain('assets/logo.png');
  });

  it('returns error without file list when skill has no files', async () => {
    const skill = makeSkill({ name: 'empty-skill', path: 'skills/empty-skill' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async (p: string) => (p === 'skills/empty-skill' ? skill : null)),
      list: vi.fn(async () => [makeMetadata({ name: 'empty-skill', path: 'skills/empty-skill' })]),
      getReference: vi.fn(async () => null),
      getScript: vi.fn(async () => null),
      getAsset: vi.fn(async () => null),
      listReferences: vi.fn(async () => []),
      listScripts: vi.fn(async () => []),
      listAssets: vi.fn(async () => []),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'empty-skill', path: 'references/anything.md' });

    expect(result).toBe('File "references/anything.md" not found in skill "empty-skill".');
  });

  it('detects binary content and returns metadata', async () => {
    const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x03]);
    const skill = makeSkill({ path: '/skills/brand-guide', name: 'brand-guide' });
    const skills = createMockWorkspaceSkills({
      getReference: vi.fn(async () => null),
      getScript: vi.fn(async () => null),
      getAsset: vi.fn(async () => binaryContent),
      get: vi.fn(async (p: string) => (p === '/skills/brand-guide' ? skill : null)),
      list: vi.fn(async () => [makeMetadata({ name: 'brand-guide', path: '/skills/brand-guide' })]),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'brand-guide', path: 'assets/logo.png' });

    expect(result).toContain('Binary file:');
    expect(result).toContain('/skills/brand-guide/assets/logo.png');
    expect(result).toContain(`${binaryContent.length} bytes`);
  });

  it('detects binary content in string form (null bytes)', async () => {
    const stringWithNulls = 'header\0\x01\x02binary data';
    const skill = makeSkill({ path: '/skills/my-skill', name: 'my-skill' });
    const skills = createMockWorkspaceSkills({
      getReference: vi.fn(async () => stringWithNulls),
      get: vi.fn(async (p: string) => (p === '/skills/my-skill' ? skill : null)),
      list: vi.fn(async () => [makeMetadata({ name: 'my-skill', path: '/skills/my-skill' })]),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'my-skill', path: 'references/data.bin' });

    expect(result).toContain('Binary file:');
    expect(result).toContain('/skills/my-skill/references/data.bin');
  });

  it('extracts lines using startLine and endLine', async () => {
    const content = 'line 1\nline 2\nline 3\nline 4\nline 5';
    const skill = makeSkill({ name: 'test-skill', path: 'skills/test-skill' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async (p: string) => (p === 'skills/test-skill' ? skill : null)),
      list: vi.fn(async () => [makeMetadata({ name: 'test-skill', path: 'skills/test-skill' })]),
      getReference: vi.fn(async () => content),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, {
      skillName: 'test-skill',
      path: 'references/file.md',
      startLine: 2,
      endLine: 4,
    });

    expect(result).toBe('line 2\nline 3\nline 4');
  });

  it('returns full content when startLine and endLine are omitted', async () => {
    const content = 'line 1\nline 2\nline 3';
    const skill = makeSkill({ name: 'test-skill', path: 'skills/test-skill' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async (p: string) => (p === 'skills/test-skill' ? skill : null)),
      list: vi.fn(async () => [makeMetadata({ name: 'test-skill', path: 'skills/test-skill' })]),
      getReference: vi.fn(async () => content),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'test-skill', path: 'references/file.md' });

    expect(result).toBe('line 1\nline 2\nline 3');
  });

  it('uses path as fallback when skill lookup returns null for binary metadata', async () => {
    const binaryContent = Buffer.from([0x00, 0x01, 0x02]);
    const skill = makeSkill({ name: 'gone-skill', path: 'skills/gone-skill' });
    const skills = createMockWorkspaceSkills({
      getReference: vi.fn(async () => null),
      getScript: vi.fn(async () => null),
      getAsset: vi.fn(async () => binaryContent),
      get: vi.fn(async (p: string) => {
        // First call resolves the skill, second call for binary metadata returns null
        if (p === 'skills/gone-skill') return skill;
        return null;
      }),
      list: vi.fn(async () => [makeMetadata({ name: 'gone-skill', path: 'skills/gone-skill' })]),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'gone-skill', path: 'assets/data.bin' });

    expect(result).toContain('Binary file:');
    expect(result).toContain('skills/gone-skill/assets/data.bin');
  });
});

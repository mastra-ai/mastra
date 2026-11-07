import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, vi } from 'vitest';

import { InMemoryBlobStore } from '../../storage/domains/blobs/inmemory';
import type { SkillVersionTree } from '../../storage/types';
import { DEFAULT_MAX_MEDIA_BYTES } from '../tools/media';
import { CompositeVersionedSkillSource } from './composite-versioned-skill-source';
import { LocalSkillSource } from './local-skill-source';
import type { SkillSource } from './skill-source';
import { createSkillTools } from './tools';
import type { Skill, SkillMetadata, SkillSearchResult, WorkspaceSkills } from './types';
import { WorkspaceSkillsImpl } from './workspace-skills';

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

/** Shorthand for calling tool.execute with an optional context (second arg). */
async function exec(
  tool: { execute?: (...args: any[]) => any },
  input: Record<string, unknown>,
  context: Record<string, unknown> = {},
) {
  return tool.execute!(input, context);
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

  it('uses the executing request context to resolve a scoped skills view', async () => {
    const requestContext = {};
    const scopedSkills = createMockWorkspaceSkills({ get: vi.fn(async () => makeSkill()) });
    const getScoped = vi.fn(async () => scopedSkills);
    const skills = createMockWorkspaceSkills({ getScoped });
    const tools = createSkillTools(skills);

    await Promise.all([
      exec(tools.skill, { name: 'test-skill' }, { requestContext }),
      exec(tools.skill_search, { query: 'test' }, { requestContext }),
      exec(tools.skill_read, { skillName: 'test-skill', path: 'references/missing.md' }, { requestContext }),
    ]);

    expect(getScoped).toHaveBeenCalledTimes(3);
    expect(getScoped).toHaveBeenCalledWith({ requestContext });
    expect(skills.maybeRefresh).not.toHaveBeenCalled();
    expect(scopedSkills.maybeRefresh).toHaveBeenCalledTimes(3);
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

  it('calls maybeRefresh before resolving so on-disk edits are picked up (#16640)', async () => {
    const skill = makeSkill({ instructions: 'stale' });
    const maybeRefresh = vi.fn(async () => {});
    const getFn = vi.fn(async () => skill);
    const skills = createMockWorkspaceSkills({ maybeRefresh, get: getFn });
    const { skill: tool } = createSkillTools(skills);

    await exec(tool, { name: 'test-skill' });

    expect(maybeRefresh).toHaveBeenCalledTimes(1);
    // Order matters: refresh must happen before get(), otherwise we still
    // resolve against the cached (stale) skill entry.
    const refreshOrder = maybeRefresh.mock.invocationCallOrder[0]!;
    const getOrder = getFn.mock.invocationCallOrder[0]!;
    expect(refreshOrder).toBeLessThan(getOrder);
  });

  it('activates a symlinked local skill by bare name when two roots point to the same canonical path on disk', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-skill-tool-'));

    try {
      const agentsRoot = path.join(tempDir, '.agents', 'skills');
      const claudeRoot = path.join(tempDir, '.claude', 'skills');
      const canonicalSkillDir = path.join(agentsRoot, 'mastra');
      const symlinkedSkillDir = path.join(claudeRoot, 'mastra');

      await fs.mkdir(canonicalSkillDir, { recursive: true });
      await fs.mkdir(claudeRoot, { recursive: true });
      await fs.writeFile(
        path.join(canonicalSkillDir, 'SKILL.md'),
        '---\nname: mastra\ndescription: canonical mastra skill\n---\n\n# Mastra\n\nUse the canonical skill.',
      );
      await fs.symlink(canonicalSkillDir, symlinkedSkillDir, 'dir');

      const skills = new WorkspaceSkillsImpl({
        source: new LocalSkillSource({ basePath: tempDir }),
        skills: ['.claude/skills', '.agents/skills'],
      });
      const { skill: tool } = createSkillTools(skills);

      const result = await exec(tool, { name: 'mastra' });

      expect(result).toContain('# Mastra');
      expect(result).toContain('Use the canonical skill.');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
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

    expect(result).toBe(
      'Skill "nonexistent" not found. Available skills: alpha (/skills/test-skill), beta (/skills/test-skill)',
    );
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

  it('resolves skill by exact path (escape hatch)', async () => {
    const skill = makeSkill({ name: 'my-skill', path: 'team-a/my-skill', instructions: 'Found by path.' });
    // get() accepts both name and path — simulate it returning for path
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async (identifier: string) => (identifier === 'team-a/my-skill' ? skill : null)),
    });
    const { skill: tool } = createSkillTools(skills);

    const result = await exec(tool, { name: 'team-a/my-skill' });

    expect(result).toBe('Found by path.');
  });

  it('resolves skill by name', async () => {
    const skill = makeSkill({ name: 'unique-skill', path: 'skills/unique-skill', instructions: 'Found by name.' });
    // get() handles name-based resolution internally
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async (identifier: string) => (identifier === 'unique-skill' ? skill : null)),
    });
    const { skill: tool } = createSkillTools(skills);

    const result = await exec(tool, { name: 'unique-skill' });

    expect(result).toBe('Found by name.');
  });

  it('returns not-found when get() returns null (disambiguation handled by WorkspaceSkills)', async () => {
    // When get() returns null, the tool shows available skills
    // Disambiguation (tie-breaking) is handled internally by WorkspaceSkills.get()
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => null),
      list: vi.fn(async () => [
        makeMetadata({ name: 'plan', path: '.mastra/skills/plan' }),
        makeMetadata({ name: 'plan', path: 'user-skills/plan' }),
      ]),
    });
    const { skill: tool } = createSkillTools(skills);

    const result = await exec(tool, { name: 'plan' });

    expect(result).toContain('Skill "plan" not found.');
    expect(result).toContain('Available skills: plan (.mastra/skills/plan), plan (user-skills/plan)');
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

  it('calls maybeRefresh before searching so newly-edited skills are searchable (#16640)', async () => {
    const maybeRefresh = vi.fn(async () => {});
    const search = vi.fn(async () => []);
    const skills = createMockWorkspaceSkills({ maybeRefresh, search });
    const { skill_search: tool } = createSkillTools(skills);

    await exec(tool, { query: 'anything' });

    expect(maybeRefresh).toHaveBeenCalledTimes(1);
    const refreshOrder = maybeRefresh.mock.invocationCallOrder[0]!;
    const searchOrder = search.mock.invocationCallOrder[0]!;
    expect(refreshOrder).toBeLessThan(searchOrder);
  });

  it('formats results with skill name, score, and preview', async () => {
    const searchResults: SkillSearchResult[] = [
      {
        skillName: 'brand-guide',
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

    expect(result).toContain('[brand-guide]');
    expect(result).toContain('(score: 0.85)');
    expect(result).toContain('Use the primary blue color #0066CC for all headings.');
  });

  it('includes line range when available', async () => {
    const searchResults: SkillSearchResult[] = [
      {
        skillName: 'code-review',
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
        skillName: 'verbose-skill',
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
        skillName: 'short-skill',
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
      { skillName: 'skill-a', source: 'SKILL.md', content: 'First result.', score: 0.9 },
      { skillName: 'skill-b', source: 'SKILL.md', content: 'Second result.', score: 0.7 },
    ];
    const skills = createMockWorkspaceSkills({
      search: vi.fn(async () => searchResults),
    });
    const { skill_search: tool } = createSkillTools(skills);

    const result = await exec(tool, { query: 'test' });

    const parts = (result as string).split('\n\n');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('[skill-a]');
    expect(parts[1]).toContain('[skill-b]');
  });

  it('passes skillNames and topK directly to the search function', async () => {
    const searchFn = vi.fn(async () => []);
    const skills = createMockWorkspaceSkills({
      search: searchFn,
    });
    const { skill_search: tool } = createSkillTools(skills);

    await exec(tool, {
      query: 'color palette',
      skillNames: ['brand-guide', 'design-system'],
      topK: 3,
    });

    expect(searchFn).toHaveBeenCalledWith('color palette', {
      topK: 3,
      skillNames: ['brand-guide', 'design-system'],
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
      get: vi.fn(async () => skill),
      getAsset: vi.fn(async () => Buffer.from('# Color Palette\n\nBlue: #0066CC')),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'brand-guide', path: 'references/colors.md' });

    expect(result).toBe('# Color Palette\n\nBlue: #0066CC');
  });

  it('reads a script file', async () => {
    const skill = makeSkill({ name: 'deploy-skill', path: 'skills/deploy-skill' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
      getAsset: vi.fn(async () => Buffer.from('#!/bin/bash\necho "hello"')),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'deploy-skill', path: 'scripts/run.sh' });

    expect(result).toBe('#!/bin/bash\necho "hello"');
  });

  it('reads a file outside the conventional subdirectories', async () => {
    // SKILL.md may link to any skill-root-relative file (see #13270), so skill_read must not
    // be limited to references/, scripts/, and assets/.
    const skill = makeSkill({ name: 'my-skill', path: 'skills/my-skill' });
    const getAsset = vi.fn(async () => Buffer.from('{"schema": true}'));
    const skills = createMockWorkspaceSkills({ get: vi.fn(async () => skill), getAsset });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'my-skill', path: 'docs/schema.json' });

    expect(getAsset).toHaveBeenCalledWith('skills/my-skill', 'docs/schema.json');
    expect(result).toBe('{"schema": true}');
  });

  it('returns error with file list when file is not found in any reader', async () => {
    const skill = makeSkill({ name: 'brand-guide', path: 'skills/brand-guide' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
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
      get: vi.fn(async () => skill),
      getAsset: vi.fn(async () => null),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'empty-skill', path: 'references/missing.md' });

    expect(result).toContain('File "references/missing.md" not found in skill "empty-skill".');
    expect(result).not.toContain('Available files:');
  });

  it('detects binary content outside assets/ (null bytes)', async () => {
    const skill = makeSkill({ name: 'my-skill', path: 'skills/my-skill' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
      getAsset: vi.fn(async () => Buffer.from('header\0binary\0data')),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'my-skill', path: 'references/weird.bin' });

    expect(result).toContain('Binary file:');
    expect(result).toContain('skills/my-skill/references/weird.bin');
  });

  it('treats a valid-UTF-8 asset with a NUL byte after the first 1000 bytes as binary', async () => {
    const skill = makeSkill({ name: 'design-system', path: 'skills/design-system' });
    // Valid UTF-8 (NUL is U+0000) but with a NUL past byte 1000 — the class of file a
    // first-1000-bytes-only NUL scan would have leaked into the model context as text.
    const buffer = Buffer.concat([Buffer.alloc(1500, 0x61), Buffer.from([0x00]), Buffer.alloc(10, 0x62)]);
    expect(buffer.subarray(0, 1000).includes(0)).toBe(false);
    expect(buffer.equals(Buffer.from(buffer.toString('utf-8'), 'utf-8'))).toBe(true);
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
      getAsset: vi.fn(async () => buffer),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'design-system', path: 'assets/data.bin' });

    expect(result).toBe(`Binary file: skills/design-system/assets/data.bin (${buffer.length} bytes)`);
  });

  it('returns genuine text assets as text', async () => {
    const skill = makeSkill({ name: 'design-system', path: 'skills/design-system' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
      getAsset: vi.fn(async () => Buffer.from('col1,col2\na,b', 'utf-8')),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'design-system', path: 'assets/template.csv' });

    expect(result).toBe('col1,col2\na,b');
  });

  it('extracts lines using startLine and endLine', async () => {
    const skill = makeSkill({ name: 'test-skill', path: 'skills/test-skill' });
    const content = 'line 1\nline 2\nline 3\nline 4\nline 5';
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
      getAsset: vi.fn(async () => Buffer.from(content)),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'test-skill', path: 'references/file.md', startLine: 2, endLine: 4 });

    expect(result).toBe('references/file.md (lines 2-4 of 5)\nline 2\nline 3\nline 4');
  });

  it('reports the total line count when a range is requested', async () => {
    const skill = makeSkill({ name: 'test-skill', path: 'skills/test-skill' });
    const content = Array.from({ length: 428 }, (_, i) => `line ${i + 1}`).join('\n');
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
      getAsset: vi.fn(async () => Buffer.from(content)),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, {
      skillName: 'test-skill',
      path: 'references/workflow.md',
      startLine: 350,
      endLine: 449,
    });

    // The window is clamped to EOF, so the header tells the model it reached the end.
    expect(result).toContain('references/workflow.md (lines 350-428 of 428)');
    expect(result).toContain('line 428');
  });

  it('returns an explicit EOF message when startLine is past the end of the file', async () => {
    const skill = makeSkill({ name: 'test-skill', path: 'skills/test-skill' });
    const content = Array.from({ length: 428 }, (_, i) => `line ${i + 1}`).join('\n');
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
      getAsset: vi.fn(async () => Buffer.from(content)),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, {
      skillName: 'test-skill',
      path: 'references/workflow.md',
      startLine: 450,
      endLine: 549,
    });

    expect(result).not.toBe('');
    expect(result).toContain('has 428 lines');
    expect(result).toContain('valid range 1-428');
    expect(result).toContain('past the end of the file');
    expect(result).toContain('stop paginating');
  });

  it('explains an inverted range without claiming end of file', async () => {
    const skill = makeSkill({ name: 'test-skill', path: 'skills/test-skill' });
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
      getAsset: vi.fn(async () => Buffer.from('line 1\nline 2\nline 3\nline 4\nline 5')),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'test-skill', path: 'references/file.md', startLine: 4, endLine: 2 });

    expect(result).toContain('startLine is greater than endLine');
    expect(result).not.toContain('past the end of the file');
  });

  it('returns full content when startLine and endLine are omitted', async () => {
    const skill = makeSkill({ name: 'test-skill', path: 'skills/test-skill' });
    const content = 'line 1\nline 2\nline 3';
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
      getAsset: vi.fn(async () => Buffer.from(content)),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'test-skill', path: 'references/file.md' });

    expect(result).toBe('line 1\nline 2\nline 3');
  });

  describe.each(['local', 'versioned'] as const)('%s skill assets', sourceType => {
    it('surfaces PNG and PDF bytes to the model while preserving text and binary fallbacks (#25219)', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-skill-read-'));
      try {
        const png = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=',
          'base64',
        );
        const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');
        const files = new Map([
          ['SKILL.md', Buffer.from('---\nname: design-system\ndescription: d\n---\n\n# DS')],
          ['assets/logo.png', png],
          // PDFs can be valid UTF-8: media detection must precede text classification.
          ['assets/doc.PDF', pdf],
          ['assets/binary.pdf', Buffer.concat([pdf, Buffer.from([0xff, 0xfe])])],
          ['assets/template.csv', Buffer.from('col1,col2\na,b')],
          ['docs/schema.md', Buffer.from('# Schema')],
          ['assets/unknown.bin', Buffer.from([0, 0xff, 0xfe])],
          ['assets/large.pdf', Buffer.alloc(DEFAULT_MAX_MEDIA_BYTES + 1, 0x61)],
        ]);
        let source: SkillSource;
        if (sourceType === 'local') {
          for (const [name, bytes] of files) {
            const target = path.join(tempDir, 'skills/design-system', name);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, bytes);
          }
          source = new LocalSkillSource({ basePath: tempDir });
        } else {
          const blobStore = new InMemoryBlobStore();
          const tree: SkillVersionTree = { entries: {} };
          const now = new Date();
          for (const [name, bytes] of files) {
            const hash = createHash('sha256').update(bytes).digest('hex');
            await blobStore.put({ hash, content: bytes.toString('base64'), size: bytes.length, createdAt: now });
            tree.entries[name] = { blobHash: hash, size: bytes.length, encoding: 'base64' };
          }
          source = new CompositeVersionedSkillSource(
            [{ dirName: 'design-system', tree, versionCreatedAt: now }],
            blobStore,
          );
        }
        const skills = new WorkspaceSkillsImpl({ source, skills: sourceType === 'local' ? ['skills'] : [''] });
        const { skill_read: tool } = createSkillTools(skills);
        for (const [file, mediaType] of [
          ['assets/logo.png', 'image/png'],
          ['assets/doc.PDF', 'application/pdf'],
          ['assets/binary.pdf', 'application/pdf'],
        ]) {
          const result = await exec(tool, { skillName: 'design-system', path: file, startLine: 1, endLine: 1 });
          expect(result).toMatchObject({
            __workspaceMedia: true,
            mediaType,
            data: files.get(file)?.toString('base64'),
          });
          expect(tool.toModelOutput?.(result)).toEqual({
            type: 'content',
            value: [
              {
                type: 'text',
                text: expect.stringContaining(`${file} (${files.get(file)?.length} bytes, ${mediaType})`),
              },
              { type: 'media', mediaType, data: files.get(file)?.toString('base64') },
            ],
          });
        }
        const text = await exec(tool, { skillName: 'design-system', path: 'assets/template.csv' });
        expect(text).toBe('col1,col2\na,b');
        expect(tool.toModelOutput?.(text)).toBeUndefined();
        expect(
          await exec(tool, { skillName: 'design-system', path: 'assets/template.csv', startLine: 2, endLine: 2 }),
        ).toBe('assets/template.csv (lines 2-2 of 2)\na,b');
        expect(await exec(tool, { skillName: 'design-system', path: 'docs/schema.md' })).toBe('# Schema');
        expect(await exec(tool, { skillName: 'design-system', path: 'assets/unknown.bin' })).toMatch(
          /^Binary file: .*assets\/unknown.bin \(3 bytes\)$/,
        );
        const oversized = await exec(tool, { skillName: 'design-system', path: 'assets/large.pdf' });
        expect(oversized).toMatch(/^Binary file: .*assets\/large.pdf \(10485761 bytes\)$/);
        expect(tool.toModelOutput?.(oversized)).toBeUndefined();
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  it('uses path as fallback when skill lookup returns null for binary metadata', async () => {
    const skill = makeSkill({ name: 'gone-skill', path: 'skills/gone-skill' });
    const binaryBuffer = Buffer.from([0x00, 0x01, 0x02]);
    const skills = createMockWorkspaceSkills({
      get: vi.fn(async () => skill),
      getAsset: vi.fn(async () => binaryBuffer),
    });
    const { skill_read: tool } = createSkillTools(skills);

    const result = await exec(tool, { skillName: 'gone-skill', path: 'assets/data.bin' });

    expect(result).toContain('Binary file:');
    expect(result).toContain('skills/gone-skill/assets/data.bin');
  });
});

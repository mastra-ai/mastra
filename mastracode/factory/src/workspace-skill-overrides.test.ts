import path from 'node:path';
import type { SkillSource, SkillSourceStat } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';

import { createFactorySkillExtension, FACTORY_SKILLS_MOUNT, renderSkillMarkdown } from './workspace.js';
import type { FactorySkillOverride } from './workspace.js';

const fallback: SkillSource = {
  exists: vi.fn(async () => false),
  stat: vi.fn(async () => {
    throw new Error('not found');
  }),
  readFile: vi.fn(async () => {
    throw new Error('not found');
  }),
  readdir: vi.fn(async () => []),
};

function createSource(resolveOverride?: (name: string) => Promise<FactorySkillOverride | null>) {
  return createFactorySkillExtension(resolveOverride).createSource(fallback, []);
}

const triageSkillMd = path.join(FACTORY_SKILLS_MOUNT, 'factory-triage', 'SKILL.md');

const override: FactorySkillOverride = {
  name: 'factory-triage',
  description: 'Custom triage description',
  content: '# Custom triage\n\nDo it my way.',
  updatedAt: new Date('2026-08-13T00:00:00Z'),
};

describe('factory skill source overrides', () => {
  it('reads the bundled SKILL.md when no override resolver is configured', async () => {
    const source = createSource();
    const raw = String(await source.readFile(triageSkillMd));
    expect(raw).toContain('name: factory-triage');
    expect(raw).not.toContain('Custom triage');
  });

  it('reads the bundled SKILL.md when the resolver returns null', async () => {
    const source = createSource(async () => null);
    const raw = String(await source.readFile(triageSkillMd));
    expect(raw).toContain('name: factory-triage');
  });

  it('returns the override rendered as frontmatter + body when present', async () => {
    const resolver = vi.fn(async (name: string) => (name === 'factory-triage' ? override : null));
    const source = createSource(resolver);
    const raw = String(await source.readFile(triageSkillMd));
    expect(raw).toBe(renderSkillMarkdown(override));
    expect(raw).toContain('description: Custom triage description');
    expect(raw).toContain('Do it my way.');
    expect(resolver).toHaveBeenCalledWith('factory-triage');
  });

  it('reflects the override size and mtime in stat so caches refresh', async () => {
    const source = createSource(async () => override);
    const stat: SkillSourceStat = await source.stat(triageSkillMd);
    expect(stat.size).toBe(Buffer.byteLength(renderSkillMarkdown(override)));
    expect(stat.modifiedAt).toEqual(override.updatedAt);
  });

  it('does not consult the resolver for non-SKILL.md factory paths', async () => {
    const resolver = vi.fn(async () => override);
    const source = createSource(resolver);
    await source.stat(path.join(FACTORY_SKILLS_MOUNT, 'factory-triage'));
    expect(resolver).not.toHaveBeenCalled();
  });

  it('falls back to the bundled default when the resolver throws', async () => {
    const source = createSource(async () => {
      throw new Error('db down');
    });
    const raw = String(await source.readFile(triageSkillMd));
    expect(raw).toContain('name: factory-triage');
  });
});

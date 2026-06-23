import { describe, it, expect, beforeEach } from 'vitest';

import { defineSkill } from './define-skill';
import { InlineSkillSource } from './inline-skill-source';

describe('InlineSkillSource', () => {
  const reviewSkill = defineSkill({
    name: 'code-review',
    description: 'Use when reviewing code.',
    instructions: '## Code Review\nCheck for correctness and style.',
    references: {
      'checklist.md': '# Checklist\n- Correctness\n- Style',
      'examples.md': '# Examples\nSee below...',
    },
  });

  const simpleSkill = defineSkill({
    name: 'simple-skill',
    description: 'A simple skill.',
    instructions: 'Do the thing.',
  });

  let source: InlineSkillSource;

  beforeEach(() => {
    source = new InlineSkillSource([reviewSkill, simpleSkill]);
  });

  describe('exists', () => {
    it('returns true for skill root directory', async () => {
      expect(await source.exists('inline/code-review')).toBe(true);
      expect(await source.exists('inline/simple-skill')).toBe(true);
    });

    it('returns true for SKILL.md', async () => {
      expect(await source.exists('inline/code-review/SKILL.md')).toBe(true);
    });

    it('returns true for references directory when skill has references', async () => {
      expect(await source.exists('inline/code-review/references')).toBe(true);
    });

    it('returns false for references directory when skill has no references', async () => {
      expect(await source.exists('inline/simple-skill/references')).toBe(false);
    });

    it('returns true for specific reference files', async () => {
      expect(await source.exists('inline/code-review/references/checklist.md')).toBe(true);
      expect(await source.exists('inline/code-review/references/examples.md')).toBe(true);
    });

    it('returns false for non-existent skills', async () => {
      expect(await source.exists('inline/nonexistent')).toBe(false);
    });

    it('returns false for non-inline paths', async () => {
      expect(await source.exists('./local/path')).toBe(false);
    });

    it('returns false for non-existent reference files', async () => {
      expect(await source.exists('inline/code-review/references/nope.md')).toBe(false);
    });
  });

  describe('stat', () => {
    it('returns directory stat for skill root', async () => {
      const stat = await source.stat('inline/code-review');
      expect(stat.name).toBe('code-review');
      expect(stat.type).toBe('directory');
    });

    it('returns file stat for SKILL.md', async () => {
      const stat = await source.stat('inline/code-review/SKILL.md');
      expect(stat.name).toBe('SKILL.md');
      expect(stat.type).toBe('file');
      expect(stat.mimeType).toBe('text/markdown');
      expect(stat.size).toBeGreaterThan(0);
    });

    it('returns directory stat for references/', async () => {
      const stat = await source.stat('inline/code-review/references');
      expect(stat.name).toBe('references');
      expect(stat.type).toBe('directory');
    });

    it('throws ENOENT for non-existent paths', async () => {
      await expect(source.stat('inline/nonexistent')).rejects.toThrow('ENOENT');
    });
  });

  describe('readFile', () => {
    it('reads SKILL.md with frontmatter and instructions', async () => {
      const content = await source.readFile('inline/code-review/SKILL.md');
      const text = typeof content === 'string' ? content : content.toString('utf-8');

      // Should contain frontmatter with name and description
      expect(text).toContain('name: code-review');
      expect(text).toContain('description: Use when reviewing code.');
      // Should contain instructions as the body
      expect(text).toContain('## Code Review');
      expect(text).toContain('Check for correctness and style.');
    });

    it('reads reference files', async () => {
      const content = await source.readFile('inline/code-review/references/checklist.md');
      expect(content).toBe('# Checklist\n- Correctness\n- Style');
    });

    it('throws ENOENT for non-existent files', async () => {
      await expect(source.readFile('inline/code-review/nope.txt')).rejects.toThrow('ENOENT');
    });

    it('throws ENOENT for non-existent reference files', async () => {
      await expect(source.readFile('inline/code-review/references/nope.md')).rejects.toThrow('ENOENT');
    });
  });

  describe('readdir', () => {
    it('lists entries in skill root directory', async () => {
      const entries = await source.readdir('inline/code-review');
      expect(entries).toEqual(
        expect.arrayContaining([
          { name: 'SKILL.md', type: 'file' },
          { name: 'references', type: 'directory' },
        ]),
      );
    });

    it('lists entries in skill root without references when none exist', async () => {
      const entries = await source.readdir('inline/simple-skill');
      expect(entries).toEqual([{ name: 'SKILL.md', type: 'file' }]);
    });

    it('lists reference files', async () => {
      const entries = await source.readdir('inline/code-review/references');
      expect(entries).toEqual(
        expect.arrayContaining([
          { name: 'checklist.md', type: 'file' },
          { name: 'examples.md', type: 'file' },
        ]),
      );
    });

    it('returns empty for non-existent skill', async () => {
      const entries = await source.readdir('inline/nonexistent');
      expect(entries).toEqual([]);
    });
  });
});

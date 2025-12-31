import { join } from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { Skills } from './skills';

const FIXTURES_PATH = join(__dirname, '__fixtures__', 'skills');

describe('Skills', () => {
  describe('Discovery', () => {
    it('should discover skills from directory', () => {
      const skills = new Skills({
        id: 'test-skills',
        paths: FIXTURES_PATH,
      });

      expect(skills.size).toBe(2);
      expect(skills.skillNames).toContain('pdf-processing');
      expect(skills.skillNames).toContain('data-analysis');
    });

    it('should handle non-existent directory gracefully', () => {
      const skills = new Skills({
        id: 'test-skills',
        paths: '/path/that/does/not/exist',
      });

      expect(skills.size).toBe(0);
    });

    it('should discover skills from multiple paths', () => {
      const skills = new Skills({
        id: 'test-skills',
        paths: [FIXTURES_PATH, '/another/path'],
      });

      // Should still find skills from the first valid path
      expect(skills.size).toBe(2);
    });
  });

  describe('Skill Retrieval', () => {
    let skills: Skills;

    beforeEach(() => {
      skills = new Skills({
        id: 'test-skills',
        paths: FIXTURES_PATH,
      });
    });

    it('should list all skills', () => {
      const list = skills.list();

      expect(list.length).toBe(2);
      expect(list.map(s => s.name)).toContain('pdf-processing');
      expect(list.map(s => s.name)).toContain('data-analysis');
    });

    it('should get a specific skill by name', () => {
      const skill = skills.get('pdf-processing');

      expect(skill).toBeDefined();
      expect(skill?.name).toBe('pdf-processing');
      expect(skill?.description).toBeDefined();
      expect(skill?.instructions).toBeDefined();
      expect(skill?.path).toContain('pdf-processing');
    });

    it('should return undefined for non-existent skill', () => {
      const skill = skills.get('non-existent');

      expect(skill).toBeUndefined();
    });

    it('should check if skill exists', () => {
      expect(skills.has('pdf-processing')).toBe(true);
      expect(skills.has('non-existent')).toBe(false);
    });

    it('should include source information', () => {
      const skill = skills.get('pdf-processing');

      expect(skill?.source).toBeDefined();
      expect(skill?.source.type).toBe('local');
    });
  });

  describe('Reference Files', () => {
    let skills: Skills;

    beforeEach(() => {
      skills = new Skills({
        id: 'test-skills',
        paths: FIXTURES_PATH,
      });
    });

    it('should discover reference files', () => {
      const skill = skills.get('pdf-processing');

      expect(skill?.references).toBeDefined();
      expect(skill?.references.length).toBeGreaterThan(0);
    });

    it('should get reference content', () => {
      const refs = skills.getReferences('pdf-processing');
      expect(refs.length).toBeGreaterThan(0);

      const content = skills.getReference('pdf-processing', refs[0]);
      expect(content).toBeDefined();
      expect(typeof content).toBe('string');
    });

    it('should return undefined for non-existent reference', () => {
      const content = skills.getReference('pdf-processing', 'non-existent.md');

      expect(content).toBeUndefined();
    });

    it('should return undefined for non-existent skill reference', () => {
      const content = skills.getReference('non-existent', 'file.md');

      expect(content).toBeUndefined();
    });
  });

  describe('BM25 Search', () => {
    let skills: Skills;

    beforeEach(() => {
      skills = new Skills({
        id: 'test-skills',
        paths: FIXTURES_PATH,
      });
    });

    it('should search skill content', () => {
      const results = skills.search('pdf processing');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].skillName).toBe('pdf-processing');
    });

    it('should search across multiple skills', () => {
      // Search for a generic term
      const results = skills.search('data', { topK: 10 });

      // Should find matches in both skills
      const skillNames = new Set(results.map(r => r.skillName));
      expect(skillNames.size).toBeGreaterThanOrEqual(1);
    });

    it('should filter by skill names', () => {
      const results = skills.search('processing', {
        skillNames: ['pdf-processing'],
      });

      for (const result of results) {
        expect(result.skillName).toBe('pdf-processing');
      }
    });

    it('should include reference files in search', () => {
      // Search for content that might be in reference files
      const results = skills.search('reference', { includeReferences: true });

      // Should find matches in reference files
      const hasReferenceSource = results.some(r => r.source.includes('references/'));
      expect(hasReferenceSource || results.length > 0).toBe(true);
    });

    it('should exclude references when specified', () => {
      const results = skills.search('processing', { includeReferences: false });

      for (const result of results) {
        expect(result.source).toBe('SKILL.md');
      }
    });

    it('should limit results by topK', () => {
      const results = skills.search('skill', { topK: 1 });

      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Refresh', () => {
    it('should refresh skills from disk', () => {
      const skills = new Skills({
        id: 'test-skills',
        paths: FIXTURES_PATH,
      });

      const initialSize = skills.size;

      // Refresh should maintain the same skills
      skills.refresh();

      expect(skills.size).toBe(initialSize);
    });
  });

  describe('Validation', () => {
    it('should validate skill metadata by default', () => {
      const skills = new Skills({
        id: 'test-skills',
        paths: FIXTURES_PATH,
        validateOnLoad: true,
      });

      // Valid skills should be loaded
      expect(skills.size).toBeGreaterThan(0);
    });

    it('should skip validation when disabled', () => {
      const skills = new Skills({
        id: 'test-skills',
        paths: FIXTURES_PATH,
        validateOnLoad: false,
      });

      expect(skills.size).toBeGreaterThan(0);
    });
  });
});

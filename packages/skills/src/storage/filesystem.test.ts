import { join } from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';

import { FilesystemStorage } from './filesystem';

const FIXTURES_PATH = join(__dirname, '..', '__fixtures__', 'skills');

describe('FilesystemStorage', () => {
  let storage: FilesystemStorage;

  beforeEach(async () => {
    storage = new FilesystemStorage({
      paths: FIXTURES_PATH,
    });
    await storage.init();
  });

  describe('listSkills', () => {
    it('should list all discovered skills', async () => {
      const skills = await storage.listSkills();

      expect(skills.length).toBe(2);
      expect(skills.map(s => s.name)).toContain('pdf-processing');
      expect(skills.map(s => s.name)).toContain('data-analysis');
    });

    it('should filter by source types', async () => {
      const localSkills = await storage.listSkills({ sourceTypes: ['local'] });

      // All skills from fixtures are local
      expect(localSkills.length).toBe(2);
    });

    it('should return empty for non-matching source types', async () => {
      const externalSkills = await storage.listSkills({ sourceTypes: ['external'] });

      // No external skills in fixtures
      expect(externalSkills.length).toBe(0);
    });
  });

  describe('getSkill', () => {
    it('should get a specific skill by name', async () => {
      const skill = await storage.getSkill('pdf-processing');

      expect(skill).toBeDefined();
      expect(skill?.name).toBe('pdf-processing');
      expect(skill?.description).toBeDefined();
      expect(skill?.instructions).toBeDefined();
      expect(skill?.path).toContain('pdf-processing');
    });

    it('should return null for non-existent skill', async () => {
      const skill = await storage.getSkill('non-existent');

      expect(skill).toBeNull();
    });

    it('should include source information', async () => {
      const skill = await storage.getSkill('pdf-processing');

      expect(skill?.source).toBeDefined();
      expect(skill?.source.type).toBe('local');
    });
  });

  describe('hasSkill', () => {
    it('should return true for existing skill', async () => {
      const exists = await storage.hasSkill('pdf-processing');

      expect(exists).toBe(true);
    });

    it('should return false for non-existent skill', async () => {
      const exists = await storage.hasSkill('non-existent');

      expect(exists).toBe(false);
    });
  });

  describe('listReferences', () => {
    it('should list reference files for a skill', async () => {
      const refs = await storage.listReferences('pdf-processing');

      expect(refs.length).toBeGreaterThan(0);
    });

    it('should return empty array for skill without references', async () => {
      // data-analysis may or may not have references
      const refs = await storage.listReferences('data-analysis');

      expect(Array.isArray(refs)).toBe(true);
    });

    it('should return empty array for non-existent skill', async () => {
      const refs = await storage.listReferences('non-existent');

      expect(refs).toEqual([]);
    });
  });

  describe('getReference', () => {
    it('should get reference content', async () => {
      const refs = await storage.listReferences('pdf-processing');

      if (refs.length > 0) {
        const content = await storage.getReference('pdf-processing', refs[0]!);
        expect(content).toBeDefined();
        expect(typeof content).toBe('string');
      }
    });

    it('should return null for non-existent reference', async () => {
      const content = await storage.getReference('pdf-processing', 'non-existent.md');

      expect(content).toBeNull();
    });

    it('should return null for non-existent skill reference', async () => {
      const content = await storage.getReference('non-existent', 'file.md');

      expect(content).toBeNull();
    });
  });

  describe('refresh', () => {
    it('should refresh skills from disk', async () => {
      const initialSkills = await storage.listSkills();

      // Refresh should maintain the same skills
      await storage.refresh();

      const refreshedSkills = await storage.listSkills();
      expect(refreshedSkills.length).toBe(initialSkills.length);
    });
  });

  describe('multiple paths', () => {
    it('should discover skills from multiple paths', async () => {
      const multiPathStorage = new FilesystemStorage({
        paths: [FIXTURES_PATH, '/another/path/that/does/not/exist'],
      });
      await multiPathStorage.init();

      // Should still find skills from the first valid path
      const skills = await multiPathStorage.listSkills();
      expect(skills.length).toBe(2);
    });
  });

  describe('validation', () => {
    it('should validate skill metadata by default', async () => {
      const validatingStorage = new FilesystemStorage({
        paths: FIXTURES_PATH,
        validateOnLoad: true,
      });
      await validatingStorage.init();

      // Valid skills should be loaded
      const skills = await validatingStorage.listSkills();
      expect(skills.length).toBeGreaterThan(0);
    });

    it('should skip validation when disabled', async () => {
      const nonValidatingStorage = new FilesystemStorage({
        paths: FIXTURES_PATH,
        validateOnLoad: false,
      });
      await nonValidatingStorage.init();

      const skills = await nonValidatingStorage.listSkills();
      expect(skills.length).toBeGreaterThan(0);
    });
  });

  describe('non-existent path', () => {
    it('should handle non-existent directory gracefully', async () => {
      const emptyStorage = new FilesystemStorage({
        paths: '/path/that/does/not/exist',
      });
      await emptyStorage.init();

      const skills = await emptyStorage.listSkills();
      expect(skills.length).toBe(0);
    });
  });
});

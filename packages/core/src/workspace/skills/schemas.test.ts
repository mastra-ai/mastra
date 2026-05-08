import { describe, it, expect } from 'vitest';

import { SKILL_LIMITS, validateSkillMetadata } from './schemas';

describe('schemas', () => {
  // ===========================================================================
  // SKILL_LIMITS Constants
  // ===========================================================================
  describe('SKILL_LIMITS', () => {
    it('should have expected constant values', () => {
      expect(SKILL_LIMITS.MAX_INSTRUCTION_TOKENS).toBe(5000);
      expect(SKILL_LIMITS.MAX_INSTRUCTION_LINES).toBe(500);
      expect(SKILL_LIMITS.MAX_NAME_LENGTH).toBe(64);
      expect(SKILL_LIMITS.MAX_DESCRIPTION_LENGTH).toBe(1024);
      expect(SKILL_LIMITS.MAX_COMPATIBILITY_LENGTH).toBe(500);
    });
  });

  // ===========================================================================
  // Name Validation
  // ===========================================================================
  describe('name validation', () => {
    const validDescription = 'A valid description';

    describe('valid names', () => {
      it('should accept simple lowercase name', () => {
        const result = validateSkillMetadata({ name: 'myskill', description: validDescription });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept name with hyphens', () => {
        const result = validateSkillMetadata({ name: 'my-skill-name', description: validDescription });
        expect(result.valid).toBe(true);
      });

      it('should accept name with numbers', () => {
        const result1 = validateSkillMetadata({ name: 'skill123', description: validDescription });
        const result2 = validateSkillMetadata({ name: '123skill', description: validDescription });
        expect(result1.valid).toBe(true);
        expect(result2.valid).toBe(true);
      });

      it('should accept name with hyphens and numbers', () => {
        const result = validateSkillMetadata({ name: 'my-skill-v2', description: validDescription });
        expect(result.valid).toBe(true);
      });

      it('should accept single character name', () => {
        const result1 = validateSkillMetadata({ name: 'a', description: validDescription });
        const result2 = validateSkillMetadata({ name: '1', description: validDescription });
        expect(result1.valid).toBe(true);
        expect(result2.valid).toBe(true);
      });

      it('should accept name at max length (64 chars)', () => {
        const maxName = 'a'.repeat(64);
        const result = validateSkillMetadata({ name: maxName, description: validDescription });
        expect(result.valid).toBe(true);
      });
    });

    describe('invalid names', () => {
      it('should reject empty name', () => {
        const result = validateSkillMetadata({ name: '', description: validDescription });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('cannot be empty'))).toBe(true);
      });

      it('should reject name exceeding max length', () => {
        const longName = 'a'.repeat(65);
        const result = validateSkillMetadata({ name: longName, description: validDescription });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('64 characters or less'))).toBe(true);
      });

      it('should reject uppercase letters', () => {
        const result = validateSkillMetadata({ name: 'MySkill', description: validDescription });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('only lowercase letters, numbers, and hyphens'))).toBe(true);
      });

      it('should reject special characters', () => {
        const result1 = validateSkillMetadata({ name: 'my_skill', description: validDescription });
        const result2 = validateSkillMetadata({ name: 'my.skill', description: validDescription });
        const result3 = validateSkillMetadata({ name: 'my skill', description: validDescription });
        expect(result1.valid).toBe(false);
        expect(result2.valid).toBe(false);
        expect(result3.valid).toBe(false);
        expect(result1.errors.some(e => e.includes('only lowercase letters, numbers, and hyphens'))).toBe(true);
      });

      it('should reject name starting with hyphen', () => {
        const result = validateSkillMetadata({ name: '-myskill', description: validDescription });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('must not start or end with a hyphen'))).toBe(true);
      });

      it('should reject name ending with hyphen', () => {
        const result = validateSkillMetadata({ name: 'myskill-', description: validDescription });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('must not start or end with a hyphen'))).toBe(true);
      });

      it('should reject consecutive hyphens', () => {
        const result = validateSkillMetadata({ name: 'my--skill', description: validDescription });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('must not contain consecutive hyphens'))).toBe(true);
      });

      it('should reject name with multiple issues', () => {
        // Just hyphen - multiple issues
        const result = validateSkillMetadata({ name: '-', description: validDescription });
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  // ===========================================================================
  // Description Validation
  // ===========================================================================
  describe('description validation', () => {
    const validName = 'my-skill';

    describe('valid descriptions', () => {
      it('should accept normal description', () => {
        const desc = 'A skill that helps users manage files';
        const result = validateSkillMetadata({ name: validName, description: desc });
        expect(result.valid).toBe(true);
      });

      it('should accept single character description', () => {
        const result = validateSkillMetadata({ name: validName, description: 'A' });
        expect(result.valid).toBe(true);
      });

      it('should accept description at max length (1024 chars)', () => {
        const maxDesc = 'a'.repeat(1024);
        const result = validateSkillMetadata({ name: validName, description: maxDesc });
        expect(result.valid).toBe(true);
      });

      it('should accept description with various characters', () => {
        const desc = 'This skill: does things! (v2.0) - includes "special" chars & more.';
        const result = validateSkillMetadata({ name: validName, description: desc });
        expect(result.valid).toBe(true);
      });
    });

    describe('invalid descriptions', () => {
      it('should reject empty description', () => {
        const result = validateSkillMetadata({ name: validName, description: '' });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('cannot be empty'))).toBe(true);
      });

      it('should reject description exceeding max length', () => {
        const longDesc = 'a'.repeat(1025);
        const result = validateSkillMetadata({ name: validName, description: longDesc });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('1024 characters or less'))).toBe(true);
      });

      it('should reject whitespace-only description', () => {
        const result1 = validateSkillMetadata({ name: validName, description: '   ' });
        const result2 = validateSkillMetadata({ name: validName, description: '\t\n' });
        expect(result1.valid).toBe(false);
        expect(result2.valid).toBe(false);
        expect(result1.errors.some(e => e.includes('cannot be only whitespace'))).toBe(true);
      });
    });
  });

  // ===========================================================================
  // Compatibility Validation
  // ===========================================================================
  describe('compatibility validation', () => {
    const validBase = { name: 'my-skill', description: 'A skill' };

    it('should accept valid compatibility string', () => {
      const result = validateSkillMetadata({
        ...validBase,
        compatibility: 'Requires Node.js 18+ and TypeScript 5.0+',
      });
      expect(result.valid).toBe(true);
    });

    it('should accept empty string', () => {
      const result = validateSkillMetadata({ ...validBase, compatibility: '' });
      expect(result.valid).toBe(true);
    });

    it('should accept undefined (optional)', () => {
      const result = validateSkillMetadata(validBase);
      expect(result.valid).toBe(true);
    });

    it('should accept object compatibility (for external skill compatibility)', () => {
      const result = validateSkillMetadata({
        ...validBase,
        compatibility: { requires: ['node>=18', 'typescript>=5.0'] },
      });
      expect(result.valid).toBe(true);
    });

    it('should accept array compatibility (for external skill compatibility)', () => {
      const result = validateSkillMetadata({
        ...validBase,
        compatibility: ['node>=18', 'typescript>=5.0'],
      });
      expect(result.valid).toBe(true);
    });
  });

  // ===========================================================================
  // License Validation
  // ===========================================================================
  describe('license validation', () => {
    const validBase = { name: 'my-skill', description: 'A skill' };

    it('should accept common license strings', () => {
      const result1 = validateSkillMetadata({ ...validBase, license: 'MIT' });
      const result2 = validateSkillMetadata({ ...validBase, license: 'Apache-2.0' });
      const result3 = validateSkillMetadata({ ...validBase, license: 'BSD-3-Clause' });
      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
      expect(result3.valid).toBe(true);
    });

    it('should accept empty string', () => {
      const result = validateSkillMetadata({ ...validBase, license: '' });
      expect(result.valid).toBe(true);
    });

    it('should accept undefined (optional)', () => {
      const result = validateSkillMetadata(validBase);
      expect(result.valid).toBe(true);
    });
  });

  // ===========================================================================
  // Metadata Field Validation
  // ===========================================================================
  describe('metadata field validation', () => {
    const validBase = { name: 'my-skill', description: 'A skill' };

    it('should accept record of string values', () => {
      const result = validateSkillMetadata({
        ...validBase,
        metadata: { author: 'john', version: '1.0.0' },
      });
      expect(result.valid).toBe(true);
    });

    it('should accept empty record', () => {
      const result = validateSkillMetadata({ ...validBase, metadata: {} });
      expect(result.valid).toBe(true);
    });

    it('should accept undefined (optional)', () => {
      const result = validateSkillMetadata(validBase);
      expect(result.valid).toBe(true);
    });

    it('should accept non-string values in metadata (for external skill compatibility)', () => {
      const result = validateSkillMetadata({
        ...validBase,
        metadata: { author: 'john', count: 42, keywords: ['a', 'b', 'c'] },
      });
      expect(result.valid).toBe(true);
    });
  });

  // ===========================================================================
  // Full Metadata Validation
  // ===========================================================================
  describe('full metadata validation', () => {
    it('should accept valid complete metadata', () => {
      const metadata = {
        name: 'my-skill',
        description: 'A helpful skill for users',
        license: 'MIT',
        compatibility: 'Node.js 18+',
        metadata: { author: 'john', version: '1.0.0' },
      };
      const result = validateSkillMetadata(metadata);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept minimal metadata (only required fields)', () => {
      const metadata = {
        name: 'my-skill',
        description: 'A helpful skill',
      };
      const result = validateSkillMetadata(metadata);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing name', () => {
      const result = validateSkillMetadata({ description: 'A skill' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });

    it('should reject missing description', () => {
      const result = validateSkillMetadata({ name: 'my-skill' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('description'))).toBe(true);
    });

    it('should reject invalid name format', () => {
      const result = validateSkillMetadata({ name: 'My_Skill', description: 'A skill' });
      expect(result.valid).toBe(false);
    });

    it('should reject non-object input', () => {
      const result1 = validateSkillMetadata(null);
      const result2 = validateSkillMetadata('string');
      const result3 = validateSkillMetadata([]);
      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
      expect(result3.valid).toBe(false);
    });
  });

  // ===========================================================================
  // validateSkillMetadata function
  // ===========================================================================
  describe('validateSkillMetadata', () => {
    describe('valid metadata', () => {
      it('should return valid=true for correct metadata', () => {
        const result = validateSkillMetadata({
          name: 'my-skill',
          description: 'A helpful skill',
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it('should return valid=true with complete metadata', () => {
        const result = validateSkillMetadata({
          name: 'my-skill',
          description: 'A helpful skill',
          license: 'MIT',
          compatibility: 'Node.js 18+',
          metadata: { author: 'john' },
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('schema errors', () => {
      it('should return errors for invalid name', () => {
        const result = validateSkillMetadata({
          name: 'Invalid--Name',
          description: 'A skill',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should return errors for missing fields', () => {
        const result = validateSkillMetadata({});
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should return errors for empty description', () => {
        const result = validateSkillMetadata({
          name: 'my-skill',
          description: '',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('description'))).toBe(true);
      });
    });

    describe('directory name matching', () => {
      it('should error when name does not match directory', () => {
        const result = validateSkillMetadata(
          {
            name: 'my-skill',
            description: 'A skill',
          },
          'different-name',
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('must match directory name'))).toBe(true);
      });

      it('should pass when name matches directory', () => {
        const result = validateSkillMetadata(
          {
            name: 'my-skill',
            description: 'A skill',
          },
          'my-skill',
        );
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should not check directory when not provided', () => {
        const result = validateSkillMetadata({
          name: 'my-skill',
          description: 'A skill',
        });
        expect(result.valid).toBe(true);
      });
    });

    describe('instruction warnings', () => {
      it('should warn when instructions exceed max lines', () => {
        const longInstructions = 'line\n'.repeat(600);
        const result = validateSkillMetadata(
          {
            name: 'my-skill',
            description: 'A skill',
          },
          'my-skill',
          longInstructions,
        );
        expect(result.valid).toBe(true); // Warnings don't affect validity
        expect(result.warnings.some(w => w.includes('lines'))).toBe(true);
        expect(result.warnings.some(w => w.includes('recommended'))).toBe(true);
      });

      it('should warn when instructions exceed estimated tokens', () => {
        // Create content with many words (tokens estimate is words * 1.3)
        // Need > 5000 tokens, so > ~3850 words
        const longInstructions = 'word '.repeat(4000);
        const result = validateSkillMetadata(
          {
            name: 'my-skill',
            description: 'A skill',
          },
          'my-skill',
          longInstructions,
        );
        expect(result.valid).toBe(true); // Warnings don't affect validity
        expect(result.warnings.some(w => w.includes('tokens'))).toBe(true);
      });

      it('should not warn for short instructions', () => {
        const shortInstructions = '# Instructions\n\nDo things.';
        const result = validateSkillMetadata(
          {
            name: 'my-skill',
            description: 'A skill',
          },
          'my-skill',
          shortInstructions,
        );
        expect(result.warnings).toHaveLength(0);
      });

      it('should not check instructions when not provided', () => {
        const result = validateSkillMetadata({
          name: 'my-skill',
          description: 'A skill',
        });
        expect(result.warnings).toHaveLength(0);
      });
    });

    describe('combined errors and warnings', () => {
      it('should return both errors and warnings', () => {
        const longInstructions = 'line\n'.repeat(600);
        const result = validateSkillMetadata(
          {
            name: 'invalid--name',
            description: 'A skill',
          },
          'different-dir',
          longInstructions,
        );
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.warnings.length).toBeGreaterThan(0);
      });
    });
  });
});

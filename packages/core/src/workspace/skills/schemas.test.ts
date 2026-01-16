import { describe, it, expect } from 'vitest';

import {
  SKILL_LIMITS,
  SkillNameSchema,
  SkillDescriptionSchema,
  SkillCompatibilitySchema,
  SkillLicenseSchema,
  SkillMetadataFieldSchema,
  SkillAllowedToolsSchema,
  SkillMetadataSchema,
  validateSkillMetadata,
  parseAllowedTools,
} from './schemas';

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
  // SkillNameSchema
  // ===========================================================================
  describe('SkillNameSchema', () => {
    describe('valid names', () => {
      it('should accept simple lowercase name', () => {
        expect(SkillNameSchema.parse('myskill')).toBe('myskill');
      });

      it('should accept name with hyphens', () => {
        expect(SkillNameSchema.parse('my-skill-name')).toBe('my-skill-name');
      });

      it('should accept name with numbers', () => {
        expect(SkillNameSchema.parse('skill123')).toBe('skill123');
        expect(SkillNameSchema.parse('123skill')).toBe('123skill');
      });

      it('should accept name with hyphens and numbers', () => {
        expect(SkillNameSchema.parse('my-skill-v2')).toBe('my-skill-v2');
      });

      it('should accept single character name', () => {
        expect(SkillNameSchema.parse('a')).toBe('a');
        expect(SkillNameSchema.parse('1')).toBe('1');
      });

      it('should accept name at max length (64 chars)', () => {
        const maxName = 'a'.repeat(64);
        expect(SkillNameSchema.parse(maxName)).toBe(maxName);
      });
    });

    describe('invalid names', () => {
      it('should reject empty name', () => {
        expect(() => SkillNameSchema.parse('')).toThrow('Skill name cannot be empty');
      });

      it('should reject name exceeding max length', () => {
        const longName = 'a'.repeat(65);
        expect(() => SkillNameSchema.parse(longName)).toThrow('64 characters or less');
      });

      it('should reject uppercase letters', () => {
        expect(() => SkillNameSchema.parse('MySkill')).toThrow('only lowercase letters, numbers, and hyphens');
      });

      it('should reject special characters', () => {
        expect(() => SkillNameSchema.parse('my_skill')).toThrow('only lowercase letters, numbers, and hyphens');
        expect(() => SkillNameSchema.parse('my.skill')).toThrow('only lowercase letters, numbers, and hyphens');
        expect(() => SkillNameSchema.parse('my skill')).toThrow('only lowercase letters, numbers, and hyphens');
      });

      it('should reject name starting with hyphen', () => {
        expect(() => SkillNameSchema.parse('-myskill')).toThrow('must not start or end with a hyphen');
      });

      it('should reject name ending with hyphen', () => {
        expect(() => SkillNameSchema.parse('myskill-')).toThrow('must not start or end with a hyphen');
      });

      it('should reject consecutive hyphens', () => {
        expect(() => SkillNameSchema.parse('my--skill')).toThrow('must not contain consecutive hyphens');
      });

      it('should reject name with multiple issues', () => {
        // Just hyphen - multiple issues
        expect(() => SkillNameSchema.parse('-')).toThrow();
      });
    });
  });

  // ===========================================================================
  // SkillDescriptionSchema
  // ===========================================================================
  describe('SkillDescriptionSchema', () => {
    describe('valid descriptions', () => {
      it('should accept normal description', () => {
        const desc = 'A skill that helps users manage files';
        expect(SkillDescriptionSchema.parse(desc)).toBe(desc);
      });

      it('should accept single character description', () => {
        expect(SkillDescriptionSchema.parse('A')).toBe('A');
      });

      it('should accept description at max length (1024 chars)', () => {
        const maxDesc = 'a'.repeat(1024);
        expect(SkillDescriptionSchema.parse(maxDesc)).toBe(maxDesc);
      });

      it('should accept description with various characters', () => {
        const desc = 'This skill: does things! (v2.0) - includes "special" chars & more.';
        expect(SkillDescriptionSchema.parse(desc)).toBe(desc);
      });
    });

    describe('invalid descriptions', () => {
      it('should reject empty description', () => {
        expect(() => SkillDescriptionSchema.parse('')).toThrow('cannot be empty');
      });

      it('should reject description exceeding max length', () => {
        const longDesc = 'a'.repeat(1025);
        expect(() => SkillDescriptionSchema.parse(longDesc)).toThrow('1024 characters or less');
      });

      it('should reject whitespace-only description', () => {
        expect(() => SkillDescriptionSchema.parse('   ')).toThrow('cannot be only whitespace');
        expect(() => SkillDescriptionSchema.parse('\t\n')).toThrow('cannot be only whitespace');
      });
    });
  });

  // ===========================================================================
  // SkillCompatibilitySchema
  // ===========================================================================
  describe('SkillCompatibilitySchema', () => {
    it('should accept valid compatibility string', () => {
      const compat = 'Requires Node.js 18+ and TypeScript 5.0+';
      expect(SkillCompatibilitySchema.parse(compat)).toBe(compat);
    });

    it('should accept empty string', () => {
      expect(SkillCompatibilitySchema.parse('')).toBe('');
    });

    it('should accept string at max length (500 chars)', () => {
      const maxCompat = 'a'.repeat(500);
      expect(SkillCompatibilitySchema.parse(maxCompat)).toBe(maxCompat);
    });

    it('should accept undefined (optional)', () => {
      expect(SkillCompatibilitySchema.parse(undefined)).toBeUndefined();
    });

    it('should reject string exceeding max length', () => {
      const longCompat = 'a'.repeat(501);
      expect(() => SkillCompatibilitySchema.parse(longCompat)).toThrow('500 characters or less');
    });
  });

  // ===========================================================================
  // SkillLicenseSchema
  // ===========================================================================
  describe('SkillLicenseSchema', () => {
    it('should accept common license strings', () => {
      expect(SkillLicenseSchema.parse('MIT')).toBe('MIT');
      expect(SkillLicenseSchema.parse('Apache-2.0')).toBe('Apache-2.0');
      expect(SkillLicenseSchema.parse('BSD-3-Clause')).toBe('BSD-3-Clause');
    });

    it('should accept empty string', () => {
      expect(SkillLicenseSchema.parse('')).toBe('');
    });

    it('should accept undefined (optional)', () => {
      expect(SkillLicenseSchema.parse(undefined)).toBeUndefined();
    });
  });

  // ===========================================================================
  // SkillMetadataFieldSchema
  // ===========================================================================
  describe('SkillMetadataFieldSchema', () => {
    it('should accept record of string values', () => {
      const metadata = { author: 'john', version: '1.0.0' };
      expect(SkillMetadataFieldSchema.parse(metadata)).toEqual(metadata);
    });

    it('should accept empty record', () => {
      expect(SkillMetadataFieldSchema.parse({})).toEqual({});
    });

    it('should accept undefined (optional)', () => {
      expect(SkillMetadataFieldSchema.parse(undefined)).toBeUndefined();
    });
  });

  // ===========================================================================
  // SkillAllowedToolsSchema
  // ===========================================================================
  describe('SkillAllowedToolsSchema', () => {
    it('should accept array of tool names', () => {
      const tools = ['file-read', 'file-write', 'search'];
      expect(SkillAllowedToolsSchema.parse(tools)).toEqual(tools);
    });

    it('should accept empty array', () => {
      expect(SkillAllowedToolsSchema.parse([])).toEqual([]);
    });

    it('should accept undefined (optional)', () => {
      expect(SkillAllowedToolsSchema.parse(undefined)).toBeUndefined();
    });
  });

  // ===========================================================================
  // SkillMetadataSchema (full object)
  // ===========================================================================
  describe('SkillMetadataSchema', () => {
    it('should accept valid complete metadata', () => {
      const metadata = {
        name: 'my-skill',
        description: 'A helpful skill for users',
        license: 'MIT',
        compatibility: 'Node.js 18+',
        metadata: { author: 'john', version: '1.0.0' },
        allowedTools: ['read', 'write'],
      };
      expect(SkillMetadataSchema.parse(metadata)).toEqual(metadata);
    });

    it('should accept minimal metadata (only required fields)', () => {
      const metadata = {
        name: 'my-skill',
        description: 'A helpful skill',
      };
      const result = SkillMetadataSchema.parse(metadata);
      expect(result.name).toBe('my-skill');
      expect(result.description).toBe('A helpful skill');
      expect(result.license).toBeUndefined();
      expect(result.compatibility).toBeUndefined();
      expect(result.metadata).toBeUndefined();
      expect(result.allowedTools).toBeUndefined();
    });

    it('should reject missing name', () => {
      const metadata = { description: 'A skill' };
      expect(() => SkillMetadataSchema.parse(metadata)).toThrow();
    });

    it('should reject missing description', () => {
      const metadata = { name: 'my-skill' };
      expect(() => SkillMetadataSchema.parse(metadata)).toThrow();
    });

    it('should reject invalid name format', () => {
      const metadata = { name: 'My_Skill', description: 'A skill' };
      expect(() => SkillMetadataSchema.parse(metadata)).toThrow();
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
          allowedTools: ['read'],
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

  // ===========================================================================
  // parseAllowedTools function
  // ===========================================================================
  describe('parseAllowedTools', () => {
    describe('string input', () => {
      it('should parse space-delimited string', () => {
        expect(parseAllowedTools('tool1 tool2 tool3')).toEqual(['tool1', 'tool2', 'tool3']);
      });

      it('should handle multiple spaces', () => {
        expect(parseAllowedTools('tool1  tool2   tool3')).toEqual(['tool1', 'tool2', 'tool3']);
      });

      it('should handle tabs and newlines', () => {
        expect(parseAllowedTools('tool1\ttool2\ntool3')).toEqual(['tool1', 'tool2', 'tool3']);
      });

      it('should return empty array for empty string', () => {
        expect(parseAllowedTools('')).toEqual([]);
      });

      it('should return empty array for whitespace-only string', () => {
        expect(parseAllowedTools('   ')).toEqual([]);
      });

      it('should handle single tool', () => {
        expect(parseAllowedTools('tool1')).toEqual(['tool1']);
      });
    });

    describe('array input', () => {
      it('should return array as-is', () => {
        expect(parseAllowedTools(['tool1', 'tool2'])).toEqual(['tool1', 'tool2']);
      });

      it('should filter out non-string values', () => {
        expect(parseAllowedTools(['tool1', 123 as any, 'tool2', null as any])).toEqual(['tool1', 'tool2']);
      });

      it('should return empty array for empty array', () => {
        expect(parseAllowedTools([])).toEqual([]);
      });
    });

    describe('invalid input', () => {
      it('should return undefined for number', () => {
        expect(parseAllowedTools(123)).toBeUndefined();
      });

      it('should return undefined for object', () => {
        expect(parseAllowedTools({ tools: ['a'] })).toBeUndefined();
      });

      it('should return undefined for null', () => {
        expect(parseAllowedTools(null)).toBeUndefined();
      });

      it('should return undefined for undefined', () => {
        expect(parseAllowedTools(undefined)).toBeUndefined();
      });

      it('should return undefined for boolean', () => {
        expect(parseAllowedTools(true)).toBeUndefined();
      });
    });
  });
});

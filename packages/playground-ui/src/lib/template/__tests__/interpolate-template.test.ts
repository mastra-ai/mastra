import { describe, it, expect } from 'vitest';
import { interpolateTemplate } from '../interpolate-template';

describe('interpolateTemplate', () => {
  describe('basic variable replacement', () => {
    it('should replace simple variables', () => {
      const template = 'Hello {{name}}!';
      const variables = { name: 'World' };
      expect(interpolateTemplate(template, variables)).toBe('Hello World!');
    });

    it('should replace multiple occurrences of the same variable', () => {
      const template = '{{name}} and {{name}}';
      const variables = { name: 'Alice' };
      expect(interpolateTemplate(template, variables)).toBe('Alice and Alice');
    });

    it('should replace multiple different variables', () => {
      const template = '{{greeting}} {{name}}!';
      const variables = { greeting: 'Hello', name: 'World' };
      expect(interpolateTemplate(template, variables)).toBe('Hello World!');
    });
  });

  describe('nested paths (dot notation)', () => {
    it('should replace variables with dot notation', () => {
      const template = 'Hello {{user.name}}!';
      const variables = { user: { name: 'Alice' } };
      expect(interpolateTemplate(template, variables)).toBe('Hello Alice!');
    });

    it('should handle deeply nested paths', () => {
      const template = 'Value: {{a.b.c.d}}';
      const variables = { a: { b: { c: { d: 'deep' } } } };
      expect(interpolateTemplate(template, variables)).toBe('Value: deep');
    });

    it('should handle mixed simple and nested variables', () => {
      const template = '{{simple}} and {{nested.value}}';
      const variables = { simple: 'A', nested: { value: 'B' } };
      expect(interpolateTemplate(template, variables)).toBe('A and B');
    });
  });

  describe('missing variables', () => {
    it('should keep placeholder as-is when variable is not found', () => {
      const template = 'Hello {{missingVar}}!';
      const variables = {};
      expect(interpolateTemplate(template, variables)).toBe('Hello {{missingVar}}!');
    });

    it('should keep placeholder when partial path is missing', () => {
      const template = 'Hello {{user.missing}}!';
      const variables = { user: { name: 'Alice' } };
      expect(interpolateTemplate(template, variables)).toBe('Hello {{user.missing}}!');
    });

    it('should keep placeholder when parent in path is missing', () => {
      const template = 'Hello {{missing.nested.path}}!';
      const variables = {};
      expect(interpolateTemplate(template, variables)).toBe('Hello {{missing.nested.path}}!');
    });

    it('should handle mixed found and missing variables', () => {
      const template = '{{found}} and {{missing}}';
      const variables = { found: 'value' };
      expect(interpolateTemplate(template, variables)).toBe('value and {{missing}}');
    });
  });

  describe('edge cases', () => {
    it('should return empty string for empty template', () => {
      expect(interpolateTemplate('', { name: 'test' })).toBe('');
    });

    it('should return original string when no variables in template', () => {
      const template = 'No variables here';
      expect(interpolateTemplate(template, { name: 'test' })).toBe('No variables here');
    });

    it('should handle empty variables object', () => {
      const template = 'Hello {{name}}!';
      expect(interpolateTemplate(template, {})).toBe('Hello {{name}}!');
    });
  });

  describe('value type conversion', () => {
    it('should convert number to string', () => {
      const template = 'Count: {{count}}';
      const variables = { count: 42 };
      expect(interpolateTemplate(template, variables)).toBe('Count: 42');
    });

    it('should convert boolean to string', () => {
      const template = 'Active: {{active}}';
      const variables = { active: true };
      expect(interpolateTemplate(template, variables)).toBe('Active: true');
    });

    it('should convert null to "null"', () => {
      const template = 'Value: {{value}}';
      const variables = { value: null };
      expect(interpolateTemplate(template, variables)).toBe('Value: null');
    });

    it('should convert object to JSON string', () => {
      const template = 'Data: {{data}}';
      const variables = { data: { key: 'value' } };
      expect(interpolateTemplate(template, variables)).toBe('Data: {"key":"value"}');
    });

    it('should convert array to JSON string', () => {
      const template = 'Items: {{items}}';
      const variables = { items: [1, 2, 3] };
      expect(interpolateTemplate(template, variables)).toBe('Items: [1,2,3]');
    });
  });

  describe('real-world scenarios', () => {
    it('should work with markdown templates', () => {
      const template = `# Instructions

You are helping {{user.name}} at {{company.name}}.

## Context
- Role: {{user.role}}
- Language: {{settings.language}}`;

      const variables = {
        user: { name: 'Alice', role: 'Admin' },
        company: { name: 'Acme Corp' },
        settings: { language: 'English' },
      };

      const result = interpolateTemplate(template, variables);
      expect(result).toContain('You are helping Alice at Acme Corp.');
      expect(result).toContain('- Role: Admin');
      expect(result).toContain('- Language: English');
    });
  });
});

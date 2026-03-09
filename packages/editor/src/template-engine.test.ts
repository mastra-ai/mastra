import { describe, it, expect } from 'vitest';
import { renderTemplate } from './template-engine';

describe('renderTemplate', () => {
  describe('simple variable substitution', () => {
    it('should replace a simple variable', () => {
      expect(renderTemplate('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
    });

    it('should replace multiple variables', () => {
      const result = renderTemplate('{{greeting}} {{name}}!', { greeting: 'Hello', name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should handle numeric values', () => {
      expect(renderTemplate('Count: {{count}}', { count: 42 })).toBe('Count: 42');
    });

    it('should handle boolean values', () => {
      expect(renderTemplate('Active: {{active}}', { active: true })).toBe('Active: true');
    });

    it('should leave unresolved variables as-is', () => {
      expect(renderTemplate('Hello {{name}}!', {})).toBe('Hello {{name}}!');
    });

    it('should handle variables with underscores', () => {
      expect(renderTemplate('{{user_name}}', { user_name: 'Alice' })).toBe('Alice');
    });

    it('should handle whitespace inside braces', () => {
      expect(renderTemplate('{{ name }}', { name: 'Alice' })).toBe('Alice');
    });

    it('should handle null values as unresolved', () => {
      expect(renderTemplate('Hello {{name}}!', { name: null })).toBe('Hello {{name}}!');
    });

    it('should handle undefined values as unresolved', () => {
      expect(renderTemplate('Hello {{name}}!', { name: undefined })).toBe('Hello {{name}}!');
    });
  });

  describe('nested path resolution', () => {
    it('should resolve a nested path', () => {
      const context = { user: { name: 'Alice' } };
      expect(renderTemplate('Hello {{user.name}}!', context)).toBe('Hello Alice!');
    });

    it('should resolve deeply nested paths', () => {
      const context = { a: { b: { c: { d: 'deep' } } } };
      expect(renderTemplate('{{a.b.c.d}}', context)).toBe('deep');
    });

    it('should leave unresolved nested paths as-is', () => {
      expect(renderTemplate('{{user.name}}', { user: {} })).toBe('{{user.name}}');
    });

    it('should handle missing intermediate segments', () => {
      expect(renderTemplate('{{user.profile.name}}', { user: {} })).toBe('{{user.profile.name}}');
    });

    it('should handle null intermediate segments', () => {
      expect(renderTemplate('{{user.name}}', { user: null })).toBe('{{user.name}}');
    });
  });

  describe('fallback values', () => {
    it('should use single-quoted fallback when variable is missing', () => {
      expect(renderTemplate("Hello {{name || 'Guest'}}!", {})).toBe('Hello Guest!');
    });

    it('should use double-quoted fallback when variable is missing', () => {
      expect(renderTemplate('Hello {{name || "Guest"}}!', {})).toBe('Hello Guest!');
    });

    it('should prefer resolved value over fallback', () => {
      expect(renderTemplate("Hello {{name || 'Guest'}}!", { name: 'Alice' })).toBe('Hello Alice!');
    });

    it('should use fallback for null values', () => {
      expect(renderTemplate("{{val || 'default'}}", { val: null })).toBe('default');
    });

    it('should handle empty string fallback', () => {
      expect(renderTemplate("{{val || ''}}", {})).toBe('');
    });

    it('should handle fallback with spaces', () => {
      expect(renderTemplate("{{val || 'hello world'}}", {})).toBe('hello world');
    });

    it('should handle nested path with fallback', () => {
      expect(renderTemplate("{{user.role || 'viewer'}}", {})).toBe('viewer');
    });
  });

  describe('no-op cases', () => {
    it('should return plain text unchanged', () => {
      expect(renderTemplate('Hello World!', {})).toBe('Hello World!');
    });

    it('should handle empty template', () => {
      expect(renderTemplate('', {})).toBe('');
    });

    it('should not match single braces', () => {
      expect(renderTemplate('{name}', { name: 'Alice' })).toBe('{name}');
    });

    it('should not match triple braces', () => {
      expect(renderTemplate('{{{name}}}', { name: 'Alice' })).toBe('{Alice}');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { renderTemplate } from './template-engine';

describe('renderTemplate', () => {
  describe('simple variable substitution', () => {
    it.each([
      ['should replace a simple variable', 'Hello {{name}}!', 'World', 'Hello World!'],
      ['should handle whitespace inside braces', '{{ name }}', 'Alice', 'Alice'],
      ['should handle null values as unresolved', 'Hello {{name}}!', null, 'Hello {{name}}!'],
      ['should handle undefined values as unresolved', 'Hello {{name}}!', undefined, 'Hello {{name}}!'],
    ] as const)('%s', (_title, input, name, expected) => {
      expect(renderTemplate(input, { name })).toBe(expected);
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
  });

  describe('array and object serialization', () => {
    it('should JSON-stringify an array of objects', () => {
      const products = [
        { productKey: 'royal-canin', variant: 'rcv31115' },
        { productKey: 'zeal-treats', variant: 'dtz0110' },
      ];
      const result = renderTemplate('Products: {{products}}', { products });
      expect(result).toBe(`Products: ${JSON.stringify(products)}`);
    });

    it('should JSON-stringify a plain object', () => {
      const config = { theme: 'dark', lang: 'en' };
      const result = renderTemplate('Config: {{config}}', { config });
      expect(result).toBe(`Config: ${JSON.stringify(config)}`);
    });

    it('should JSON-stringify a simple array', () => {
      const tags = ['urgent', 'bug', 'frontend'];
      const result = renderTemplate('Tags: {{tags}}', { tags });
      expect(result).toBe(`Tags: ${JSON.stringify(tags)}`);
    });

    it('should JSON-stringify a nested object via dot-path', () => {
      const context = { user: { preferences: { notifications: true, theme: 'dark' } } };
      const result = renderTemplate('Prefs: {{user.preferences}}', context);
      expect(result).toBe(`Prefs: ${JSON.stringify(context.user.preferences)}`);
    });

    it('should JSON-stringify a nested array via dot-path', () => {
      const context = { cart: { items: [{ id: 1 }, { id: 2 }] } };
      const result = renderTemplate('Items: {{cart.items}}', context);
      expect(result).toBe(`Items: ${JSON.stringify(context.cart.items)}`);
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
    it.each([
      ['should use single-quoted fallback when variable is missing', "Hello {{name || 'Guest'}}!", 'Hello Guest!'],
      ['should use double-quoted fallback when variable is missing', 'Hello {{name || "Guest"}}!', 'Hello Guest!'],
      ['should handle empty string fallback', "{{val || ''}}", ''],
      ['should handle fallback with spaces', "{{val || 'hello world'}}", 'hello world'],
      ['should handle nested path with fallback', "{{user.role || 'viewer'}}", 'viewer'],
    ] as const)('%s', (_title, input, expected) => {
      expect(renderTemplate(input, {})).toBe(expected);
    });

    it('should prefer resolved value over fallback', () => {
      expect(renderTemplate("Hello {{name || 'Guest'}}!", { name: 'Alice' })).toBe('Hello Alice!');
    });

    it('should use fallback for null values', () => {
      expect(renderTemplate("{{val || 'default'}}", { val: null })).toBe('default');
    });
  });

  describe('inherited properties', () => {
    it.each([
      ['should leave an inherited member unresolved', '{{constructor}}', '{{constructor}}'],
      ['should leave toString unresolved', '{{toString}}', '{{toString}}'],
      ['should leave valueOf unresolved', '{{valueOf}}', '{{valueOf}}'],
      ['should use the fallback for an inherited member', "{{constructor || 'none'}}", 'none'],
      ['should use the fallback for inherited toString', "{{toString || 'none'}}", 'none'],
    ] as const)('%s', (_title, input, expected) => {
      expect(renderTemplate(input, { name: 'Alice' })).toBe(expected);
    });

    it('should resolve an own key that shadows a built-in name', () => {
      expect(renderTemplate('{{toString}}', { toString: 'shadowed' })).toBe('shadowed');
    });

    it('should leave a nested inherited member unresolved', () => {
      expect(renderTemplate('{{user.constructor}}', { user: { name: 'Alice' } })).toBe('{{user.constructor}}');
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

import { describe, it, expect } from 'vitest';
import { normalizeServerBase } from '../utils';

describe('normalizeServerBase', () => {
  describe('special cases', () => {
    it('should return empty string for root path', () => {
      expect(normalizeServerBase('/')).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(normalizeServerBase('')).toBe('');
    });
  });

  describe('basic normalization', () => {
    it('should add leading slash when missing', () => {
      expect(normalizeServerBase('admin')).toBe('/admin');
    });

    it('should preserve leading slash', () => {
      expect(normalizeServerBase('/admin')).toBe('/admin');
    });

    it('should remove trailing slash', () => {
      expect(normalizeServerBase('/admin/')).toBe('/admin');
    });

    it('should add leading slash and remove trailing slash', () => {
      expect(normalizeServerBase('admin/')).toBe('/admin');
    });

    it('should handle nested paths', () => {
      expect(normalizeServerBase('/admin/panel')).toBe('/admin/panel');
      expect(normalizeServerBase('admin/panel')).toBe('/admin/panel');
      expect(normalizeServerBase('/admin/panel/')).toBe('/admin/panel');
    });
  });

  describe('multiple slashes normalization', () => {
    it('should normalize double slashes to single slash', () => {
      expect(normalizeServerBase('//admin')).toBe('/admin');
    });

    it('should normalize multiple consecutive slashes', () => {
      expect(normalizeServerBase('///admin')).toBe('/admin');
      expect(normalizeServerBase('////admin')).toBe('/admin');
    });

    it('should normalize slashes in the middle of path', () => {
      expect(normalizeServerBase('/admin//test')).toBe('/admin/test');
      expect(normalizeServerBase('/admin///test')).toBe('/admin/test');
    });

    it('should normalize multiple slash groups', () => {
      expect(normalizeServerBase('//admin//test//panel')).toBe('/admin/test/panel');
    });

    it('should handle trailing multiple slashes', () => {
      expect(normalizeServerBase('/admin//')).toBe('/admin');
      expect(normalizeServerBase('/admin///')).toBe('/admin');
    });
  });

  describe('validation - path traversal', () => {
    it('should throw error for path with parent directory traversal', () => {
      expect(() => normalizeServerBase('../secret')).toThrow(
        "Invalid base path: \"../secret\". Base path cannot contain '..', '?', or '#'",
      );
    });

    it('should throw error for path with traversal in middle', () => {
      expect(() => normalizeServerBase('/admin/../secret')).toThrow(
        "Invalid base path: \"/admin/../secret\". Base path cannot contain '..', '?', or '#'",
      );
    });

    it('should throw error for path with multiple traversals', () => {
      expect(() => normalizeServerBase('../../secret')).toThrow(
        "Invalid base path: \"../../secret\". Base path cannot contain '..', '?', or '#'",
      );
    });
  });

  describe('validation - query parameters', () => {
    it('should throw error for path with query string', () => {
      expect(() => normalizeServerBase('/admin?query=1')).toThrow(
        "Invalid base path: \"/admin?query=1\". Base path cannot contain '..', '?', or '#'",
      );
    });

    it('should throw error for path with multiple query parameters', () => {
      expect(() => normalizeServerBase('/admin?a=1&b=2')).toThrow(
        "Invalid base path: \"/admin?a=1&b=2\". Base path cannot contain '..', '?', or '#'",
      );
    });
  });

  describe('validation - hash fragments', () => {
    it('should throw error for path with hash', () => {
      expect(() => normalizeServerBase('/admin#section')).toThrow(
        "Invalid base path: \"/admin#section\". Base path cannot contain '..', '?', or '#'",
      );
    });

    it('should throw error for path with just hash', () => {
      expect(() => normalizeServerBase('#anchor')).toThrow(
        "Invalid base path: \"#anchor\". Base path cannot contain '..', '?', or '#'",
      );
    });
  });

  describe('validation - combined invalid characters', () => {
    it('should throw error for path with query and hash', () => {
      expect(() => normalizeServerBase('/admin?query=1#section')).toThrow(
        "Invalid base path: \"/admin?query=1#section\". Base path cannot contain '..', '?', or '#'",
      );
    });

    it('should throw error for path with traversal and query', () => {
      expect(() => normalizeServerBase('../admin?query=1')).toThrow(
        "Invalid base path: \"../admin?query=1\". Base path cannot contain '..', '?', or '#'",
      );
    });
  });

  describe('real-world examples', () => {
    it('should handle common base path patterns', () => {
      expect(normalizeServerBase('api')).toBe('/api');
      expect(normalizeServerBase('admin')).toBe('/admin');
      expect(normalizeServerBase('studio')).toBe('/studio');
      expect(normalizeServerBase('v1')).toBe('/v1');
    });

    it('should handle versioned API paths', () => {
      expect(normalizeServerBase('/api/v1')).toBe('/api/v1');
      expect(normalizeServerBase('api/v2/')).toBe('/api/v2');
    });

    it('should handle dashboard/admin paths', () => {
      expect(normalizeServerBase('/admin/dashboard')).toBe('/admin/dashboard');
      expect(normalizeServerBase('admin/panel/')).toBe('/admin/panel');
    });

    it('should handle hyphenated paths', () => {
      expect(normalizeServerBase('/my-app')).toBe('/my-app');
      expect(normalizeServerBase('my-admin-panel')).toBe('/my-admin-panel');
    });

    it('should handle underscored paths', () => {
      expect(normalizeServerBase('/my_app')).toBe('/my_app');
      expect(normalizeServerBase('admin_panel')).toBe('/admin_panel');
    });
  });

  describe('edge cases', () => {
    it('should handle single character paths', () => {
      expect(normalizeServerBase('a')).toBe('/a');
      expect(normalizeServerBase('/a')).toBe('/a');
    });

    it('should normalize multiple slashes to empty string', () => {
      // Multiple slashes normalize to '/' during normalization step
      // Then caught by the post-normalization check that returns ''
      expect(normalizeServerBase('///')).toBe('');
      expect(normalizeServerBase('//')).toBe('');
    });

    it('should handle deep nested paths', () => {
      expect(normalizeServerBase('/a/b/c/d/e/f')).toBe('/a/b/c/d/e/f');
      expect(normalizeServerBase('a/b/c/d/e/f/')).toBe('/a/b/c/d/e/f');
    });

    it('should handle paths with numbers', () => {
      expect(normalizeServerBase('/app123')).toBe('/app123');
      expect(normalizeServerBase('v2024')).toBe('/v2024');
    });

    it('should handle mixed case paths', () => {
      expect(normalizeServerBase('/Admin')).toBe('/Admin');
      expect(normalizeServerBase('MyApp')).toBe('/MyApp');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { normalizeRoutePath } from './index';

describe('normalizeRoutePath', () => {
  describe('special cases', () => {
    it('should return empty string for root path', () => {
      expect(normalizeRoutePath('/')).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(normalizeRoutePath('')).toBe('');
    });

    it('should trim whitespace', () => {
      expect(normalizeRoutePath('  /api  ')).toBe('/api');
      expect(normalizeRoutePath('  api  ')).toBe('/api');
    });
  });

  describe('basic normalization', () => {
    it('should add leading slash when missing', () => {
      expect(normalizeRoutePath('api')).toBe('/api');
    });

    it('should preserve leading slash', () => {
      expect(normalizeRoutePath('/api')).toBe('/api');
    });

    it('should remove trailing slash', () => {
      expect(normalizeRoutePath('/api/')).toBe('/api');
    });

    it('should add leading slash and remove trailing slash', () => {
      expect(normalizeRoutePath('api/')).toBe('/api');
    });

    it('should handle nested paths', () => {
      expect(normalizeRoutePath('/api/v1')).toBe('/api/v1');
      expect(normalizeRoutePath('api/v1')).toBe('/api/v1');
      expect(normalizeRoutePath('/api/v1/')).toBe('/api/v1');
    });
  });

  describe('multiple slashes normalization', () => {
    it('should normalize double slashes to single slash', () => {
      expect(normalizeRoutePath('//api')).toBe('/api');
    });

    it('should normalize multiple consecutive slashes', () => {
      expect(normalizeRoutePath('///api')).toBe('/api');
    });

    it('should normalize slashes in the middle of path', () => {
      expect(normalizeRoutePath('/api//v1')).toBe('/api/v1');
    });

    it('should normalize multiple slashes to empty string', () => {
      expect(normalizeRoutePath('///')).toBe('');
      expect(normalizeRoutePath('//')).toBe('');
    });
  });

  describe('validation', () => {
    it('should throw error for path traversal', () => {
      expect(() => normalizeRoutePath('../secret')).toThrow(/cannot contain/);
      expect(() => normalizeRoutePath('/api/../secret')).toThrow(/cannot contain/);
    });

    it('should throw error for query parameters', () => {
      expect(() => normalizeRoutePath('/api?query=1')).toThrow(/cannot contain/);
    });

    it('should throw error for hash fragments', () => {
      expect(() => normalizeRoutePath('/api#section')).toThrow(/cannot contain/);
    });
  });
});

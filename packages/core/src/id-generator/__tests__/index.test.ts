import { describe, it, expect } from 'vitest';
import { generateId, createIdGenerator } from '../index';

describe('ID Generator', () => {
  describe('generateId', () => {
    it('should generate a unique ID', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    it('should generate IDs with default length of 16 characters', () => {
      const id = generateId();
      expect(id.length).toBe(16);
    });

    it('should generate unique IDs across multiple calls', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('createIdGenerator', () => {
    it('should create a generator with prefix', () => {
      const generator = createIdGenerator({ prefix: 'test' });
      const id = generator();

      expect(id).toMatch(/^test-[a-zA-Z0-9]{16}$/);
    });

    it('should create a generator with custom separator', () => {
      const generator = createIdGenerator({ prefix: 'test', separator: '_' });
      const id = generator();

      expect(id).toMatch(/^test_[a-zA-Z0-9]{16}$/);
    });

    it('should create a generator with custom size', () => {
      const generator = createIdGenerator({ size: 8 });
      const id = generator();

      expect(id.length).toBe(8);
    });

    it('should create a generator with prefix and custom size', () => {
      const generator = createIdGenerator({ prefix: 'msg', size: 8 });
      const id = generator();

      expect(id).toMatch(/^msg-[a-zA-Z0-9]{8}$/);
      expect(id.length).toBe(12); // 'msg' + '-' + 8 chars
    });

    it('should generate unique IDs', () => {
      const generator = createIdGenerator({ prefix: 'test' });
      const id1 = generator();
      const id2 = generator();

      expect(id1).not.toBe(id2);
      expect(id1.startsWith('test-')).toBe(true);
      expect(id2.startsWith('test-')).toBe(true);
    });
  });
});

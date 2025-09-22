import { describe, it, expect } from 'vitest';
import { DrizzleStore } from '../index';

describe('DrizzleStore Setup', () => {
  it('should create a DrizzleStore instance', () => {
    const store = new DrizzleStore({
      dialect: 'postgresql',
      connection: 'postgresql://test:test@localhost:5432/test',
    });

    expect(store).toBeInstanceOf(DrizzleStore);
  });

  it('should have correct capabilities', () => {
    const store = new DrizzleStore({
      dialect: 'postgresql',
      connection: 'postgresql://test:test@localhost:5432/test',
    });

    const capabilities = store.supports;
    expect(capabilities.selectByIncludeResourceScope).toBe(true);
    expect(capabilities.resourceWorkingMemory).toBe(true);
    expect(capabilities.hasColumn).toBe(true);
    expect(capabilities.createTable).toBe(true);
    expect(capabilities.deleteMessages).toBe(true);
    expect(capabilities.aiTracing).toBe(true);
    expect(capabilities.indexManagement).toBe(true);
  });

  it('should require initialization before using getDb', () => {
    const store = new DrizzleStore({
      dialect: 'postgresql',
      connection: 'postgresql://test:test@localhost:5432/test',
    });

    expect(() => store.getDb()).toThrow('DrizzleStore not initialized');
  });

  it('should support different dialects', () => {
    const dialects = ['postgresql', 'mysql', 'sqlite', 'turso', 'planetscale', 'neon', 'vercel-postgres'] as const;

    dialects.forEach(dialect => {
      const store = new DrizzleStore({
        dialect,
        connection: 'test-connection',
      });

      expect(store).toBeInstanceOf(DrizzleStore);
    });
  });
});

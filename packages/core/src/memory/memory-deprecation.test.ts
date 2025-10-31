import { describe, expect, it } from 'vitest';

import { InMemoryMemory } from '../storage/domains/memory/inmemory';
import { MastraMemory } from './memory';

describe('Memory Deprecation', () => {
  const createStorage = () =>
    new InMemoryMemory({
      collection: {
        threads: new Map(),
        resources: new Map(),
        messages: new Map(),
      } as any,
      operations: {} as any,
    });

  it('should throw error when processors config is used', () => {
    const storage = createStorage();

    expect(() => {
      new MastraMemory({
        name: 'test-memory',
        storage,
        processors: [],
      });
    }).toThrow(/processors.*deprecated/i);
  });

  it('should not throw error when processors config is not used', () => {
    const storage = createStorage();

    expect(() => {
      new MastraMemory({
        name: 'test-memory',
        storage,
        options: {
          lastMessages: 10,
        },
      });
    }).not.toThrow();
  });

  it('should throw error with helpful migration message', () => {
    const storage = createStorage();

    try {
      new MastraMemory({
        name: 'test-memory',
        storage,
        processors: [],
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('processors');
      expect((error as Error).message).toContain('deprecated');
      expect((error as Error).message).toContain('Input/Output');
    }
  });
});

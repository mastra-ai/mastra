import { describe, expect, it } from 'vitest';

import {
  inheritProcessorLoadedToolSource,
  markProcessorLoadedToolSource,
  processorLoadedToolSource,
} from './tool-provenance';

describe('processor loaded tool provenance', () => {
  it('stamps an opaque token instead of the executable source', async () => {
    const source = {
      id: 'weather',
      execute: async () => 'approved',
    };
    markProcessorLoadedToolSource(source, source);

    const token = processorLoadedToolSource(source);
    expect(token).toBeDefined();
    expect(token).not.toBe(source);
    expect(Object.isFrozen(token)).toBe(true);
    expect(token).not.toHaveProperty('execute');

    const converted = {
      id: 'weather',
      execute: source.execute,
    };
    inheritProcessorLoadedToolSource(source, converted);
    expect(processorLoadedToolSource(converted)).toBe(token);
    expect(processorLoadedToolSource(converted)).not.toBe(source);

    expect(() => {
      (token as { execute?: () => string }).execute = () => 'replaced';
    }).toThrow(TypeError);
    await expect(source.execute()).resolves.toBe('approved');
    await expect(converted.execute()).resolves.toBe('approved');
  });

  it('does not treat a foreign tool as the same loaded source', () => {
    const source = { id: 'weather', execute: async () => 'approved' };
    const foreign = { id: 'weather', execute: async () => 'foreign' };
    markProcessorLoadedToolSource(source, source);

    expect(processorLoadedToolSource(foreign)).toBeUndefined();
    expect(processorLoadedToolSource(source)).not.toBe(processorLoadedToolSource(foreign));
  });
});

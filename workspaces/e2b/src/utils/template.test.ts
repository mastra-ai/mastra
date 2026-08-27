import { describe, expect, it } from 'vitest';

import { createDefaultMountableTemplate } from './template';

describe('createDefaultMountableTemplate', () => {
  it('keys the id off machine resources — a resize is a new template, never a reuse', () => {
    const plain = createDefaultMountableTemplate();
    expect(createDefaultMountableTemplate({ memoryMB: 2048 }).id).not.toBe(plain.id);
    expect(createDefaultMountableTemplate({ cpuCount: 4 }).id).not.toBe(plain.id);
    // Absent and explicitly-default are the same template.
    expect(createDefaultMountableTemplate({ cpuCount: 2, memoryMB: 1024 }).id).toBe(plain.id);
  });

  it('returns the normalized resources so builds always match the hash', () => {
    expect(createDefaultMountableTemplate().resources).toEqual({ cpuCount: 2, memoryMB: 1024 });
    expect(createDefaultMountableTemplate({ memoryMB: 2048 }).resources).toEqual({ cpuCount: 2, memoryMB: 2048 });
  });
});

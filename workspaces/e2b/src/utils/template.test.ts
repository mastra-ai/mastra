import { describe, expect, it } from 'vitest';

import { createDefaultMountableTemplate, DEFAULT_NODE_VERSION } from './template';

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

  it('keys the id off the node version — a runtime change is a new template', () => {
    const plain = createDefaultMountableTemplate();
    expect(createDefaultMountableTemplate({ nodeVersion: '22.23.2' }).id).not.toBe(plain.id);
    // Absent and explicitly-default are the same template.
    expect(createDefaultMountableTemplate({ nodeVersion: DEFAULT_NODE_VERSION }).id).toBe(plain.id);
  });

  it('rejects a node version that is not an exact MAJOR.MINOR.PATCH', () => {
    expect(() => createDefaultMountableTemplate({ nodeVersion: 'lts' })).toThrow(/expected an exact version/);
    expect(() => createDefaultMountableTemplate({ nodeVersion: '24.20.0; rm -rf /' })).toThrow(
      /expected an exact version/,
    );
  });
});

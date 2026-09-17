import { describe, expect, it } from 'vitest';

import { createDefaultMountableTemplate, DEFAULT_NODE_VERSION } from './template';

describe('createDefaultMountableTemplate', () => {
  it('keys the id off machine resources — a resize is a new template, never a reuse', async () => {
    const plain = await createDefaultMountableTemplate();
    expect((await createDefaultMountableTemplate({ memoryMB: 2048 })).id).not.toBe(plain.id);
    expect((await createDefaultMountableTemplate({ cpuCount: 4 })).id).not.toBe(plain.id);
    expect((await createDefaultMountableTemplate({ cpuCount: 2, memoryMB: 1024 })).id).toBe(plain.id);
  });

  it('returns the normalized resources so builds always match the hash', async () => {
    expect((await createDefaultMountableTemplate()).resources).toEqual({ cpuCount: 2, memoryMB: 1024 });
    expect((await createDefaultMountableTemplate({ memoryMB: 2048 })).resources).toEqual({
      cpuCount: 2,
      memoryMB: 2048,
    });
  });

  it('keys the id off the node version — a runtime change is a new template', async () => {
    const plain = await createDefaultMountableTemplate();
    expect((await createDefaultMountableTemplate({ nodeVersion: '22.23.2' })).id).not.toBe(plain.id);
    expect((await createDefaultMountableTemplate({ nodeVersion: DEFAULT_NODE_VERSION })).id).toBe(plain.id);
  });

  it('rejects a node version that is not an exact MAJOR.MINOR.PATCH', async () => {
    await expect(createDefaultMountableTemplate({ nodeVersion: 'lts' })).rejects.toThrow(/expected an exact version/);
    await expect(createDefaultMountableTemplate({ nodeVersion: '24.20.0; rm -rf /' })).rejects.toThrow(
      /expected an exact version/,
    );
  });
});

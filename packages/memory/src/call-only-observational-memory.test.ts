import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { Memory } from './index';

const om = { scope: 'thread', model: 'openai/gpt-4o-mini' } as const;

function memoryWith(observationalMemory?: unknown) {
  const memory = new Memory({
    storage: new InMemoryStore(),
    options: observationalMemory === undefined ? {} : ({ observationalMemory } as any),
  });
  const warn = vi.spyOn((memory as any).logger, 'warn');
  return { memory, warn };
}

describe('per-call observationalMemory on Memory.getMergedThreadConfig', () => {
  it('turns a call opt-in off when the instance has no OM, and warns once', () => {
    const { memory, warn } = memoryWith();
    expect(memory.getMergedThreadConfig({ observationalMemory: true }).observationalMemory).toBe(false);
    expect(memory.getMergedThreadConfig({ observationalMemory: om as any }).observationalMemory).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('turns a call opt-in off when the instance sets { enabled: false }', () => {
    const { memory, warn } = memoryWith({ enabled: false });
    expect(memory.getMergedThreadConfig({ observationalMemory: true }).observationalMemory).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('leaves a call opt-out unchanged and does not warn', () => {
    const withOM = memoryWith(om);
    expect(withOM.memory.getMergedThreadConfig({ observationalMemory: false }).observationalMemory).toBe(false);
    expect(
      withOM.memory.getMergedThreadConfig({ observationalMemory: { enabled: false } as any }).observationalMemory,
    ).toMatchObject({ enabled: false });

    const withoutOM = memoryWith();
    expect(
      withoutOM.memory.getMergedThreadConfig({ observationalMemory: { enabled: false } as any }).observationalMemory,
    ).toEqual({ enabled: false });
    expect(withOM.warn).not.toHaveBeenCalled();
    expect(withoutOM.warn).not.toHaveBeenCalled();
  });

  it('keeps a call opt-in when the instance configures OM', () => {
    const { memory, warn } = memoryWith(om);
    expect(memory.getMergedThreadConfig({ observationalMemory: true }).observationalMemory).toBeTruthy();
    expect(warn).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';

import { NoOpObservability, isNoOpObservability } from './no-op';

describe('NoOpObservability', () => {
  it('retains constructor and subclass compatibility', () => {
    class CustomNoOpObservability extends NoOpObservability {}

    const instance = new NoOpObservability();
    const subclassInstance = new CustomNoOpObservability();

    expect(isNoOpObservability(instance)).toBe(true);
    expect(isNoOpObservability(subclassInstance)).toBe(true);
    expect(subclassInstance).toBeInstanceOf(NoOpObservability);
  });

  it('recognizes instances created by a reloaded module copy', async () => {
    const firstCopy = await import('./no-op');
    const instance = new firstCopy.NoOpObservability();

    vi.resetModules();
    const reloadedCopy = await import('./no-op');

    expect(reloadedCopy.isNoOpObservability(instance)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import type { Agent } from '../agent';
import type { MastraMemory } from '../memory';
import { InMemoryHarness } from '../storage/domains/harness';
import { Harness } from '../harness/v1';
import { Mastra } from './index';

function createHarness(ownerId = 'harness-owner') {
  return new Harness({
    ownerId,
    agent: {} as Agent,
    storage: new InMemoryHarness(),
    memory: {} as MastraMemory,
    modes: [{ id: 'default', defaultModelId: 'test-model' }],
    defaultModeId: 'default',
  });
}

describe('Mastra harness registration', () => {
  it('registers harnesses from config', () => {
    const harness = createHarness();
    const mastra = new Mastra({
      logger: false,
      harnesses: { main: harness },
    });

    expect(mastra.getHarness('main')).toBe(harness);
    expect(mastra.getHarnessById('harness-owner')).toBe(harness);
    expect(mastra.listHarnesses()).toEqual({ main: harness });
  });

  it('adds harnesses after construction', () => {
    const harness = createHarness('runtime-owner');
    const mastra = new Mastra({ logger: false });

    mastra.addHarness(harness, 'runtime');

    expect(mastra.getHarness('runtime')).toBe(harness);
    expect(mastra.getHarnessById('runtime-owner')).toBe(harness);
  });

  it('throws when a harness cannot be found', () => {
    const mastra = new Mastra({ logger: false });

    expect(() => mastra.getHarness('missing')).toThrow('Harness with key missing not found');
    expect(() => mastra.getHarnessById('missing')).toThrow('Harness with id missing not found');
  });
});

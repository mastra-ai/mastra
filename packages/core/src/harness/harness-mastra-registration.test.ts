import { describe, expect, it } from 'vitest';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage/mock';
import { createTestAgent, createTestHarness } from './test-utils';

describe('Harness ↔ Mastra registration', () => {
  it('uses its own internal Mastra when standalone', async () => {
    const harness = createTestHarness({ storage: new InMemoryStore() });
    await harness.init();

    const mastra = harness.getMastra();
    expect(mastra).toBeInstanceOf(Mastra);
  });

  it('uses the parent Mastra when registered on one', async () => {
    const harness = createTestHarness({ storage: new InMemoryStore() });

    const mastra = new Mastra({ harnesses: { code: harness } });

    // Registered before init(): getMastra() resolves to the parent immediately.
    expect(harness.getMastra()).toBe(mastra);
    expect(mastra.getHarness('code')).toBe(harness);

    // init() must not replace the parent Mastra with a fresh internal one.
    await harness.init();
    expect(harness.getMastra()).toBe(mastra);
  });

  it('hosts multiple independent harnesses keyed by id', async () => {
    const code = createTestHarness({ id: 'code-harness', storage: new InMemoryStore() });
    const support = createTestHarness({
      id: 'support-harness',
      storage: new InMemoryStore(),
      agent: createTestAgent({ id: 'support-agent', name: 'support-agent' }),
    });

    const mastra = new Mastra({ harnesses: { code, support } });

    expect(mastra.getHarness('code')).toBe(code);
    expect(mastra.getHarness('support')).toBe(support);
    expect(Object.keys(mastra.listHarnesses())).toEqual(['code', 'support']);

    // Each harness resolves to the same parent Mastra but stays independent.
    expect(code.getMastra()).toBe(mastra);
    expect(support.getMastra()).toBe(mastra);
    expect(code).not.toBe(support);
  });

  it('registers each harness backing agent on the parent Mastra', async () => {
    const harness = createTestHarness({ storage: new InMemoryStore() });
    const mastra = new Mastra({ harnesses: { code: harness } });

    await harness.init();

    // The default mode's agent should be registered on the parent Mastra,
    // reachable by its id, so the parent owns the agent surface.
    const agent = mastra.getAgentById('test-agent');
    expect(agent).toBeDefined();
  });

  it('returns undefined from getHarness when no harness is registered', () => {
    const mastra = new Mastra({});
    expect(mastra.getHarness('code')).toBeUndefined();
    expect(mastra.listHarnesses()).toEqual({});
  });
});

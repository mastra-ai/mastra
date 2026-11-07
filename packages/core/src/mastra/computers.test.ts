import { describe, expect, it } from 'vitest';
import type { MastraComputers } from './computers';
import { Mastra } from '.';

describe('Mastra computers registration', () => {
  it('returns the registered computers provider', () => {
    const computers: MastraComputers = { tools: () => ({}), viewer: async () => null };
    expect(new Mastra({ logger: false, computers }).getComputers()).toBe(computers);
  });

  it('accepts a provider with control members', async () => {
    const computers: MastraComputers = {
      tools: () => ({}),
      viewer: async () => null,
      controlState: async () => ({ holder: 'agent' }),
      control: async () => ({ holder: 'human', notified: false, reason: 'no-agent' }),
    };
    const registered = new Mastra({ logger: false, computers }).getComputers();
    await expect(registered?.controlState?.('c', { threadId: 't', resourceId: 'r' })).resolves.toEqual({
      holder: 'agent',
    });
  });

  it('is undefined when no computers are registered', () => {
    expect(new Mastra({ logger: false }).getComputers()).toBeUndefined();
  });

  it('hands the provider its Mastra instance', () => {
    let seen: unknown;
    const computers: MastraComputers = {
      tools: () => ({}),
      viewer: async () => null,
      __registerMastra: mastra => {
        seen = mastra;
      },
    };
    const mastra = new Mastra({ logger: false, computers });
    expect(seen).toBe(mastra);
  });
});

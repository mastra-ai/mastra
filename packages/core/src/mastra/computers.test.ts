import { describe, expect, it } from 'vitest';
import type { MastraComputers } from './computers';
import { Mastra } from '.';

describe('Mastra computers registration', () => {
  it('returns the registered computers provider', () => {
    const computers: MastraComputers = { tools: () => ({}), viewer: async () => null };
    expect(new Mastra({ logger: false, computers }).getComputers()).toBe(computers);
  });

  it('is undefined when no computers are registered', () => {
    expect(new Mastra({ logger: false }).getComputers()).toBeUndefined();
  });
});

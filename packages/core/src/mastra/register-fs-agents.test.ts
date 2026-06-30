import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { createDurableAgent } from '../agent/durable';
import { Mastra } from './index';

function makeAgent(name: string) {
  return new Agent({
    id: name,
    name,
    instructions: `You are ${name}`,
    model: 'openai/gpt-4o',
  });
}

describe('Mastra.__registerFsAgents', () => {
  it('merges file-system agents into the instance', () => {
    const mastra = new Mastra({
      agents: { coded: makeAgent('coded') },
    });

    mastra.__registerFsAgents({ weather: makeAgent('weather') });

    expect(mastra.getAgent('coded')).toBeDefined();
    expect(mastra.getAgent('weather')).toBeDefined();
  });

  it('marks file-system agents with source "fs"', () => {
    const mastra = new Mastra({});
    mastra.__registerFsAgents({ weather: makeAgent('weather') });
    expect(mastra.getAgent('weather').source).toBe('fs');
  });

  it('keeps the code-registered agent on name collision and warns', () => {
    const coded = makeAgent('weather');
    const fsAgent = makeAgent('weather');
    const mastra = new Mastra({ agents: { weather: coded } });

    const warn = vi.fn();
    mastra.getLogger().warn = warn;

    mastra.__registerFsAgents({ weather: fsAgent });

    expect(mastra.getAgent('weather')).toBe(coded);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('weather'));
  });

  it('stamps source on durable agents registered with a source', () => {
    const base = makeAgent('durable-weather');
    const durable = createDurableAgent({ agent: base, id: 'durable-weather', name: 'durable-weather' });
    const mastra = new Mastra({});

    mastra.addAgent(durable, 'durable-weather', { source: 'fs' });

    expect(mastra.getAgent('durable-weather').source).toBe('fs');
  });

  it('skips null entries without throwing', () => {
    const mastra = new Mastra({});
    expect(() => mastra.__registerFsAgents({ bad: null as unknown as Agent, good: makeAgent('good') })).not.toThrow();
    expect(mastra.getAgent('good')).toBeDefined();
  });
});

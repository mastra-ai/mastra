import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { assembleAgentFromFsEntry } from '../agent/fs-routing';
import { createTool } from '../tools';
import { Mastra } from './index';

/**
 * End-to-end guarantee that the two agent-registration schemes coexist: an agent
 * passed to `new Mastra({ agents })` (code config) and an agent assembled from
 * file-system entries via `assembleAgentFromFsEntry` then merged with
 * `__registerFsAgents` (fs routing). Both must show up on the instance and keep
 * their own configuration.
 */
describe('code-config and fs-routing agents coexist', () => {
  it('exposes both a code-registered and an fs-assembled agent', async () => {
    const codeAgent = new Agent({
      id: 'support',
      name: 'support',
      instructions: 'You are the support agent.',
      model: 'openai/gpt-4o',
    });

    const mastra = new Mastra({ agents: { support: codeAgent } });

    const weatherTool = createTool({
      id: 'get_weather',
      description: 'get weather',
      execute: async () => ({ temp: 70 }),
    });

    const fsAgent = assembleAgentFromFsEntry({
      name: 'weather',
      config: { model: 'openai/gpt-4o' },
      instructionsMd: 'You are the weather agent.',
      tools: [{ key: 'get_weather', tool: weatherTool }],
    });

    mastra.__registerFsAgents({ weather: fsAgent });

    const agents = mastra.listAgents();
    expect(Object.keys(agents).sort()).toEqual(['support', 'weather']);

    // Code agent is the exact instance passed in and keeps source "code".
    expect(mastra.getAgent('support')).toBe(codeAgent);
    expect(mastra.getAgent('support').source).toBe('code');

    // Fs agent kept its assembled config: instructions from markdown + its tool.
    const weather = mastra.getAgent('weather' as 'support');
    expect(weather.source).toBe('fs');
    const instructions = await Promise.resolve(weather.getInstructions());
    expect(instructions).toContain('weather agent');
    const tools = await Promise.resolve(weather.listTools());
    expect(Object.keys(tools)).toContain('get_weather');
  });

  it('does not let an fs agent override a code agent with the same name', () => {
    const codeAgent = new Agent({
      id: 'weather',
      name: 'weather',
      instructions: 'Code-defined weather agent.',
      model: 'openai/gpt-4o',
    });
    const mastra = new Mastra({ agents: { weather: codeAgent } });

    const warn = vi.fn();
    mastra.getLogger().warn = warn;

    const fsAgent = assembleAgentFromFsEntry({
      name: 'weather',
      config: { model: 'openai/gpt-4o' },
      instructionsMd: 'Fs-defined weather agent.',
    });
    mastra.__registerFsAgents({ weather: fsAgent });

    // Code agent wins; a warning is surfaced.
    expect(mastra.getAgent('weather')).toBe(codeAgent);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('weather'));
  });
});

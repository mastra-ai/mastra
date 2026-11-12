import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Memory } from './index';

const agentWithMemory = (id: string, memory: Memory) =>
  new Agent({ id, name: id, model: 'openai/gpt-4o', instructions: 'Respond', memory });

describe('agent memory storage diagnostics', () => {
  it('explains both ways to supply storage when the agent is not registered', async () => {
    const agent = agentWithMemory('unregistered', new Memory());
    const memory = await agent.getMemory();

    expect(() => memory!.storage).toThrow('Memory requires a storage provider');
    expect(() => memory!.storage).toThrow('register the agent with that Mastra instance');
    expect(() => memory!.storage).toThrow('Standalone agents must configure storage directly on Memory');
  });

  it('inherits storage once the agent is registered', async () => {
    const agent = agentWithMemory('registered', new Memory());
    const mastra = new Mastra({ storage: new InMemoryStore() });
    mastra.addAgent(agent);

    expect((await agent.getMemory())!.storage).toBe(mastra.getStorage());
  });

  it('supports a standalone agent with its own storage', async () => {
    const storage = new InMemoryStore();
    const agent = agentWithMemory('standalone', new Memory({ storage }));

    const memory = await agent.getMemory();
    expect(memory!.hasOwnStorage).toBe(true);
    expect(memory!.storage).toBeDefined();
  });

  it('explains direct storage configuration for bare memory without an agent', () => {
    const memory = new Memory();

    expect(() => memory.storage).toThrow('Memory requires a storage provider');
    expect(() => memory.storage).toThrow('Standalone agents must configure storage directly on Memory');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { StorageCreateAgentInput } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import { MastraEditor } from './index';

const baseAgent = {
  name: 'Support Agent',
  instructions: 'Help the user.',
  model: { provider: 'openai', name: 'gpt-4o' },
};

const premiumRule = {
  operator: 'AND' as const,
  conditions: [{ field: 'tier', operator: 'equals' as const, value: 'premium' }],
};

function createLogger() {
  return {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
    trackException: vi.fn(),
  } as any;
}

async function setup({
  memory,
  agents = [],
}: {
  memory?: Record<string, Memory>;
  agents?: Array<Omit<StorageCreateAgentInput, 'name' | 'instructions' | 'model'>>;
}) {
  const storage = new InMemoryStore();
  const agentsStore = await storage.getStore('agents');
  for (const agent of agents) {
    await agentsStore!.create({ agent: { ...baseAgent, ...agent } });
  }
  const logger = createLogger();
  const editor = new MastraEditor({ logger });
  const mastra = new Mastra({ storage, editor, memory });
  return { storage, editor, mastra, logger };
}

describe('stored agent memory references', () => {
  it('resolves a reference to the exact registered Memory instance', async () => {
    const chatMemory = new Memory({ options: { lastMessages: 7 } });
    const { editor } = await setup({
      memory: { chat: chatMemory },
      agents: [{ id: 'support', memory: { type: 'id', memoryId: 'chat' } }],
    });

    const agent = await editor.agent.getById('support');
    expect(agent).toBeInstanceOf(Agent);
    expect(await agent!.getMemory()).toBe(chatMemory);
  });

  it('prefers the registry key over the instance id, and falls back to the instance id', async () => {
    // Registry key "chat" points at one instance; another instance has id "chat"
    const keyedMemory = new Memory({ id: 'keyed-memory' });
    const idMemory = new Memory({ id: 'chat' });
    const { editor } = await setup({
      memory: { chat: keyedMemory, other: idMemory },
      agents: [
        { id: 'by-key', memory: { type: 'id', memoryId: 'chat' } },
        { id: 'by-id', memory: { type: 'id', memoryId: 'keyed-memory' } },
      ],
    });

    expect(await (await editor.agent.getById('by-key'))!.getMemory()).toBe(keyedMemory);
    expect(await (await editor.agent.getById('by-id'))!.getMemory()).toBe(keyedMemory);
  });

  it('runs without memory and warns while the reference is missing, then the same agent resolves it once registered', async () => {
    const { editor, mastra, logger } = await setup({
      agents: [{ id: 'support', memory: { type: 'id', memoryId: 'support-memory' } }],
    });

    const agent = await editor.agent.getById('support');
    expect(agent).toBeInstanceOf(Agent);
    expect(await agent!.getMemory()).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Memory "support-memory"'));

    // Stored data is untouched
    const storedRecord = await (await mastra.getStorage()!.getStore('agents'))!.getByIdResolved('support');
    expect(storedRecord?.memory).toEqual({ type: 'id', memoryId: 'support-memory' });

    // Registering the key later is picked up by the already-hydrated (cached) agent
    const restored = new Memory();
    mastra.addMemory(restored, 'support-memory');
    expect(await editor.agent.getById('support')).toBe(agent);
    expect(await agent!.getMemory()).toBe(restored);
  });

  it('keeps legacy untagged and tagged inline configs working', async () => {
    const config = { options: { lastMessages: 12, readOnly: true } };
    const { editor } = await setup({
      agents: [
        { id: 'legacy', memory: config },
        { id: 'tagged', memory: { type: 'inline', config } },
      ],
    });

    for (const id of ['legacy', 'tagged']) {
      const memory = await (await editor.agent.getById(id))!.getMemory();
      expect(memory).toBeInstanceOf(Memory);
      expect(memory!.getConfig().options).toMatchObject({ lastMessages: 12, readOnly: true });
    }
  });

  it('shares one registered instance across stored agents with different ids and authors', async () => {
    const shared = new Memory();
    const { editor } = await setup({ memory: { 'support-memory': shared } });

    const agentA = await editor.agent.create({
      ...baseAgent,
      id: 'support-user-a',
      authorId: 'user-a',
      memory: { type: 'id', memoryId: 'support-memory' },
    });
    const agentB = await editor.agent.create({
      ...baseAgent,
      id: 'support-user-b',
      authorId: 'user-b',
      memory: { type: 'id', memoryId: 'support-memory' },
    });

    expect(await agentA.getMemory()).toBe(shared);
    expect(await agentB.getMemory()).toBe(shared);
  });

  describe('conditional memory', () => {
    it('merges inline variants as before (later matches override earlier keys)', async () => {
      const { editor } = await setup({
        agents: [
          {
            id: 'merge',
            memory: [
              { value: { options: { lastMessages: 5 } } },
              { value: { type: 'inline', config: { options: { lastMessages: 8 } } }, rules: premiumRule },
            ],
          },
        ],
      });

      const agent = await editor.agent.getById('merge');
      const premium = await agent!.getMemory({ requestContext: new RequestContext([['tier', 'premium']]) });
      expect(premium!.getConfig().options).toMatchObject({ lastMessages: 8 });
      const fallback = await agent!.getMemory({ requestContext: new RequestContext() });
      expect(fallback!.getConfig().options).toMatchObject({ lastMessages: 5 });
    });

    it('lets a matching reference replace accumulated inline config', async () => {
      const premiumMemory = new Memory();
      const { editor } = await setup({
        memory: { premium: premiumMemory },
        agents: [
          {
            id: 'ref-wins',
            memory: [
              { value: { options: { lastMessages: 5 } } },
              { value: { type: 'id', memoryId: 'premium' }, rules: premiumRule },
            ],
          },
        ],
      });

      const agent = await editor.agent.getById('ref-wins');
      expect(await agent!.getMemory({ requestContext: new RequestContext([['tier', 'premium']]) })).toBe(premiumMemory);

      const defaultMemory = await agent!.getMemory({ requestContext: new RequestContext() });
      expect(defaultMemory).not.toBe(premiumMemory);
      expect(defaultMemory!.getConfig().options).toMatchObject({ lastMessages: 5 });
    });

    it('runs without memory when the matching reference is not registered', async () => {
      const { editor, logger } = await setup({
        agents: [
          {
            id: 'missing-conditional',
            memory: [{ value: { type: 'id', memoryId: 'premium' }, rules: premiumRule }],
          },
        ],
      });

      const agent = await editor.agent.getById('missing-conditional');
      await expect(
        agent!.getMemory({ requestContext: new RequestContext([['tier', 'premium']]) }),
      ).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Memory "premium"'));
    });

    it('lets a later inline variant replace a reference instead of producing a hybrid', async () => {
      const shared = new Memory({ options: { lastMessages: 99 } });
      const { editor } = await setup({
        memory: { shared },
        agents: [
          {
            id: 'inline-wins',
            memory: [
              { value: { type: 'id', memoryId: 'shared' } },
              { value: { options: { lastMessages: 3 } }, rules: premiumRule },
            ],
          },
        ],
      });

      const agent = await editor.agent.getById('inline-wins');
      expect(await agent!.getMemory({ requestContext: new RequestContext() })).toBe(shared);

      const premium = await agent!.getMemory({ requestContext: new RequestContext([['tier', 'premium']]) });
      expect(premium).not.toBe(shared);
      expect(premium!.getConfig().options).toMatchObject({ lastMessages: 3 });
    });
  });

  describe('clone', () => {
    it('stores a reference when the source agent uses registered memory', async () => {
      const chatMemory = new Memory();
      const { editor, mastra } = await setup({ memory: { chat: chatMemory } });
      const codeAgent = new Agent({ ...baseAgent, id: 'code-agent', model: 'openai/gpt-4o', memory: chatMemory });
      mastra.addAgent(codeAgent);

      const cloned = await editor.agent.clone(codeAgent, { newId: 'cloned-code-agent' });
      expect(cloned.memory).toEqual({ type: 'id', memoryId: 'chat' });
    });

    it('preserves the reference when cloning a stored agent that references memory', async () => {
      const chatMemory = new Memory();
      const { editor } = await setup({
        memory: { chat: chatMemory },
        agents: [{ id: 'source', memory: { type: 'id', memoryId: 'chat' } }],
      });

      const source = await editor.agent.getById('source');
      const cloned = await editor.agent.clone(source!, { newId: 'cloned-source' });
      expect(cloned.memory).toEqual({ type: 'id', memoryId: 'chat' });

      const clonedAgent = await editor.agent.getById('cloned-source');
      expect(await clonedAgent!.getMemory()).toBe(chatMemory);
    });

    it('snapshots inline config when the memory is not registered', async () => {
      const { editor } = await setup({
        agents: [{ id: 'inline-source', memory: { options: { lastMessages: 4 } } }],
      });

      const source = await editor.agent.getById('inline-source');
      const cloned = await editor.agent.clone(source!, { newId: 'cloned-inline' });
      expect(cloned.memory).not.toHaveProperty('type');
      expect((cloned.memory as { options?: { lastMessages?: number } }).options?.lastMessages).toBe(4);
    });
  });
});

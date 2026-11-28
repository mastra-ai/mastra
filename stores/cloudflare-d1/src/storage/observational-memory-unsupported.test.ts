import { Agent } from '@mastra/core/agent';
import type { Processor } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { Memory } from '@mastra/memory';
import { Miniflare } from 'miniflare';
import { afterAll, describe, expect, it } from 'vitest';

import { D1Store } from '.';

/**
 * D1 does not support observational memory. Enabling it there must fail loudly instead of
 * running without saving messages, so the user knows to change their config.
 */
describe('Observational memory on D1 (unsupported store)', () => {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {};',
    d1Databases: { TEST_DB: ':memory:' },
  });

  afterAll(async () => {
    await mf.dispose();
  });

  async function createMemory(
    prefix: string,
    { observationalMemory = true, lastMessages }: { observationalMemory?: boolean; lastMessages?: false } = {},
  ) {
    const store = new D1Store({
      id: `d1-om-unsupported-${prefix}`,
      binding: await mf.getD1Database('TEST_DB'),
      tablePrefix: `${prefix}_`,
    });
    return new Memory({
      storage: store,
      options: { observationalMemory: observationalMemory ? { model: 'openai/gpt-4o-mini' } : false, lastMessages },
    });
  }

  function createAgent(memory: Memory, processors: Processor[] = [], outputProcessors: Processor[] = processors) {
    const prompts: unknown[] = [];
    const agent = new Agent({
      id: 'om-unsupported-agent',
      name: 'om-unsupported-agent',
      instructions: 'You are a helpful assistant.',
      model: createMockModel({
        mockText: 'Noted.',
        spyGenerate: props => prompts.push(props.prompt),
        spyStream: props => prompts.push(props.prompt),
      }),
      memory,
      inputProcessors: processors,
      outputProcessors,
    });
    return { agent, prompts };
  }

  it('throws when observational memory is configured', async () => {
    const memory = await createMemory('om_config');
    const { agent, prompts } = createAgent(memory);

    await expect(
      agent.generate('My favourite colour is teal.', { memory: { thread: 'thread-config', resource: 'user-1' } }),
    ).rejects.toThrow(/Observational memory is enabled, but the memory store D1 does not support it/);
    expect(prompts).toHaveLength(0);
  });

  it('throws when an observational-memory processor is supplied explicitly', async () => {
    const memory = await createMemory('om_processor', { observationalMemory: false });
    // Observational memory is off in config, so only this processor requests it.
    const omProcessor: Processor<'observational-memory'> = {
      id: 'observational-memory',
      processInput: ({ messages }) => messages,
      processOutputResult: ({ messages }) => messages,
    };
    const { agent, prompts } = createAgent(memory, [omProcessor]);

    await expect(
      agent.generate('My favourite colour is teal.', { memory: { thread: 'thread-processor', resource: 'user-1' } }),
    ).rejects.toThrow(/Observational memory is enabled, but the memory store D1 does not support it/);
    expect(prompts).toHaveLength(0);
  });

  it('throws for an output-only observational-memory processor when message history is disabled', async () => {
    const memory = await createMemory('om_output_only', { observationalMemory: false, lastMessages: false });
    const omProcessor: Processor<'observational-memory'> = {
      id: 'observational-memory',
      processOutputResult: ({ messages }) => messages,
    };
    const { agent, prompts } = createAgent(memory, [], [omProcessor]);

    await expect(
      agent.generate('My favourite colour is teal.', { memory: { thread: 'thread-output-only', resource: 'user-1' } }),
    ).rejects.toThrow(/Observational memory is enabled, but the memory store D1 does not support it/);
    expect(prompts).toHaveLength(0);
  });

  it('runs an explicit observational-memory processor whose own store supports it', async () => {
    const memory = await createMemory('om_own_store', { observationalMemory: false });
    // The processor's engine stores observations in a supported store, not in D1.
    const supportedStore = await new InMemoryStore().getStore('memory');
    const omProcessor = {
      id: 'observational-memory',
      engine: { getStorage: () => supportedStore },
      processInput: ({ messages }) => messages,
      processOutputResult: ({ messages }) => messages,
    } satisfies Processor<'observational-memory'> & { engine: unknown };
    const { agent, prompts } = createAgent(memory, [omProcessor]);

    await agent.generate('My favourite colour is teal.', {
      memory: { thread: 'thread-own-store', resource: 'user-1' },
    });
    expect(prompts).toHaveLength(1);
  });

  it('saves and recalls messages when observational memory is disabled', async () => {
    const memory = await createMemory('om_off', { observationalMemory: false });
    const { agent, prompts } = createAgent(memory);
    const memoryOptions = { thread: 'thread-off', resource: 'user-1' };

    await agent.generate('My favourite colour is teal.', { memory: memoryOptions });
    await agent.generate('What is my favourite colour?', { memory: memoryOptions });

    expect(JSON.stringify(prompts[1])).toContain('My favourite colour is teal.');
  });
});

import { Agent } from '@mastra/core/agent';
import { ConsoleLogger } from '@mastra/core/logger';
import type { Processor } from '@mastra/core/processors';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { Memory } from '@mastra/memory';
import { Miniflare } from 'miniflare';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { D1Store } from '.';

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

/**
 * D1 does not support observational memory. Enabling it there must not stop messages from
 * being saved and recalled: Memory falls back to regular message history and warns once.
 */
describe('Observational memory on D1 (unsupported store)', () => {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {};',
    d1Databases: { TEST_DB: ':memory:' },
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await mf.dispose();
  });

  async function createMemory(prefix: string, { observationalMemory = true } = {}) {
    const store = new D1Store({
      id: `d1-om-fallback-${prefix}`,
      binding: await mf.getD1Database('TEST_DB'),
      tablePrefix: `${prefix}_`,
    });
    const memory = new Memory({
      storage: store,
      options: { observationalMemory: observationalMemory ? { model: 'openai/gpt-4o-mini' } : false },
    });
    // ConsoleLogger.child() returns a new instance, so watch the class rather than one logger.
    const warn = vi.spyOn(ConsoleLogger.prototype, 'warn');
    return { memory, warn };
  }

  function promptText(prompt: unknown): string {
    return JSON.stringify(prompt);
  }

  async function runTwoTurns(agent: Agent, prompts: unknown[], threadId: string) {
    const memoryOptions = { thread: threadId, resource: 'user-1' };
    await agent.generate('My favourite colour is teal.', { memory: memoryOptions });
    await agent.generate('What is my favourite colour?', { memory: memoryOptions });
    expect(prompts).toHaveLength(2);
    return memoryOptions;
  }

  it('saves and recalls messages across turns when observational memory is configured', async () => {
    const { memory, warn } = await createMemory('om_config');
    const prompts: unknown[] = [];
    const agent = new Agent({
      id: 'om-fallback-agent',
      name: 'om-fallback-agent',
      instructions: 'You are a helpful assistant.',
      model: createMockModel({
        mockText: 'Noted.',
        spyGenerate: props => prompts.push(props.prompt),
        spyStream: props => prompts.push(props.prompt),
      }),
      memory,
    });

    await runTwoTurns(agent, prompts, 'thread-config');

    // The second turn sees the first turn's messages, loaded from D1.
    expect(promptText(prompts[1])).toContain('My favourite colour is teal.');

    const { messages } = await memory.recall({ threadId: 'thread-config', resourceId: 'user-1' });
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);

    const warnings = warn.mock.calls.filter(([message]) => String(message).includes('Observational memory'));
    expect(warnings).toHaveLength(1);
    expect(String(warnings[0]![0])).toContain('D1');
  });

  it('saves and recalls messages when an observational-memory processor is supplied explicitly', async () => {
    const { memory, warn } = await createMemory('om_processor', { observationalMemory: false });
    const prompts: unknown[] = [];
    // Observational memory is off in config, so only this processor requests it. A user-supplied processor registered under the observational-memory id. Memory decides
    // whether to keep message history from that id and the store, not from the processor's internals.
    const omProcessor: Processor<'observational-memory'> = {
      id: 'observational-memory',
      processInput: ({ messages }) => messages,
      processOutputResult: ({ messages }) => messages,
    };
    const agent = new Agent({
      id: 'om-processor-agent',
      name: 'om-processor-agent',
      instructions: 'You are a helpful assistant.',
      model: createMockModel({
        mockText: 'Noted.',
        spyGenerate: props => prompts.push(props.prompt),
        spyStream: props => prompts.push(props.prompt),
      }),
      memory,
      inputProcessors: [omProcessor],
      outputProcessors: [omProcessor],
    });

    await runTwoTurns(agent, prompts, 'thread-processor');

    expect(promptText(prompts[1])).toContain('My favourite colour is teal.');
    const { messages } = await memory.recall({ threadId: 'thread-processor', resourceId: 'user-1' });
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(warn.mock.calls.filter(([message]) => String(message).includes('Observational memory'))).toHaveLength(1);
  });
});

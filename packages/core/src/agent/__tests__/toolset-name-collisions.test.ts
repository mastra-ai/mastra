import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { ConsoleLogger } from '../../logger';
import { createMockModel } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Two MCP servers (or any two toolsets) that expose a tool with the same name
 * are flattened by tool name when passed as `toolsets`. Only one reaches the
 * model. Before #29360 this happened silently; now the agent logs a warning
 * that names both toolsets. Which tool wins is unchanged: the later toolset.
 */
describe('toolsets with the same tool name (#29360)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function searchTool(description: string, from: string) {
    return createTool({
      id: 'search',
      description,
      inputSchema: z.object({}),
      execute: async () => ({ from }),
    });
  }

  function setup() {
    const modelCalls: Array<{ tools?: Array<{ name: string; description?: string }> }> = [];
    const record = (props: (typeof modelCalls)[number]) => modelCalls.push(props);
    const model = createMockModel({ mockText: 'ok', version: 'v2', spyStream: record, spyGenerate: record });
    const agent = new Agent({ id: 'support-agent', name: 'Support Agent', instructions: 'Help the user.', model });
    // `__setLogger` stores a `child()` of the logger, so spy on the class to see what the agent logs.
    const warn = vi.spyOn(ConsoleLogger.prototype, 'warn').mockImplementation(() => {});
    agent.__setLogger(new ConsoleLogger({ name: 'test', level: 'warn' }));
    return { agent, modelCalls, warn };
  }

  function toolsSentToModel(modelCalls: Array<{ tools?: Array<{ name: string; description?: string }> }>) {
    return (modelCalls[0]?.tools ?? []).map(({ name, description }) => ({ name, description }));
  }

  function collisionWarnings(warn: ReturnType<typeof vi.spyOn>) {
    return warn.mock.calls.filter(([message]) => typeof message === 'string' && message.includes('"search"'));
  }

  it.each(['stream', 'generate'] as const)(
    'warns, naming both toolsets, when two toolsets expose `search` (%s)',
    async method => {
      const { agent, modelCalls, warn } = setup();
      const toolsets = {
        docs: { search: searchTool('Search the docs', 'docs') },
        tickets: { search: searchTool('Search the tickets', 'tickets') },
      };

      if (method === 'stream') {
        await (await agent.stream('find the refund policy', { toolsets })).consumeStream();
      } else {
        await agent.generate('find the refund policy', { toolsets });
      }

      const warnings = collisionWarnings(warn);
      expect(warnings).toHaveLength(1);
      const [message, context] = warnings[0]!;
      expect(message).toContain('docs');
      expect(message).toContain('tickets');
      expect(context).toMatchObject({ tool: 'search', toolsets: ['docs', 'tickets'] });

      // Behavior is unchanged: the later toolset's tool is the one the model sees.
      expect(toolsSentToModel(modelCalls)).toEqual([{ name: 'search', description: 'Search the tickets' }]);
    },
  );

  it('does not warn when toolsets expose different tool names, and the model gets all of them', async () => {
    const { agent, modelCalls, warn } = setup();
    const toolsets = {
      docs: { docs_search: searchTool('Search the docs', 'docs') },
      tickets: { tickets_search: searchTool('Search the tickets', 'tickets') },
    };

    await (await agent.stream('find the refund policy', { toolsets })).consumeStream();

    expect(warn).not.toHaveBeenCalled();
    expect(toolsSentToModel(modelCalls)).toEqual([
      { name: 'docs_search', description: 'Search the docs' },
      { name: 'tickets_search', description: 'Search the tickets' },
    ]);
  });
});

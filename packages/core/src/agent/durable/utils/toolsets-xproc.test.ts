/**
 * Call-time toolsets cannot survive a cross-process durable run (#25852).
 *
 * Toolset tools carry `execute` closures that cannot be serialized, so a worker
 * in another process cannot rebuild them. Their names ride on the workflow
 * options so the worker fails loudly instead of silently dropping them.
 */
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { MessageList } from '../../message-list';
import { globalRunRegistry } from '../run-registry';
import { rebuildRunToolsFromMastra, resolveRuntimeDependencies } from './resolve-runtime';
import { serializeDurableOptions, serializeToolsetToolNames } from './serialize-state';

const RUN_ID = 'run-toolsets-xproc';

const echo = createTool({
  id: 'echo',
  description: 'Echo',
  inputSchema: z.object({ text: z.string() }),
  execute: async ({ text }) => text,
});
const shout = createTool({
  id: 'shout',
  description: 'Shout',
  inputSchema: z.object({ text: z.string() }),
  execute: async ({ text }) => text.toUpperCase(),
});

function setup() {
  const agent = new Agent({
    id: 'toolsets-agent',
    name: 'toolsets-agent',
    instructions: 'test',
    model: new MockLanguageModelV2(),
    tools: { echo },
  });
  return new Mastra({ agents: { agent }, logger: false });
}

function rebuild(mastra: Mastra, toolsets: Record<string, Record<string, unknown>> | undefined) {
  const options = JSON.parse(
    JSON.stringify(serializeDurableOptions({ toolsetToolNames: serializeToolsetToolNames(toolsets) })),
  );
  return rebuildRunToolsFromMastra({
    mastra,
    runId: RUN_ID,
    agentId: 'toolsets-agent',
    state: { threadId: undefined, resourceId: undefined } as any,
    options,
  });
}

afterEach(() => {
  globalRunRegistry.delete(RUN_ID);
});

describe('cross-process toolsets', () => {
  it('serializes toolset tool names into JSON-safe options', () => {
    expect(serializeToolsetToolNames({ extra: { shout }, more: { echo, shout } })).toEqual(['shout', 'echo']);
  });

  it('omits toolsetToolNames when no toolsets were provided', () => {
    expect(serializeToolsetToolNames(undefined)).toBeUndefined();
    expect(serializeToolsetToolNames({ empty: {} })).toBeUndefined();
  });

  it('throws a clear error when a worker cannot rebuild call-time toolset tools', async () => {
    await expect(rebuild(setup(), { extra: { shout } })).rejects.toThrow(/"shout".*register them on the agent/s);
    expect(globalRunRegistry.has(RUN_ID)).toBe(false);
  });

  it('propagates rebuild failures when toolset names are present', async () => {
    const mastra = setup();
    const agent = mastra.getAgentById('toolsets-agent');
    agent.getToolsForExecution = async () => {
      throw new Error('rebuild boom');
    };
    await expect(rebuild(mastra, { extra: { shout } })).rejects.toThrow('rebuild boom');
    await expect(rebuild(mastra, undefined)).resolves.toBeUndefined();
  });

  it('does not throw when toolset tools are also registered on the agent', async () => {
    const rebuilt = await rebuild(setup(), { extra: { echo } });
    expect(rebuilt?.tools.echo).toBeDefined();
  });

  it('throws from resolveRuntimeDependencies on a fresh worker when toolset tools are missing', async () => {
    const mastra = setup();
    const resolve = (toolsets: Record<string, Record<string, unknown>> | undefined) =>
      resolveRuntimeDependencies({
        mastra,
        runId: RUN_ID,
        agentId: 'toolsets-agent',
        input: {
          messageListState: new MessageList().serialize(),
          state: { threadId: undefined, resourceId: undefined },
          options: JSON.parse(
            JSON.stringify(serializeDurableOptions({ toolsetToolNames: serializeToolsetToolNames(toolsets) })),
          ),
          modelConfig: { provider: 'mock', modelId: 'mock' },
        } as any,
      });

    await expect(resolve({ extra: { shout } })).rejects.toThrow(/"shout".*register them on the agent/s);
    globalRunRegistry.delete(RUN_ID);
    const resolved = await resolve(undefined);
    expect(Object.keys(resolved.tools)).toEqual(['echo']);
  });

  it('rebuilds normally without toolsets', async () => {
    const rebuilt = await rebuild(setup(), undefined);
    expect(Object.keys(rebuilt?.tools ?? {})).toEqual(['echo']);
  });
});

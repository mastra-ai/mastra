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
import { globalRunRegistry } from '../run-registry';
import { rebuildRunToolsFromMastra } from './resolve-runtime';
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

  it('does not throw when toolset tools are also registered on the agent', async () => {
    const rebuilt = await rebuild(setup(), { extra: { echo } });
    expect(rebuilt?.tools.echo).toBeDefined();
  });

  it('rebuilds normally without toolsets', async () => {
    const rebuilt = await rebuild(setup(), undefined);
    expect(Object.keys(rebuilt?.tools ?? {})).toEqual(['echo']);
  });
});

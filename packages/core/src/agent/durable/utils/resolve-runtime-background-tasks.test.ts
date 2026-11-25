/**
 * A worker that rebuilds a run started by another process must restore the
 * run's background-task manager and agent config. Without them every
 * background-eligible tool runs inline (#31090). Both rebuild paths are
 * covered: the LLM step's and the tool-call step's, which runs alone when the
 * tool call lands on a worker that didn't run the LLM step.
 *
 * The end-to-end split-process check lives in
 * pubsub/redis-streams/src/background-tool-split.test.ts.
 */
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { MessageList } from '../../message-list';
import { createEventedAgent } from '../create-evented-agent';
import { getRunRegistryEntry, globalRunRegistry } from '../run-registry';
import { rebuildRunToolsFromMastra, resolveRuntimeDependencies } from './resolve-runtime';

const RUN_ID = 'run-background-xproc';

function setup() {
  const brew = createTool({
    id: 'brew',
    description: 'Brews something',
    inputSchema: z.object({}),
    background: { enabled: true },
    execute: async () => ({ brewed: true }),
  });
  const agent = createEventedAgent({
    agent: new Agent({
      id: 'brewer',
      name: 'brewer',
      instructions: 'Brew.',
      model: new MockLanguageModelV2(),
      tools: { brew },
      backgroundTasks: { tools: { brew: true } },
    }),
  });
  return new Mastra({ agents: { brewer: agent }, logger: false, backgroundTasks: { enabled: true } });
}

const rebuilds = {
  'the LLM step': (mastra: Mastra, options: Record<string, unknown>) =>
    resolveRuntimeDependencies({
      mastra,
      runId: RUN_ID,
      agentId: 'brewer',
      input: {
        messageListState: new MessageList().serialize(),
        state: { threadId: undefined, resourceId: undefined },
        options,
        modelConfig: { provider: 'mock', modelId: 'mock' },
      } as any,
    }),
  'the tool-call step': (mastra: Mastra, options: Record<string, unknown>) =>
    rebuildRunToolsFromMastra({
      mastra,
      runId: RUN_ID,
      agentId: 'brewer',
      state: { threadId: undefined, resourceId: undefined } as any,
      options: options as any,
    }),
};

afterEach(() => {
  globalRunRegistry.delete(RUN_ID);
});

describe.each(Object.entries(rebuilds))('rebuilding a run in %s on another process', (_name, rebuild) => {
  it('restores background task dispatch', async () => {
    const mastra = setup();
    await rebuild(mastra, {});

    const entry = getRunRegistryEntry(RUN_ID, mastra);
    expect(entry?.backgroundTaskManager).toBe(mastra.backgroundTaskManager);
    expect(entry?.backgroundTasksConfig).toEqual({ tools: { brew: true } });
  });

  it('keeps dispatch off when the run disabled background tasks', async () => {
    const mastra = setup();
    await rebuild(mastra, { disableBackgroundTasks: true });

    const entry = getRunRegistryEntry(RUN_ID, mastra);
    expect(entry).toBeDefined();
    expect(entry?.backgroundTaskManager).toBeUndefined();
  });

  it('keeps dispatch off when the run policy forbids tool dispatch', async () => {
    const mastra = setup();
    await rebuild(mastra, { backgroundTaskPolicy: { allowToolDispatch: false } });

    const entry = getRunRegistryEntry(RUN_ID, mastra);
    expect(entry).toBeDefined();
    expect(entry?.backgroundTaskManager).toBeUndefined();
  });
});

describe('a persistence-only rebuild before the tool-call rebuild', () => {
  // The save step can rebuild the run first. The entry keeps the first manager
  // a rebuild restores, so that rebuild must not restore one the run disabled.
  it.each([
    ['without the run options', undefined],
    ['with the run options', { disableBackgroundTasks: true }],
  ])('keeps dispatch off for a run that disabled background tasks (%s)', async (_name, saveStepOptions) => {
    const mastra = setup();
    await rebuildRunToolsFromMastra({
      mastra,
      runId: RUN_ID,
      agentId: 'brewer',
      state: { threadId: undefined, resourceId: undefined } as any,
      options: saveStepOptions as any,
    });
    await rebuilds['the tool-call step'](mastra, { disableBackgroundTasks: true });

    const entry = getRunRegistryEntry(RUN_ID, mastra);
    expect(entry).toBeDefined();
    expect(entry?.backgroundTaskManager).toBeUndefined();
  });

  it('still lets the tool-call rebuild restore dispatch for a run that allows it', async () => {
    const mastra = setup();
    await rebuildRunToolsFromMastra({
      mastra,
      runId: RUN_ID,
      agentId: 'brewer',
      state: { threadId: undefined, resourceId: undefined } as any,
    });
    await rebuilds['the tool-call step'](mastra, {});

    expect(getRunRegistryEntry(RUN_ID, mastra)?.backgroundTaskManager).toBe(mastra.backgroundTaskManager);
  });
});

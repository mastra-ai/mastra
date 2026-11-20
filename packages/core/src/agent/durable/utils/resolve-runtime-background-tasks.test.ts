import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { AgentBackgroundConfig } from '../../../background-tasks/types';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { MessageList } from '../../message-list';
import { createDurableAgent } from '../create-durable-agent';
import { getRunRegistryEntry, globalRunRegistry, setRunRegistryEntry } from '../run-registry';
import type { DurableAgenticWorkflowInput, SerializableDurableOptions } from '../types';
import { rebuildRunToolsFromMastra, resolveRuntimeDependencies } from './resolve-runtime';
import { serializeDurableOptions } from './serialize-state';

const RUN_ID = 'background-tools-xproc';
const hosts: Mastra[] = [];
const config: AgentBackgroundConfig = { tools: { work: { enabled: true, timeoutMs: 4321 } } };

function setup(agentConfig = config, enabled = true, toolEnabled = true) {
  const model = new MockLanguageModelV2();
  const work = createTool({
    id: 'work',
    description: 'Background work',
    inputSchema: z.object({ text: z.string() }),
    background: toolEnabled ? { enabled: true } : undefined,
    execute: async ({ text }) => text,
  });
  const inner = new Agent({
    id: 'background-agent',
    name: 'background-agent',
    instructions: 'Use work',
    model,
    tools: { work },
    backgroundTasks: agentConfig,
  });
  const mastra = new Mastra({
    agents: { agent: createDurableAgent({ agent: inner }) },
    storage: new InMemoryStore(),
    pubsub: new EventEmitterPubSub(),
    backgroundTasks: enabled ? { enabled: true } : undefined,
    logger: false,
  });
  hosts.push(mastra);
  return { mastra, inner, model };
}

async function rebuild(helper: 'runtime' | 'tools', mastra: Mastra, options: SerializableDurableOptions = {}) {
  const serializedOptions: SerializableDurableOptions = JSON.parse(JSON.stringify(serializeDurableOptions(options)));
  const input: DurableAgenticWorkflowInput = {
    __workflowKind: 'durable-agent',
    runId: RUN_ID,
    agentId: 'background-agent',
    messageId: 'background-message',
    messageListState: new MessageList().serialize(),
    toolsMetadata: [],
    state: {},
    modelConfig: { provider: 'mock', modelId: 'mock' },
    options: serializedOptions,
  };
  if (helper === 'runtime') {
    return resolveRuntimeDependencies({ mastra, runId: RUN_ID, agentId: input.agentId, input });
  }
  return rebuildRunToolsFromMastra({
    mastra,
    runId: RUN_ID,
    agentId: input.agentId,
    state: input.state,
    options: input.options,
  });
}

afterEach(async () => {
  globalRunRegistry.delete(RUN_ID);
  await Promise.all(hosts.splice(0).map(host => host.shutdown()));
});

describe.each(['runtime', 'tools'] as const)('background tools rebuilt by %s (#31090)', helper => {
  describe.each(['absent', 'placeholder'] as const)('%s registry', entry => {
    it.each([
      { label: 'enabled', enabled: true, agentConfig: config, options: {}, manager: true, schema: true },
      {
        label: 'agent-only opt-in',
        enabled: true,
        agentConfig: config,
        toolEnabled: false,
        options: {},
        manager: true,
        schema: true,
      },
      { label: 'tool-only opt-in', enabled: true, agentConfig: {}, options: {}, manager: true, schema: true },
      {
        label: 'agent tool opt-out',
        enabled: true,
        agentConfig: { tools: { work: false } },
        options: {},
        manager: true,
        schema: false,
      },
      { label: 'host disabled', enabled: false, agentConfig: config, options: {}, manager: false, schema: false },
      {
        label: 'call disabled',
        enabled: true,
        agentConfig: config,
        options: { disableBackgroundTasks: true },
        manager: false,
        schema: false,
      },
      {
        label: 'policy disabled',
        enabled: true,
        agentConfig: config,
        options: { backgroundTaskPolicy: { allowToolDispatch: false } },
        manager: false,
        schema: false,
      },
      {
        label: 'agent disabled',
        enabled: true,
        agentConfig: { disabled: true },
        options: {},
        manager: true,
        schema: false,
      },
    ])('preserves dispatch eligibility and model override schema: $label', async test => {
      const { mastra, model } = setup(test.agentConfig, test.enabled, test.toolEnabled);
      if (entry === 'placeholder') {
        setRunRegistryEntry(RUN_ID, { tools: {}, model, isPlaceholder: true }, mastra);
      }
      const result = await rebuild(helper, mastra, test.options);
      const registry = getRunRegistryEntry(RUN_ID, mastra);
      expect(registry?.backgroundTasksConfig).toEqual(test.agentConfig);
      expect(registry?.backgroundTaskManager).toBe(test.manager ? mastra.backgroundTaskManager : undefined);
      if (test.manager) expect(registry?.backgroundTaskManager).toBeDefined();
      if (test.schema) {
        expect(result?.tools.work.parameters).toMatchObject({
          jsonSchema: { properties: { _background: expect.any(Object) } },
        });
      } else {
        expect(result?.tools.work.parameters).not.toHaveProperty('jsonSchema.properties._background');
      }
    });
  });

  it('does not re-enable background tasks on a live foreground run', async () => {
    const { mastra, inner, model } = setup();
    const tools = await inner.getToolsForExecution({ runId: RUN_ID, backgroundTaskEnabled: false });
    const liveConfig: AgentBackgroundConfig = { disabled: true };
    const live = { tools, model, backgroundTaskManager: undefined, backgroundTasksConfig: liveConfig };
    setRunRegistryEntry(RUN_ID, live, mastra);
    await rebuild(helper, mastra);
    const registry = getRunRegistryEntry(RUN_ID, mastra);
    expect(registry).toBe(live);
    expect(registry?.tools).toBe(tools);
    expect(registry?.backgroundTaskManager).toBeUndefined();
    expect(registry?.backgroundTasksConfig).toBe(liveConfig);
    expect(registry?.tools.work.parameters).not.toHaveProperty('jsonSchema.properties._background');
  });
});

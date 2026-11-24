/**
 * A worker that rebuilds a durable run from the Mastra instance must store the
 * inner Agent on the run registry entry, not the DurableAgent wrapper that
 * `mastra.getAgentById()` returns. Processor hooks read `args.agent` from that
 * entry, and in-process runs already store the inner Agent.
 *
 * No model call happens here, so the model is a stub rather than aimock.
 */
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { Mastra } from '../../../mastra';
import { Agent } from '../../agent';
import { MessageList } from '../../message-list';
import { createDurableAgent } from '../create-durable-agent';
import { getRunRegistryEntry, globalRunRegistry } from '../run-registry';
import { rebuildRunToolsFromMastra, resolveRuntimeDependencies } from './resolve-runtime';

const RUN_ID = 'run-agent-identity-xproc';

function setup() {
  const inner = new Agent({
    id: 'identity-agent',
    name: 'identity-agent',
    instructions: 'test',
    model: new MockLanguageModelV2(),
  });
  const durable = createDurableAgent({ agent: inner });
  const mastra = new Mastra({ agents: { durable }, logger: false });
  expect(mastra.getAgentById('identity-agent')).not.toBe(inner);
  return { mastra, inner };
}

afterEach(() => {
  globalRunRegistry.delete(RUN_ID);
});

describe('cross-process registry agent identity', () => {
  it('resolveRuntimeDependencies stores the inner Agent, not the durable wrapper', async () => {
    const { mastra, inner } = setup();
    await resolveRuntimeDependencies({
      mastra,
      runId: RUN_ID,
      agentId: 'identity-agent',
      input: {
        messageListState: new MessageList().serialize(),
        state: { threadId: undefined, resourceId: undefined },
        options: {},
        modelConfig: { provider: 'mock', modelId: 'mock' },
      } as any,
    });

    expect(getRunRegistryEntry(RUN_ID, mastra)?.agent).toBe(inner);
  });

  it('rebuildRunToolsFromMastra stores the inner Agent, not the durable wrapper', async () => {
    const { mastra, inner } = setup();
    await rebuildRunToolsFromMastra({
      mastra,
      runId: RUN_ID,
      agentId: 'identity-agent',
      state: { threadId: undefined, resourceId: undefined } as any,
      options: {} as any,
    });

    expect(getRunRegistryEntry(RUN_ID, mastra)?.agent).toBe(inner);
  });
});

describe('cross-process rebuild of a stored agent', () => {
  // A worker that never registered the agent must find it through the editor,
  // the same way server handlers and the schedule worker do.
  function setupStored() {
    const stored = new Agent({
      id: 'stored-agent',
      name: 'stored-agent',
      instructions: 'test',
      model: new MockLanguageModelV2(),
    });
    const getById = async (id: string) => (id === 'stored-agent' ? stored : null);
    const mastra = new Mastra({ logger: false, editor: { agent: { getById } } as any });
    expect(() => mastra.getAgentById('stored-agent')).toThrow();
    return { mastra, stored };
  }

  it('resolveRuntimeDependencies falls back to the editor', async () => {
    const { mastra, stored } = setupStored();
    await resolveRuntimeDependencies({
      mastra,
      runId: RUN_ID,
      agentId: 'stored-agent',
      input: {
        messageListState: new MessageList().serialize(),
        state: { threadId: undefined, resourceId: undefined },
        options: {},
        modelConfig: { provider: 'mock', modelId: 'mock' },
      } as any,
    });

    expect(getRunRegistryEntry(RUN_ID, mastra)?.agent).toBe(stored);
  });

  it('rebuildRunToolsFromMastra falls back to the editor', async () => {
    const { mastra, stored } = setupStored();
    await rebuildRunToolsFromMastra({
      mastra,
      runId: RUN_ID,
      agentId: 'stored-agent',
      state: { threadId: undefined, resourceId: undefined } as any,
      options: {} as any,
    });

    expect(getRunRegistryEntry(RUN_ID, mastra)?.agent).toBe(stored);
  });

  it('resolveRuntimeDependencies fails loudly when no source knows the agent', async () => {
    const { mastra } = setupStored();
    await expect(
      resolveRuntimeDependencies({
        mastra,
        runId: RUN_ID,
        agentId: 'unknown-agent',
        input: {
          messageListState: new MessageList().serialize(),
          state: { threadId: undefined, resourceId: undefined },
          options: {},
          modelConfig: { provider: 'mock', modelId: 'mock' },
        } as any,
      }),
    ).rejects.toThrow(/unknown-agent/);
  });
});

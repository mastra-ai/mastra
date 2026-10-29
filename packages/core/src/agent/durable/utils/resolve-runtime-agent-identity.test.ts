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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '../../message-list';
import { globalRunRegistry } from '../run-registry';
import { resolveRuntimeDependencies } from './resolve-runtime';

const RUN_ID = 'cross-process-agent-context';

afterEach(() => {
  if (globalRunRegistry.has(RUN_ID)) globalRunRegistry.delete(RUN_ID);
});

describe('resolveRuntimeDependencies processor agent context', () => {
  it('rehydrates and caches the registered base agent across a process boundary', async () => {
    const memory = {};
    const baseAgent = {
      id: 'memory-agent',
      getToolsForExecution: vi.fn().mockResolvedValue({}),
      getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2', provider: 'test', modelId: 'test' }),
      getModelList: vi.fn().mockResolvedValue(undefined),
      getMemory: vi.fn().mockResolvedValue(memory),
      getWorkspace: vi.fn().mockResolvedValue(undefined),
      listInputProcessors: vi.fn().mockResolvedValue([]),
      __listLLMRequestProcessors: vi.fn().mockResolvedValue([]),
      listOutputProcessors: vi.fn().mockResolvedValue([]),
      listErrorProcessors: vi.fn().mockResolvedValue([]),
    };
    const durableWrapper = { id: baseAgent.id, agent: baseAgent };
    const mastra = {
      getAgentById: vi.fn().mockReturnValue(durableWrapper),
      getLogger: vi.fn().mockReturnValue(undefined),
    };

    globalRunRegistry.set(RUN_ID, {
      isPlaceholder: true,
      tools: {},
      model: undefined,
    } as any);

    const resolved = await resolveRuntimeDependencies({
      mastra: mastra as any,
      runId: RUN_ID,
      agentId: baseAgent.id,
      input: {
        runId: RUN_ID,
        agentId: baseAgent.id,
        messageListState: new MessageList().serialize(),
        state: {
          threadId: 'thread-1',
          resourceId: 'resource-1',
          threadExists: false,
        },
      } as any,
    });

    expect(resolved.agent).toBe(baseAgent);
    expect(resolved.memory).toBe(memory);
    expect(globalRunRegistry.get(RUN_ID)?.agent).toBe(baseAgent);
  });
});

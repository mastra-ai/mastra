/**
 * Durable tool-call: provider-tool fallback resolution.
 *
 * The non-durable tool-call step resolves a tool by:
 *   1. exact name lookup on stepTools
 *   2. `findProviderToolByName(stepTools, name)` — for provider-defined tools
 *      where the LLM-emitted name differs from the JS key (e.g. the JS key is
 *      `webSearch` but the model calls it `web_search`)
 *   3. fallback to mastra-wide registry
 *
 * The durable tool-call step skipped step (2), causing model-named provider
 * tools to surface as ToolNotFoundError. This test guards the fix.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { globalRunRegistry } from '../../run-registry';
import * as resolveRuntime from '../../utils/resolve-runtime';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../utils/resolve-runtime', () => ({
  resolveTool: vi.fn(),
  toolRequiresApproval: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../stream-adapter', () => ({
  emitChunkEvent: vi.fn().mockResolvedValue(undefined),
  emitSuspendedEvent: vi.fn().mockResolvedValue(undefined),
}));

const RUN_ID = 'run-provider-tool-1';

function mockPubsub() {
  return { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), flush: vi.fn() };
}

function makeInitData() {
  return {
    runId: RUN_ID,
    agentId: 'agent-1',
    options: { requireToolApproval: false },
    state: {
      threadId: 'thread-1',
      resourceId: 'user-1',
      memoryConfig: undefined,
      threadExists: false,
    },
  };
}

afterEach(() => {
  if (globalRunRegistry.has(RUN_ID)) globalRunRegistry.delete(RUN_ID);
  vi.clearAllMocks();
});

describe('durable tool-call provider-tool fallback', () => {
  it('resolves a provider-defined tool by its model-facing name', async () => {
    const executeMock = vi.fn().mockResolvedValue({ snippet: 'result' });
    // Provider-defined tool: JS key `webSearch`, model-facing id `openai.web_search`
    // The LLM emits `web_search`, which doesn't match the JS key.
    globalRunRegistry.set(RUN_ID, {
      tools: {
        webSearch: {
          type: 'provider-defined',
          id: 'openai.web_search',
          execute: executeMock,
        },
      },
      model: {} as any,
    } as any);

    const step = createDurableToolCallStep();
    const result = await (step as any).execute({
      inputData: {
        toolCallId: 'call-1',
        toolName: 'web_search',
        args: { query: 'mastra' },
      },
      mastra: { getLogger: () => undefined },
      suspend: vi.fn(),
      resumeData: undefined,
      requestContext: new Map(),
      getInitData: () => makeInitData(),
      [PUBSUB_SYMBOL]: mockPubsub(),
    });

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(result.error).toBeUndefined();
    expect(result.result).toEqual({ snippet: 'result' });
  });

  it('falls back to resolveTool() against the Mastra-wide registry when not in run registry', async () => {
    const executeMock = vi.fn().mockResolvedValue({ ok: true });
    const mastraTool = {
      id: 'mastraTool',
      description: 'a mastra-wide tool',
      execute: executeMock,
    };
    vi.mocked(resolveRuntime.resolveTool).mockReturnValueOnce(mastraTool as any);

    // Run registry has no matching tool — resolveTool() should be consulted.
    globalRunRegistry.set(RUN_ID, {
      tools: {},
      model: {} as any,
    } as any);

    const step = createDurableToolCallStep();
    const result = await (step as any).execute({
      inputData: {
        toolCallId: 'call-mastra',
        toolName: 'mastraTool',
        args: { foo: 'bar' },
      },
      mastra: { getLogger: () => undefined, listTools: () => ({}) },
      suspend: vi.fn(),
      resumeData: undefined,
      requestContext: new Map(),
      getInitData: () => makeInitData(),
      [PUBSUB_SYMBOL]: mockPubsub(),
    });

    expect(resolveRuntime.resolveTool).toHaveBeenCalledWith('mastraTool', expect.anything());
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(result.error).toBeUndefined();
    expect(result.result).toEqual({ ok: true });
  });

  it('falls back to a Mastra-wide provider tool when run registry and resolveTool miss', async () => {
    const executeMock = vi.fn().mockResolvedValue({ snippet: 'web-result' });
    const mastraTools = {
      webSearch: {
        type: 'provider-defined',
        id: 'openai.web_search',
        execute: executeMock,
      },
    };
    vi.mocked(resolveRuntime.resolveTool).mockReturnValueOnce(undefined as any);

    globalRunRegistry.set(RUN_ID, {
      tools: {},
      model: {} as any,
    } as any);

    const step = createDurableToolCallStep();
    const result = await (step as any).execute({
      inputData: {
        toolCallId: 'call-provider-mastra',
        toolName: 'web_search',
        args: { query: 'mastra' },
      },
      mastra: { getLogger: () => undefined, listTools: () => mastraTools },
      suspend: vi.fn(),
      resumeData: undefined,
      requestContext: new Map(),
      getInitData: () => makeInitData(),
      [PUBSUB_SYMBOL]: mockPubsub(),
    });

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(result.error).toBeUndefined();
    expect(result.result).toEqual({ snippet: 'web-result' });
  });

  it('still emits ToolNotFoundError when no provider tool matches', async () => {
    globalRunRegistry.set(RUN_ID, {
      tools: {
        webSearch: {
          type: 'provider-defined',
          id: 'openai.web_search',
          execute: vi.fn(),
        },
      },
      model: {} as any,
    } as any);

    const step = createDurableToolCallStep();
    const result = await (step as any).execute({
      inputData: {
        toolCallId: 'call-1',
        toolName: 'definitely_not_a_tool',
        args: {},
      },
      mastra: { getLogger: () => undefined },
      suspend: vi.fn(),
      resumeData: undefined,
      requestContext: new Map(),
      getInitData: () => makeInitData(),
      [PUBSUB_SYMBOL]: mockPubsub(),
    });

    expect(result.error).toEqual(
      expect.objectContaining({
        name: 'ToolNotFoundError',
      }),
    );
  });
});

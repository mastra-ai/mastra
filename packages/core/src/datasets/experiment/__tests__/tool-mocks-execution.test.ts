import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Agent } from '../../../agent';
import { executeTarget } from '../executor';
import { TOOL_MOCK_MISMATCH, TOOL_MOCK_EXHAUSTED, TOOL_MOCK_NOT_DECLARED } from '../tool-mocks';
import type { ItemToolMock } from '../tool-mocks';

vi.mock('../../../agent', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    isSupportedLanguageModel: vi.fn().mockReturnValue(true),
  };
});

type ToolCall = { toolName: string; input: unknown };

interface MockAgentOptions {
  /** Tool calls the "model" issues during generation, in order. */
  toolCalls: ToolCall[];
  /** Records which tools actually executed live (i.e. were not short-circuited). */
  liveExecutions: ToolCall[];
  /** Agent-level configured hooks (the "user" hooks). */
  configuredHooks?: {
    beforeToolCall?: (ctx: any) => any;
    afterToolCall?: (ctx: any) => any;
  };
}

/**
 * Mock agent whose `generate` drives the supplied tool hooks exactly like the real
 * tool-call step would: for each issued tool call it invokes `beforeToolCall`; if the
 * hook returns `{ proceed: false }` the live tool is skipped, otherwise a live
 * execution is recorded and `afterToolCall` fires.
 */
const createHookDrivenAgent = (options: MockAgentOptions): Agent =>
  ({
    id: 'test-agent',
    name: 'Test Agent',
    getConfiguredToolHooks: () => options.configuredHooks,
    getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
    generate: vi.fn().mockImplementation(async (_input: unknown, runOptions: any) => {
      const hooks = runOptions?.hooks;
      const abortSignal: AbortSignal | undefined = runOptions?.abortSignal;
      for (const call of options.toolCalls) {
        // Mirror the real run: once aborted (e.g. by a mock failure), the model
        // stops issuing further tool calls instead of plowing ahead.
        if (abortSignal?.aborted) {
          throw abortSignal.reason instanceof Error ? abortSignal.reason : new Error('aborted');
        }
        const context = { toolName: call.toolName, input: call.input, context: {}, metadata: {} };
        const before = await hooks?.beforeToolCall?.(context);
        if (before?.proceed === false) {
          continue;
        }
        // Live execution path
        options.liveExecutions.push(call);
        const output = { live: true, toolName: call.toolName };
        await hooks?.afterToolCall?.({ ...context, output });
      }
      return { text: 'done' };
    }),
  }) as unknown as Agent;

describe('executeTarget agent tool mocks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serves a matching mock and skips live execution; report records served', async () => {
    const liveExecutions: ToolCall[] = [];
    const agent = createHookDrivenAgent({
      toolCalls: [{ toolName: 'getWeather', input: { city: 'Seattle' } }],
      liveExecutions,
    });
    const mocks: ItemToolMock[] = [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }];

    const result = await executeTarget(agent, 'agent', { input: 'hi' }, { toolMocks: mocks });

    expect(result.error).toBeNull();
    expect(liveExecutions).toEqual([]); // mock short-circuited the live tool
    expect(result.toolMockReport?.served).toEqual([
      { mockIndex: 0, toolName: 'getWeather', args: { city: 'Seattle' } },
    ]);
    expect(result.toolMockReport?.failure).toBeUndefined();
  });

  it('fails the item with TOOL_MOCK_MISMATCH when args do not match; live tool never runs', async () => {
    const liveExecutions: ToolCall[] = [];
    const agent = createHookDrivenAgent({
      toolCalls: [{ toolName: 'getWeather', input: { city: 'Paris' } }],
      liveExecutions,
    });
    const mocks: ItemToolMock[] = [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }];

    const result = await executeTarget(agent, 'agent', { input: 'hi' }, { toolMocks: mocks });

    expect(result.output).toBeNull();
    expect(result.error?.code).toBe(TOOL_MOCK_MISMATCH);
    expect(liveExecutions).toEqual([]); // mocked tool must not run live on mismatch
    expect(result.toolMockReport?.failure?.code).toBe(TOOL_MOCK_MISMATCH);
  });

  it('fails with TOOL_MOCK_EXHAUSTED when a mocked (tool,args) is called more times than provided', async () => {
    const liveExecutions: ToolCall[] = [];
    const agent = createHookDrivenAgent({
      toolCalls: [
        { toolName: 'write', input: { f: 'a' } },
        { toolName: 'write', input: { f: 'a' } },
      ],
      liveExecutions,
    });
    const mocks: ItemToolMock[] = [{ toolName: 'write', args: { f: 'a' }, output: 'first' }];

    const result = await executeTarget(agent, 'agent', { input: 'hi' }, { toolMocks: mocks });

    expect(result.error?.code).toBe(TOOL_MOCK_EXHAUSTED);
    expect(liveExecutions).toEqual([]);
  });

  it('runs unmocked tools live and records them in the report (item still passes)', async () => {
    const liveExecutions: ToolCall[] = [];
    const agent = createHookDrivenAgent({
      toolCalls: [
        { toolName: 'mocked', input: { a: 1 } },
        { toolName: 'unmocked', input: { b: 2 } },
      ],
      liveExecutions,
    });
    const mocks: ItemToolMock[] = [{ toolName: 'mocked', args: { a: 1 }, output: 'm' }];

    const result = await executeTarget(agent, 'agent', { input: 'hi' }, { toolMocks: mocks });

    expect(result.error).toBeNull();
    expect(liveExecutions).toEqual([{ toolName: 'unmocked', input: { b: 2 } }]);
    expect(result.toolMockReport?.liveCalls).toEqual([{ toolName: 'unmocked', args: { b: 2 } }]);
  });

  it('denies undeclared tools before live execution', async () => {
    const liveExecutions: ToolCall[] = [];
    const agent = createHookDrivenAgent({
      toolCalls: [{ toolName: 'undeclared', input: { b: 2 } }],
      liveExecutions,
    });

    const result = await executeTarget(agent, 'agent', { input: 'hi' }, { unmockedToolPolicy: 'deny' });

    expect(result.output).toBeNull();
    expect(result.error?.code).toBe(TOOL_MOCK_NOT_DECLARED);
    expect(liveExecutions).toEqual([]);
    expect(result.toolMockReport).toMatchObject({
      liveCalls: [],
      failure: { code: TOOL_MOCK_NOT_DECLARED, toolName: 'undeclared', args: { b: 2 } },
    });
  });

  it('reports unconsumed mocks without failing the item', async () => {
    const liveExecutions: ToolCall[] = [];
    const agent = createHookDrivenAgent({
      toolCalls: [{ toolName: 't', input: { a: 1 } }],
      liveExecutions,
    });
    const mocks: ItemToolMock[] = [
      { toolName: 't', args: { a: 1 }, output: 'x' },
      { toolName: 't', args: { a: 2 }, output: 'y' },
    ];

    const result = await executeTarget(agent, 'agent', { input: 'hi' }, { toolMocks: mocks });

    expect(result.error).toBeNull();
    expect(result.toolMockReport?.unconsumed).toEqual([{ mockIndex: 1, toolName: 't', args: { a: 2 } }]);
  });

  it('user beforeToolCall returning proceed:false short-circuits and leaves the mock unconsumed', async () => {
    const liveExecutions: ToolCall[] = [];
    const userBefore = vi.fn().mockReturnValue({ proceed: false, output: 'from-user-hook' });
    const agent = createHookDrivenAgent({
      toolCalls: [{ toolName: 'getWeather', input: { city: 'Seattle' } }],
      liveExecutions,
      configuredHooks: { beforeToolCall: userBefore },
    });
    const mocks: ItemToolMock[] = [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }];

    const result = await executeTarget(agent, 'agent', { input: 'hi' }, { toolMocks: mocks });

    expect(result.error).toBeNull();
    expect(userBefore).toHaveBeenCalledTimes(1);
    // user hook short-circuited → mock never consumed → reported unconsumed, no failure
    expect(result.toolMockReport?.served).toEqual([]);
    expect(result.toolMockReport?.unconsumed).toEqual([
      { mockIndex: 0, toolName: 'getWeather', args: { city: 'Seattle' } },
    ]);
    expect(result.toolMockReport?.failure).toBeUndefined();
    expect(liveExecutions).toEqual([]);
  });

  it('runs user afterToolCall for mocked outputs too', async () => {
    const liveExecutions: ToolCall[] = [];
    const afterCalls: any[] = [];
    const agent = createHookDrivenAgent({
      toolCalls: [{ toolName: 'getWeather', input: { city: 'Seattle' } }],
      liveExecutions,
      configuredHooks: { afterToolCall: ctx => afterCalls.push(ctx) },
    });
    const mocks: ItemToolMock[] = [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }];

    await executeTarget(agent, 'agent', { input: 'hi' }, { toolMocks: mocks });

    expect(afterCalls).toHaveLength(1);
    expect(afterCalls[0].toolName).toBe('getWeather');
    expect(afterCalls[0].output).toEqual({ temp: 52 });
  });

  it('does not attach a report or alter behavior when the item has no mocks', async () => {
    const liveExecutions: ToolCall[] = [];
    const agent = createHookDrivenAgent({
      toolCalls: [{ toolName: 'anyTool', input: {} }],
      liveExecutions,
    });

    const result = await executeTarget(agent, 'agent', { input: 'hi' }, { toolMocks: [] });

    expect(result.error).toBeNull();
    expect(result.toolMockReport).toBeUndefined();
    expect(liveExecutions).toEqual([{ toolName: 'anyTool', input: {} }]);
  });

  it('serves repeated same-args mocks in declared order across calls', async () => {
    const liveExecutions: ToolCall[] = [];
    const seen: unknown[] = [];
    const agent = createHookDrivenAgent({
      toolCalls: [
        { toolName: 'write', input: { f: 'a' } },
        { toolName: 'write', input: { f: 'a' } },
      ],
      liveExecutions,
      configuredHooks: {
        // capture nothing live; mocks short-circuit. Use afterToolCall to observe served outputs.
        afterToolCall: ctx => seen.push(ctx.output),
      },
    });
    const mocks: ItemToolMock[] = [
      { toolName: 'write', args: { f: 'a' }, output: 'first' },
      { toolName: 'write', args: { f: 'a' }, output: 'second' },
    ];

    await executeTarget(agent, 'agent', { input: 'hi' }, { toolMocks: mocks });

    expect(seen).toEqual(['first', 'second']);
  });

  it('aborts immediately on mock mismatch: a later live tool never runs (Fix 1)', async () => {
    const liveExecutions: ToolCall[] = [];
    const agent = createHookDrivenAgent({
      toolCalls: [
        // A: mocked but mis-called → must abort the run here
        { toolName: 'getWeather', input: { city: 'Paris' } },
        // B: a live, side-effecting tool the model would call *after* A → must NOT run
        { toolName: 'sendEmail', input: { to: 'a@b.c' } },
      ],
      liveExecutions,
    });
    const mocks: ItemToolMock[] = [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }];

    const result = await executeTarget(agent, 'agent', { input: 'hi' }, { toolMocks: mocks });

    expect(result.output).toBeNull();
    expect(result.error?.code).toBe(TOOL_MOCK_MISMATCH);
    // The whole point: B's live execution must be blocked by the abort.
    expect(liveExecutions).toEqual([]);
    expect(result.toolMockReport?.failure?.code).toBe(TOOL_MOCK_MISMATCH);
  });

  it('forces sequential tool execution when the item has mocks (toolCallConcurrency: 1)', async () => {
    const liveExecutions: ToolCall[] = [];
    const agent = createHookDrivenAgent({
      toolCalls: [{ toolName: 't', input: { a: 1 } }],
      liveExecutions,
    });
    const mocks: ItemToolMock[] = [{ toolName: 't', args: { a: 1 }, output: 'x' }];

    await executeTarget(agent, 'agent', { input: 'hi' }, { toolMocks: mocks });

    const runOptions = (agent.generate as any).mock.calls[0][1];
    expect(runOptions.toolCallConcurrency).toBe(1);
  });
});

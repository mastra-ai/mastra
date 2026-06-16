import { afterEach, describe, expect, it, vi } from 'vitest';

import { Agent } from '../agent';
import { RequestContext } from '../request-context';
import { SignalProvider } from '../signals/signal-provider';

import { Harness } from './harness';
import type * as Tools from './tools';
import type { HarnessSubagent } from './types';

// Capture the options passed to createSubagentTool so we can poke at the
// cloneThreadForFork callback the harness wired up — without having to
// execute a real subagent (which would need a live model + memory).
const capturedOpts: Array<Record<string, unknown>> = [];
vi.mock('./tools', async () => {
  const actual = await vi.importActual<typeof Tools>('./tools');
  return {
    ...actual,
    createSubagentTool: (opts: Record<string, unknown>) => {
      capturedOpts.push(opts);
      return actual.createSubagentTool(opts as Parameters<typeof actual.createSubagentTool>[0]);
    },
  };
});

describe('Harness fork clone metadata wiring', () => {
  afterEach(() => {
    capturedOpts.length = 0;
  });

  it('passes forkedSubagent + parentThreadId metadata through to memory.cloneThread', async () => {
    const cloneThread = vi.fn().mockResolvedValue({
      thread: {
        id: 'forked-thread-id',
        resourceId: 'parent-resource',
        title: 'Fork: Explore subagent',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      },
      clonedMessages: [],
      messageIdMap: {},
    });

    const memoryFactory = vi.fn().mockResolvedValue({ cloneThread });

    const subagents: HarnessSubagent[] = [
      {
        id: 'explore',
        name: 'Explore',
        description: 'Explore',
        instructions: 'Be exploratory.',
        forked: true,
      },
    ];

    const harness = new Harness({
      id: 'test',
      resourceId: 'parent-resource',
      memory: memoryFactory as unknown as never,
      subagents,
      resolveModel: () => ({}) as never,
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          defaultModelId: 'openai/gpt-4o',
          agent: new Agent({
            name: 'parent',
            instructions: 'parent',
            model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
          }),
        },
      ],
    });

    await harness.init();

    // Invoke the private buildToolsets to trigger createSubagentTool with the
    // wired-in cloneThreadForFork callback.
    await (harness as unknown as { buildToolsets(ctx: RequestContext): Promise<unknown> }).buildToolsets(
      new RequestContext(),
    );

    expect(capturedOpts).toHaveLength(1);
    const captured = capturedOpts[0]!;
    const cloneCb = captured.cloneThreadForFork as (a: { sourceThreadId: string; title?: string }) => Promise<unknown>;
    expect(cloneCb).toBeTypeOf('function');

    await cloneCb({ sourceThreadId: 'parent-thread-xyz', title: 'Fork: Explore subagent' });

    expect(cloneThread).toHaveBeenCalledTimes(1);
    expect(cloneThread).toHaveBeenCalledWith({
      sourceThreadId: 'parent-thread-xyz',
      resourceId: 'parent-resource',
      title: 'Fork: Explore subagent',
      metadata: {
        forkedSubagent: true,
        parentThreadId: 'parent-thread-xyz',
      },
    });
  });

  it('does not create the subagent tool from gateways without an app-provided resolver', async () => {
    const subagents: HarnessSubagent[] = [
      {
        id: 'explore',
        name: 'Explore',
        description: 'Explore',
        instructions: 'Be exploratory.',
      },
    ];
    const gateway = {
      id: 'test-gateway',
      name: 'Test Gateway',
      fetchProviders: vi.fn(async () => ({})),
      buildUrl: vi.fn((modelId: string) => modelId),
      getApiKey: vi.fn(async () => ''),
      resolveLanguageModel: vi.fn(),
    };

    const harness = new Harness({
      id: 'test',
      resourceId: 'parent-resource',
      subagents,
      gateways: [gateway],
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          defaultModelId: 'openai/gpt-4o',
          agent: new Agent({
            name: 'parent',
            instructions: 'parent',
            model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
          }),
        },
      ],
    });

    const toolsets = (await (
      harness as unknown as { buildToolsets(ctx: RequestContext): Promise<Record<string, unknown>> }
    ).buildToolsets(new RequestContext())) as { harnessBuiltIn?: Record<string, unknown> };

    expect(capturedOpts).toHaveLength(0);
    expect(toolsets.harnessBuiltIn?.subagent).toBeUndefined();
  });

  it('wires getParentToolsets so forks can inherit parent toolsets', async () => {
    const memoryFactory = vi.fn().mockResolvedValue({ cloneThread: vi.fn() });

    const subagents: HarnessSubagent[] = [
      {
        id: 'explore',
        name: 'Explore',
        description: 'Explore',
        instructions: 'Be exploratory.',
      },
    ];

    const harness = new Harness({
      id: 'test',
      resourceId: 'parent-resource',
      memory: memoryFactory as unknown as never,
      subagents,
      resolveModel: () => ({}) as never,
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          defaultModelId: 'openai/gpt-4o',
          agent: new Agent({
            name: 'parent',
            instructions: 'parent',
            model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
          }),
        },
      ],
    });

    await harness.init();

    await (harness as unknown as { buildToolsets(ctx: RequestContext): Promise<unknown> }).buildToolsets(
      new RequestContext(),
    );

    expect(capturedOpts).toHaveLength(1);
    const captured = capturedOpts[0]!;
    const getParentToolsets = captured.getParentToolsets as () => Promise<Record<string, unknown>>;
    expect(getParentToolsets).toBeTypeOf('function');

    const toolsets = await getParentToolsets();
    // The harness's built-in toolset should always include subagent + ask_user
    // when subagents are configured.
    expect(toolsets.harnessBuiltIn).toBeDefined();
    const builtIn = toolsets.harnessBuiltIn as Record<string, unknown>;
    expect(builtIn.subagent).toBeDefined();
    expect(builtIn.ask_user).toBeDefined();
  });

  it('propagates memory to the base config.agent so signal providers have access', async () => {
    class TestSignalProvider extends SignalProvider<'test-signals'> {
      readonly id = 'test-signals' as const;
      getConnectedAgent() {
        return this.agent;
      }
    }

    const signalProvider = new TestSignalProvider();
    const memoryFactory = vi.fn().mockResolvedValue({});

    const baseAgent = new Agent({
      name: 'base',
      instructions: 'base agent',
      model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
      signals: [signalProvider],
    });

    // Signal provider is connected to the base agent
    expect(signalProvider.isConnected).toBe(true);
    expect(signalProvider.getConnectedAgent()).toBe(baseAgent);

    // Before harness init, base agent has no memory
    expect(baseAgent.hasOwnMemory()).toBe(false);

    const harness = new Harness({
      id: 'test',
      resourceId: 'test-resource',
      memory: memoryFactory as unknown as never,
      modes: [
        {
          id: 'build',
          name: 'Build',
          default: true,
          defaultModelId: 'openai/gpt-4o',
          instructions: 'Build things.',
        },
        {
          id: 'plan',
          name: 'Plan',
          defaultModelId: 'openai/gpt-4o',
          instructions: 'Plan things.',
        },
      ],
      agent: baseAgent,
    });

    await harness.init();

    // After init, signal provider's connected agent (the base agent) should have memory
    const connectedAgent = signalProvider.getConnectedAgent()!;
    expect(connectedAgent).toBe(baseAgent);
    expect(connectedAgent.hasOwnMemory()).toBe(true);
  });
});

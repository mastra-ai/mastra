import { describe, expect, it } from 'vitest';
import { RequestContext } from '../request-context';
import { createTestAgent, createTestSession } from './test-utils';
import type { AgentControllerRunOptions } from './types';

/**
 * `buildSharedRunOptions` is host-owned machinery reached through the session,
 * and is the single place both the initial stream and every resume read their
 * run budget from.
 */
async function sharedRunOptions(runOptions?: AgentControllerRunOptions, requestContext?: RequestContext) {
  const { session } = await createTestSession(runOptions ? { runOptions } : {});
  return await session.machinery.buildSharedRunOptions(requestContext);
}

describe('AgentController run options', () => {
  it('keeps the controller defaults when no run options are configured', async () => {
    const options = await sharedRunOptions();

    expect(options.maxSteps).toBe(1000);
    expect(options.savePerStep).toBe(false);
    expect(options.requireToolApproval).toBe(true);
  });

  it('lets a host override the loop controls it owns', async () => {
    const stopWhen = () => true;
    const prepareStep = () => ({ activeTools: ['read'] });

    const options = await sharedRunOptions({
      maxSteps: 12,
      stopWhen,
      prepareStep,
      savePerStep: true,
      toolCallConcurrency: 4,
      modelSettings: { temperature: 0 },
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    } as AgentControllerRunOptions);

    expect(options.maxSteps).toBe(12);
    expect(options.stopWhen).toBe(stopWhen);
    expect(options.prepareStep).toBe(prepareStep);
    expect(options.savePerStep).toBe(true);
    expect(options.toolCallConcurrency).toBe(4);
    expect(options.modelSettings).toEqual({ temperature: 0 });
    expect(options.providerOptions).toEqual({ anthropic: { cacheControl: { type: 'ephemeral' } } });
  });

  it('resolves a per-request factory against the run request context', async () => {
    const requestContext = new RequestContext();
    requestContext.set('budget', 5);

    const { session } = await createTestSession({
      runOptions: ({ requestContext: ctx }) => ({ maxSteps: (ctx.get('budget') as number) ?? 1 }),
    });

    const options = await session.machinery.buildSharedRunOptions(requestContext);

    expect(options.maxSteps).toBe(5);
  });

  it('does not let run options reach a controller-owned key', async () => {
    const abortSignal = new AbortController().signal;

    const options = await sharedRunOptions({
      maxSteps: 7,
      // A controller-owned option supplied by an untyped caller must be ignored:
      // a run whose abort signal or thread binding came from outside the session
      // could not be cancelled or persisted correctly.
      abortSignal,
      memory: { thread: 'spoofed', resource: 'spoofed' },
      requireToolApproval: false,
      toolsets: { spoofed: {} },
    } as unknown as AgentControllerRunOptions);

    expect(options.maxSteps).toBe(7);
    expect(options.abortSignal).toBeUndefined();
    expect(options.memory).toBeUndefined();
    expect(options.toolsets).toBeUndefined();
    expect(options.requireToolApproval).toBe(true);
  });

  it('merges host provider options with the fable server-side fallback', async () => {
    const { session } = await createTestSession({
      agent: createTestAgent({ model: 'anthropic/claude-fable-5' }),
      runOptions: {
        providerOptions: {
          anthropic: { cacheControl: { type: 'ephemeral' } },
          openai: { store: false },
        },
      } as AgentControllerRunOptions,
    });
    session.model.set({ modelId: 'anthropic/claude-fable-5' });

    const options = (await session.machinery.buildSharedRunOptions()) as {
      providerOptions: { anthropic: Record<string, unknown>; openai: Record<string, unknown> };
    };

    // The fallback is added without dropping the host's own provider options.
    expect(options.providerOptions.anthropic.fallbacks).toBeDefined();
    expect(options.providerOptions.anthropic.cacheControl).toEqual({ type: 'ephemeral' });
    expect(options.providerOptions.openai).toEqual({ store: false });
  });
});

import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { MODEL_FALLBACK_PART_TYPE } from './account-rotation-processor.js';
import { MastraCodeCyberRefusalHandler } from './cyber-refusal-fallback.js';

const CYBER_POLICY_ERROR = Object.assign(new Error('This content was flagged for possible cybersecurity risk.'), {
  data: { error: { code: 'cyber_policy' } },
});

const ROUTE = [
  { id: 'kimi', label: 'Kimi', modelId: 'kimi/k3' },
  { id: 'anthropic', label: 'Anthropic', modelId: 'anthropic/claude-opus-5-5' },
  { id: 'openai', label: 'OpenAI', modelId: 'openai/gpt-5.5' },
];

function setup(
  modelRoute: { entries: typeof ROUTE; cyberFallback?: (typeof ROUTE)[number] },
  sessionModelId = 'kimi/k3',
) {
  const requestContext = new RequestContext();
  const events: Array<{ type: string; message: string }> = [];
  requestContext.set('controller', {
    threadId: 'thread-1',
    session: { modelId: sessionModelId },
    getState: () => ({ modelRoute }),
    emitEvent: (event: { type: string; message: string }) => events.push(event),
  });
  const resolveModel = vi.fn(async (modelId: string) => modelId as never);
  const handler = new MastraCodeCyberRefusalHandler({ resolveModel });
  const state: Record<string, unknown> = {};
  const writes: unknown[] = [];
  const writer = { custom: async (part: unknown) => void writes.push(part) };

  const refuse = () =>
    handler.processAPIError({
      error: CYBER_POLICY_ERROR,
      retryCount: 1,
      state,
      requestContext,
    } as never);
  const nextStep = () => handler.processInputStep({ state, requestContext, writer } as never);

  return { resolveModel, refuse, nextStep, writes, events };
}

describe('MastraCodeCyberRefusalHandler', () => {
  it('uses the pack cyber fallback before the pack fallback chain, and only once', async () => {
    const { resolveModel, refuse, nextStep, writes, events } = setup({ entries: ROUTE, cyberFallback: ROUTE[2] });

    expect(await refuse()).toEqual({ retry: true });
    expect(resolveModel).toHaveBeenCalledWith('openai/gpt-5.5', expect.anything());
    // Resolved models are wrapped by core; the swap is what matters here.
    expect(await nextStep()).toHaveProperty('model');
    expect(writes).toEqual([
      {
        type: MODEL_FALLBACK_PART_TYPE,
        data: expect.objectContaining({
          from: { entryId: 'kimi', label: 'Kimi' },
          to: { entryId: 'openai', label: 'OpenAI' },
          reason: 'refusal',
        }),
      },
    ]);
    expect(events).toEqual([{ type: 'info', message: 'Switched model route: Kimi → OpenAI (model refused)' }]);

    // The cyber fallback refused too: the turn ends instead of walking the chain.
    expect(await refuse()).toBeUndefined();
    expect(resolveModel).toHaveBeenCalledTimes(1);
  });

  it('walks the pack fallback chain when no cyber fallback is set', async () => {
    const { resolveModel, refuse, nextStep, writes } = setup({ entries: ROUTE });

    expect(await refuse()).toEqual({ retry: true });
    await nextStep();
    expect(await refuse()).toEqual({ retry: true });
    await nextStep();
    expect(await refuse()).toBeUndefined();

    expect(resolveModel.mock.calls.map(([modelId]) => modelId)).toEqual([
      'anthropic/claude-opus-5-5',
      'openai/gpt-5.5',
    ]);
    expect(writes.map(part => (part as { data: { from: { label: string }; to: { label: string } } }).data)).toEqual([
      expect.objectContaining({
        from: { entryId: 'kimi', label: 'Kimi' },
        to: { entryId: 'anthropic', label: 'Anthropic' },
      }),
      expect.objectContaining({
        from: { entryId: 'anthropic', label: 'Anthropic' },
        to: { entryId: 'openai', label: 'OpenAI' },
      }),
    ]);
  });

  it('ends the turn as before when the session model is not the head of the route and has no auto fallback', async () => {
    const { resolveModel, refuse } = setup({ entries: ROUTE }, 'openai/gpt-5.5');

    expect(await refuse()).toBeUndefined();
    expect(resolveModel).not.toHaveBeenCalled();
  });

  it("tries core's auto fallback for the running model before the pack chain", async () => {
    const route = [ROUTE[1], ROUTE[2]];
    const { resolveModel, refuse, nextStep, writes } = setup({ entries: route }, 'anthropic/claude-opus-5-5');

    expect(await refuse()).toEqual({ retry: true });
    await nextStep();
    expect(await refuse()).toEqual({ retry: true });
    await nextStep();
    expect(await refuse()).toBeUndefined();

    expect(resolveModel.mock.calls.map(([modelId]) => modelId)).toEqual([
      'anthropic/claude-opus-4-8',
      'openai/gpt-5.5',
    ]);
    expect((writes[0] as { data: unknown }).data).toEqual(
      expect.objectContaining({
        from: { entryId: 'anthropic', label: 'Anthropic' },
        to: { entryId: 'anthropic/claude-opus-4-8', label: 'anthropic/claude-opus-4-8' },
        reason: 'refusal',
      }),
    );
  });

  it('uses the auto fallback even when the running model is not the head of the route', async () => {
    const { resolveModel, refuse } = setup({ entries: ROUTE }, 'anthropic/claude-opus-5-5');

    expect(await refuse()).toEqual({ retry: true });
    expect(await refuse()).toBeUndefined();
    expect(resolveModel.mock.calls.map(([modelId]) => modelId)).toEqual(['anthropic/claude-opus-4-8']);
  });

  it('lets the pack cyber fallback override the auto fallback', async () => {
    const route = [ROUTE[1], ROUTE[2]];
    const { resolveModel, refuse } = setup({ entries: route, cyberFallback: ROUTE[0] }, 'anthropic/claude-opus-5-5');

    expect(await refuse()).toEqual({ retry: true });
    expect(await refuse()).toBeUndefined();
    expect(resolveModel.mock.calls.map(([modelId]) => modelId)).toEqual(['kimi/k3']);
  });
});

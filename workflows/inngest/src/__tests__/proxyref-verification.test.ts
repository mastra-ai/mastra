/**
 * Targeted verification that the proxyRef pattern in createInngestAgent works
 * correctly for the untilIdle delegation path.
 *
 * The concern: createInngestAgent uses a late-bound `proxyRef` closure variable
 * that's assigned AFTER the Proxy is constructed. When stream({ untilIdle: true })
 * is called, it passes proxyRef to runDurableStreamUntilIdle, which then calls
 * agent.getDefaultOptions(), agent.getMemory(), agent.id, and agent.stream()
 * on that reference. This test verifies:
 *
 * 1. proxyRef is populated (not undefined) after factory returns
 * 2. The proxy properly forwards getDefaultOptions() and getMemory() to the
 *    underlying Agent (these are NOT on the inngestAgent object literal)
 * 3. stream({ untilIdle: true }) can reach the delegation path without error
 */

import { Agent } from '@mastra/core/agent';
import { Inngest } from 'inngest';
import { describe, it, expect, vi } from 'vitest';

import { createInngestAgent } from '../index';

function createMockModel() {
  return {
    provider: 'test',
    modelId: 'test-model',
    specificationVersion: 'v1',
    supportsStructuredOutputs: true,
    doGenerate: vi.fn(),
    doStream: vi.fn().mockImplementation(async () => {
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-delta', textDelta: 'Hello' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 5 },
            });
            controller.close();
          },
        }),
        rawCall: { rawPrompt: '', rawSettings: {} },
      };
    }),
  };
}

describe('InngestAgent proxyRef verification', () => {
  const inngest = new Inngest({
    id: 'proxyref-verification',
    baseUrl: 'http://localhost:9999', // not needed for these tests
  });

  it('proxy forwards getDefaultOptions and getMemory to the underlying Agent', async () => {
    const agent = new Agent({
      id: 'proxy-fwd-test',
      name: 'Proxy Forward Test',
      instructions: 'test',
      model: createMockModel() as any,
    });

    const durableAgent = createInngestAgent({ agent, inngest });

    // These methods are NOT on the inngestAgent object literal —
    // they must be forwarded through the Proxy to the underlying Agent.
    expect(typeof durableAgent.getDefaultOptions).toBe('function');
    expect(typeof durableAgent.getMemory).toBe('function');

    // Verify they actually call through to the underlying agent
    // (getMemory returns undefined when no memory is configured)
    await expect(durableAgent.getMemory()).resolves.toBeUndefined();

    // getDefaultOptions returns the agent's default options (synchronously)
    const defaultOpts = durableAgent.getDefaultOptions({});
    expect(defaultOpts).toBeDefined();
  });

  it('proxy id returns the correct agent id', () => {
    const agent = new Agent({
      id: 'proxy-id-test',
      name: 'Proxy ID Test',
      instructions: 'test',
      model: createMockModel() as any,
    });

    const durableAgent = createInngestAgent({ agent, inngest });
    expect(durableAgent.id).toBe('proxy-id-test');
  });

  it('stream({ untilIdle: true }) reaches the delegation path without proxyRef being undefined', async () => {
    const agent = new Agent({
      id: 'until-idle-proxy-test',
      name: 'Until Idle Proxy Test',
      instructions: 'test',
      model: createMockModel() as any,
    });

    const durableAgent = createInngestAgent({ agent, inngest });

    // When stream({ untilIdle: true }) is called:
    // 1. It checks streamOptions.untilIdle → true
    // 2. It calls runDurableStreamUntilIdle(proxyRef, ...)
    // 3. runDurableStreamUntilIdle calls agent.getDefaultOptions() on proxyRef
    // 4. Then calls agent.getMemory() (via resolveScope)
    // 5. Since no memory or bgManager, it falls through to agent.stream() without untilIdle
    //
    // If proxyRef were undefined, step 3 would throw:
    //   "Cannot read properties of undefined (reading 'getDefaultOptions')"
    //
    // If the proxy didn't forward getDefaultOptions, step 3 would throw:
    //   "agent.getDefaultOptions is not a function"
    //
    // The fallback agent.stream() call (step 5) will try to connect to Inngest
    // which isn't running, so we expect a connection/timeout error — NOT a
    // proxyRef/method resolution error.

    try {
      await durableAgent.stream('test', { untilIdle: true });
      // If this succeeds, the proxyRef pattern works (unlikely without Inngest running)
    } catch (error: any) {
      // We expect an error from the Inngest/pubsub layer, NOT from proxyRef being undefined
      const msg = error?.message ?? String(error);
      expect(msg).not.toContain('Cannot read properties of undefined');
      expect(msg).not.toContain('is not a function');
      expect(msg).not.toContain('proxyRef');
      // The error should be from the actual stream execution (pubsub, Inngest, etc.)
      // This proves proxyRef was populated and the proxy forwarding worked
    }
  });
});

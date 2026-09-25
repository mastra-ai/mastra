/**
 * Pins the storage-capability fallback for durable agents.
 *
 * The evented engine advances a run from concurrent workers, so its `createRun()`
 * refuses to start on a store that cannot apply concurrent updates atomically
 * (Redis, Valkey, ClickHouse, LanceDB, Cloudflare, Elasticsearch). Durable agents
 * must not inherit that error: before the evented engine was re-enabled they ran
 * the loop in-process regardless of storage, so throwing here would turn a working
 * agent into a hard failure on upgrade. They degrade with a warning instead, the
 * same way a hostless EventedAgent does (see DurableAgent.resolveWorkflowEngine).
 *
 * A workflow that opts into the engine directly via `schedule` still gets the
 * error — see workflows/evented/storage-capability-gate.test.ts.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { noopLogger } from '../../../logger/noop-logger';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { Agent } from '../../agent';
import { createEventedAgent } from '../create-evented-agent';

function createTextStreamModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as unknown as LanguageModelV2;
}

/**
 * Installs a capturing logger that survives Mastra's `__setLogger`, which would
 * otherwise throw on a getter-only spy. Must be installed before `new Mastra(...)`:
 * the engine resolves during agent registration, which happens before Mastra
 * installs its own logger on the wrapper.
 */
function captureWarnings(agent: unknown) {
  const warn = vi.fn();
  const logger = { ...noopLogger, warn };
  Object.defineProperty(agent, 'logger', { get: () => logger, set: () => {}, configurable: true });
  return warn;
}

function buildEventedAgent(id: string) {
  return createEventedAgent({
    agent: new Agent({
      id,
      name: id,
      instructions: 'You are a helpful assistant',
      model: createTextStreamModel('hello'),
    }),
  });
}

describe('EventedAgent on storage without atomic concurrent updates', () => {
  it('falls back to the default in-process engine with a warning and still streams', async () => {
    const agent = buildEventedAgent('non-atomic-store-agent');

    const storage = new MockStore();
    // Stand in for Redis/Valkey/ClickHouse et al. Spied before `new Mastra(...)`:
    // the engine resolves during agent registration and is memoized.
    vi.spyOn(storage.stores.workflows as any, 'supportsConcurrentUpdates').mockReturnValue(false);

    const warn = captureWarnings(agent);

    new Mastra({ storage, agents: { 'non-atomic-store-agent': agent }, logger: false });

    // The agent resolved onto the default engine rather than throwing.
    expect((agent.getWorkflow() as any).engineType).toBe('default');

    // The degradation is visible and names the capability, and is memoized so it
    // warns once rather than on every read.
    const capabilityWarnings = warn.mock.calls.filter((c: any[]) => String(c[0]).includes('supportsConcurrentUpdates'));
    expect(capabilityWarnings).toHaveLength(1);

    // Most importantly: the agent still runs. This is the regression being prevented.
    const { output, cleanup } = await agent.stream('Hi');
    await output.consumeStream();
    expect(await output.text).toBe('hello');

    cleanup();
  }, 30_000);

  it('stays on the evented engine when the store supports atomic concurrent updates', async () => {
    const agent = buildEventedAgent('atomic-store-agent');

    const warn = captureWarnings(agent);

    new Mastra({ storage: new MockStore(), agents: { 'atomic-store-agent': agent }, logger: false });

    expect((agent.getWorkflow() as any).engineType).toBe('evented');
    expect(warn.mock.calls.filter((c: any[]) => String(c[0]).includes('supportsConcurrentUpdates'))).toHaveLength(0);
  });
});

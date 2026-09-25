/**
 * Pins the hostless EventedAgent fallback: a standalone
 * `createEventedAgent({ agent })` that was never registered on a Mastra
 * instance cannot execute evented runs (the evented engine's `createRun`
 * requires the host's registries, storage, and event workers). Before the
 * evented engine was re-enabled, such an agent silently streamed on the
 * default in-process engine — released behavior we preserve, now with a
 * warning instead of silence (see DurableAgent.resolveWorkflowEngine).
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { noopLogger } from '../../../logger/noop-logger';
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

describe('EventedAgent without a Mastra host', () => {
  it('falls back to the default in-process engine with a warning and streams', async () => {
    const baseAgent = new Agent({
      id: 'hostless-agent',
      name: 'Hostless Agent',
      instructions: 'You are a helpful assistant',
      model: createTextStreamModel('hello'),
    });
    const agent = createEventedAgent({ agent: baseAgent });

    const warn = vi.fn();
    vi.spyOn(agent as any, 'logger', 'get').mockReturnValue({ ...noopLogger, warn });

    const { output, cleanup } = await agent.stream('Hi');
    await output.consumeStream();
    expect(await output.text).toBe('hello');

    // The workflow instance runs on the default engine, not evented.
    const workflow = agent.getWorkflow();
    expect((workflow as any).engineType).toBe('default');

    // The degradation is visible, and memoized (warned once, not per read).
    const hostWarnings = warn.mock.calls.filter((c: any[]) => String(c[0]).includes('no Mastra host'));
    expect(hostWarnings).toHaveLength(1);

    cleanup();
  }, 30_000);
});

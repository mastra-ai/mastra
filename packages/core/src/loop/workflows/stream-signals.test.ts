import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { createSignal } from '../../agent/signals';
import { agentThreadStreamRuntime } from '../../agent/thread-stream-runtime';

describe.each(['initial', 'pre-run', 'drain-step', 'loop-predicate'] as const)(
  'regular workflow signal producer: %s',
  producer => {
    beforeEach(() => agentThreadStreamRuntime.resetForTests());
    afterEach(() => vi.restoreAllMocks());

    it.each(
      (['reactive', 'system-reminder'] as const).flatMap(type => [false, true].map(excluded => ({ type, excluded }))),
    )('emits $type without changing model delivery (excluded: $excluded)', async ({ type, excluded }) => {
      const signal = createSignal({ type, contents: 'producer reminder' });
      const model = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text' },
            { type: 'text-delta', id: 'text', delta: 'answer' },
            { type: 'text-end', id: 'text' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } },
          ]),
        }),
      });
      const agent = new Agent({ id: 'producer', name: 'producer', instructions: 'test', model });
      let emitted = false;
      let pendingDrains = 0;
      vi.spyOn(agentThreadStreamRuntime, 'drainPendingSignals').mockImplementation((_, __, scope) => {
        if (scope !== 'pre-run') pendingDrains++;
        const ready =
          producer === 'pre-run'
            ? scope === 'pre-run'
            : producer === 'drain-step'
              ? pendingDrains === 1
              : producer === 'loop-predicate'
                ? pendingDrains === 2
                : false;
        if (!emitted && ready) {
          emitted = true;
          return [signal];
        }
        return [];
      });
      const output = await agent.stream(producer === 'initial' ? [signal.toDBMessage()] : 'hello', {
        maxSteps: 3,
        excludeSignals: excluded ? [type] : [],
      });
      const chunks = [];
      for await (const chunk of output.fullStream) chunks.push(chunk);
      expect(chunks.filter(chunk => chunk.type === 'data-signal')).toHaveLength(excluded ? 0 : 1);
      expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
      expect(model.doStreamCalls).toHaveLength(producer === 'initial' || producer === 'pre-run' ? 1 : 2);
      expect(JSON.stringify(model.doStreamCalls.at(-1)?.prompt)).toContain('producer reminder');
      if (producer !== 'initial') expect(emitted).toBe(true);
    });
  },
);

/**
 * Regression tests for https://github.com/mastra-ai/mastra/issues/24354:
 * the Observer's degenerate-output detector must not reject faithful summaries
 * of long or repetitive tool output, and persistent degenerate output must skip
 * the observation cycle instead of failing the agent run.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';
import { ObservationalMemory } from '../observational-memory';
import { parseMultiThreadObserverOutput, parseObserverOutput } from '../observer-agent';

beforeEach(() => {
  BufferingCoordinator.asyncBufferingOps.clear();
  BufferingCoordinator.lastBufferedBoundary.clear();
  BufferingCoordinator.lastBufferedAtTime.clear();
  BufferingCoordinator.reflectionBufferCycleIds.clear();
});

// A single legitimately-long line, e.g. a summarized progress bar (reporter saw 72k–237k chars).
const giantLine = `- 🟡 Build output: ${Array.from({ length: 12_000 }, (_, i) => `step${i}`).join(' ')}`;

// Faithful summary of a build thread: many identical tool results in a row.
const repetitiveToolLines = [
  '- 🔴 User asked to run the build and tests',
  ...Array.from({ length: 40 }, () => '  * -> execute_command pnpm build → ok (exit 0)'),
  '- 🟡 All build steps succeeded',
].join('\n');

describe('Observer degenerate detection (#24354)', () => {
  it('truncates a giant single line instead of flagging it as degenerate', () => {
    expect(giantLine.length).toBeGreaterThan(50_000);
    const result = parseObserverOutput(`<observations>\n${giantLine}\n</observations>`);

    expect(result.degenerate).not.toBe(true);
    expect(result.observations).toContain('Build output');
    expect(result.observations).toContain('[truncated]');
    expect(result.observations.length).toBeLessThan(11_000);
  });

  it('truncates a giant single line in multi-thread output instead of flagging it as degenerate', () => {
    const result = parseMultiThreadObserverOutput(
      `<observations>\n<thread id="t1">\n${giantLine}\n</thread>\n</observations>`,
    );

    expect(result.degenerate).not.toBe(true);
    expect(result.threads.get('t1')?.observations).toContain('[truncated]');
  });

  it('does not flag faithfully-summarized repetitive short tool output as degenerate', () => {
    const result = parseObserverOutput(`<observations>\n${repetitiveToolLines}\n</observations>`);

    expect(result.degenerate).not.toBe(true);
    expect(result.observations).toContain('execute_command pnpm build → ok');
    expect(result.observations).toContain('All build steps succeeded');
  });

  it('still flags a non-consecutive multi-line repetition loop', () => {
    const block = Array.from(
      { length: 5 },
      (_, i) => `- 🟡 Looping observation number ${i} about the same repeated topic`,
    ).join('\n');
    const result = parseObserverOutput(`<observations>\n${Array(20).fill(block).join('\n')}\n</observations>`);

    expect(result.degenerate).toBe(true);
  });

  it('skips the observation cycle instead of throwing when output stays degenerate after retry', async () => {
    const threadId = 'degenerate-thread';
    const loop = 'StreamTextResult.getLanguageModel().doGenerate(options): PromiseLike<Result>, '.repeat(100);
    const text = `<observations>\n${loop}\n</observations>`;
    const usage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
    let calls = 0;
    const model = new MockLanguageModelV2({
      doGenerate: async () => {
        calls++;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage,
          warnings: [],
          content: [{ type: 'text', text }],
        };
      },
      doStream: async () => {
        calls++;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: text },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model, messageTokens: 100, bufferTokens: false },
      reflection: { model, observationTokens: 50_000 },
    });
    const messages: MastraDBMessage[] = Array.from({ length: 8 }, (_, i) => ({
      id: `${threadId}-msg-${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: {
        format: 2,
        parts: [{ type: 'text', text: `Message ${i}: `.padEnd(200, 'x') }],
      } as MastraMessageContentV2,
      type: 'text',
      createdAt: new Date(Date.now() - (8 - i) * 1000),
      threadId,
    }));
    await storage.saveMessages({ messages });

    const result = await om.observe({ threadId });

    expect(calls).toBe(2);
    expect(result.observed).toBe(false);
    expect(result.record.activeObservations ?? '').toBe('');
    expect(result.record.observedMessageIds ?? []).toHaveLength(0);
  });
});

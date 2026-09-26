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
import { detectDegenerateRepetition, parseMultiThreadObserverOutput, parseObserverOutput } from '../observer-agent';
import { parseReflectorOutput } from '../reflector-agent';

beforeEach(() => {
  BufferingCoordinator.asyncBufferingOps.clear();
  BufferingCoordinator.lastBufferedBoundary.clear();
  BufferingCoordinator.lastBufferedAtTime.clear();
  BufferingCoordinator.reflectionBufferCycleIds.clear();
});

// A single legitimately-long line, e.g. a summarized progress bar (reporter saw 72k–237k chars).
const giantLine = `- 🟡 Build output: ${Array.from({ length: 12_000 }, (_, i) => `step${i}`).join(' ')}`;

// Faithful summary of a build thread: many identical short tool results in a row.
const repetitiveToolLines = [
  '- 🔴 User asked to run the build and tests',
  ...Array.from({ length: 200 }, () => '  * -> pnpm build → ok'),
  '- 🟡 All build steps succeeded',
].join('\n');

function textModel(texts: string[] | ((call: number) => string)) {
  let calls = 0;
  const usage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
  const next = () => {
    const text = typeof texts === 'function' ? texts(calls) : texts[Math.min(calls, texts.length - 1)]!;
    calls++;
    return text;
  };
  const model = new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage,
      warnings: [],
      content: [{ type: 'text', text: next() }],
    }),
    doStream: async () => {
      const text = next();
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
  return {
    model,
    get calls() {
      return calls;
    },
  };
}

async function seedMessages(storage: InMemoryMemory, threadId: string, count = 8) {
  const messages: MastraDBMessage[] = Array.from({ length: count }, (_, i) => ({
    id: `${threadId}-msg-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: {
      format: 2,
      parts: [{ type: 'text', text: `Message ${i}: `.padEnd(200, 'x') }],
    } as MastraMessageContentV2,
    type: 'text',
    createdAt: new Date(Date.now() - (count - i) * 1000),
    threadId,
  }));
  await storage.saveMessages({ messages });
  return messages.map(m => m.id);
}

const degenerateLoop = `<observations>\n${'StreamTextResult.getLanguageModel().doGenerate(options): PromiseLike<Result>, '.repeat(100)}\n</observations>`;

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
    const output = `<observations>\n${repetitiveToolLines}\n</observations>`;
    // On main the raw text trips the 200-char window check (the lines are too
    // short for the duplicate-line check), rejecting a faithful summary.
    const result = parseObserverOutput(output);

    expect(result.degenerate).not.toBe(true);
    expect(result.observations).toContain('pnpm build → ok');
    expect(result.observations).toContain('All build steps succeeded');
  });

  // Whether the 200-char window sampler aliases onto the 45-char period of
  // these lines depends on the total length, so sweep a range of run lengths.
  const alternatingRuns = Array.from({ length: 201 }, (_, i) => 100 + i);
  const alternating = (n: number) =>
    Array.from({ length: n }, (_, i) => (i % 2 === 0 ? '  * -> pnpm build → ok' : '  * -> pnpm test → ok')).join('\n');

  it('does not flag alternating short tool-result lines as degenerate', () => {
    const flagged = alternatingRuns.filter(
      n =>
        parseObserverOutput(
          `<observations>\n- 🔴 User asked to build and test repeatedly\n${alternating(n)}\n- 🟡 Every run passed\n</observations>`,
        ).degenerate === true,
    );

    expect(flagged).toEqual([]);
  });

  it('does not flag short repetitive tool lines in reflector output as degenerate', () => {
    const flagged = alternatingRuns.filter(
      n =>
        parseReflectorOutput(`<observations>\n- 🔴 Build and test log\n${alternating(n)}\n</observations>`)
          .degenerate === true,
    );

    expect(flagged).toEqual([]);
  });

  it('does not flag a faithfully-summarized run of long repeated tool lines as degenerate', () => {
    const toolLine = '  * -> pnpm --filter ./packages/memory build → ok';
    expect(toolLine.trim().length).toBeGreaterThanOrEqual(40);
    const flagged = [30, 60, 100, 150].filter(
      n =>
        parseObserverOutput(
          `<observations>\n- 🔴 User asked to rebuild memory until it passes\n${Array(n).fill(toolLine).join('\n')}\n- 🟡 Every build succeeded\n</observations>`,
        ).degenerate === true,
    );

    expect(flagged).toEqual([]);
  });

  it('truncates a giant single line in reflector output instead of flagging it as degenerate', () => {
    const result = parseReflectorOutput(`<observations>\n${giantLine}\n</observations>`);

    expect(result.degenerate).not.toBe(true);
    expect(result.observations).toContain('Build output');
    expect(result.observations).toContain('[truncated]');
    expect(result.observations.length).toBeLessThan(11_000);
  });

  it('still flags a non-consecutive multi-line repetition loop', () => {
    const block = Array.from(
      { length: 5 },
      (_, i) => `- 🟡 Looping observation number ${i} about the same repeated topic`,
    ).join('\n');
    const result = parseObserverOutput(`<observations>\n${Array(20).fill(block).join('\n')}\n</observations>`);

    expect(result.degenerate).toBe(true);
  });

  it('still flags one long line repeated back to back', () => {
    const line = '- 🟡 The agent called the same tool again with identical arguments and got the same result';
    expect(line.length).toBeGreaterThan(80);
    const result = parseObserverOutput(`<observations>\n${Array(300).fill(line).join('\n')}\n</observations>`);

    expect(result.degenerate).toBe(true);
  });

  it("skips the observation cycle under failurePolicy 'continue' when output stays degenerate after retry", async () => {
    const threadId = 'degenerate-thread';
    const observer = textModel([degenerateLoop]);
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: observer.model, messageTokens: 100, bufferTokens: false, failurePolicy: 'continue' },
      reflection: { model: observer.model, observationTokens: 50_000 },
    });
    await seedMessages(storage, threadId);

    const result = await om.observe({ threadId });

    expect(observer.calls).toBe(2);
    expect(result.observed).toBe(false);
    expect(result.record.activeObservations ?? '').toBe('');
    expect(result.record.observedMessageIds ?? []).toHaveLength(0);
  });

  it('reports the skipped degenerate cycle to onObservationEnd as an error', async () => {
    const threadId = 'degenerate-hook-thread';
    const observer = textModel([degenerateLoop]);
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: observer.model, messageTokens: 100, bufferTokens: false, failurePolicy: 'continue' },
      reflection: { model: observer.model, observationTokens: 50_000 },
    });
    await seedMessages(storage, threadId);
    const ends: Array<{ error?: Error }> = [];

    const result = await om.observe({ threadId, hooks: { onObservationEnd: r => void ends.push(r) } });

    expect(result.observed).toBe(false);
    expect(ends).toHaveLength(1);
    expect(ends[0]!.error?.name).toBe('DegenerateObserverOutputError');
  });

  it('observes the same messages on the next cycle after a degenerate skip', async () => {
    const threadId = 'degenerate-then-ok-thread';
    const good = '<observations>\n- 🔴 User sent eight padded test messages\n</observations>';
    const observer = textModel([degenerateLoop, degenerateLoop, good]);
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: observer.model, messageTokens: 100, bufferTokens: false, failurePolicy: 'continue' },
      reflection: { model: observer.model, observationTokens: 50_000 },
    });
    const ids = await seedMessages(storage, threadId);

    const first = await om.observe({ threadId });
    expect(first.observed).toBe(false);
    expect(first.record.observedMessageIds ?? []).toHaveLength(0);

    const second = await om.observe({ threadId });
    expect(observer.calls).toBe(3);
    expect(second.observed).toBe(true);
    expect(second.record.activeObservations).toContain('eight padded test messages');
    expect([...(second.record.observedMessageIds ?? [])].sort()).toEqual([...ids].sort());
  });

  it("does not fail the run under failurePolicy 'continue' when every reflection attempt is degenerate", async () => {
    const threadId = 'degenerate-reflection-thread';
    const facts = Array.from({ length: 40 }, (_, i) => `- 🔴 Distinct fact number ${i} about the project setup`).join(
      '\n',
    );
    const observer = textModel([`<observations>\n${facts}\n</observations>`]);
    const reflector = textModel([degenerateLoop]);
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: observer.model, messageTokens: 100, bufferTokens: false, failurePolicy: 'continue' },
      reflection: {
        model: reflector.model,
        observationTokens: 100,
        bufferActivation: undefined,
        failurePolicy: 'continue',
      },
    });
    await seedMessages(storage, threadId);

    const result = await om.observe({ threadId });

    expect(reflector.calls).toBeGreaterThan(0);
    expect(result.observed).toBe(true);
    expect(result.record.activeObservations).toContain('Distinct fact number 39');
  });

  it("fails the turn under the default failurePolicy 'abort' when observer output stays degenerate", async () => {
    const threadId = 'degenerate-abort-thread';
    const observer = textModel([degenerateLoop]);
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: observer.model, messageTokens: 100, bufferTokens: false },
      reflection: { model: observer.model, observationTokens: 50_000 },
    });
    await seedMessages(storage, threadId);

    await expect(om.observe({ threadId })).rejects.toThrow(/degenerate output after retry/);
    const record = await om.getRecord(threadId);
    expect(record?.observedMessageIds ?? []).toHaveLength(0);
  });

  it("fails the turn under the default failurePolicy 'abort' when every reflection attempt is degenerate", async () => {
    const threadId = 'degenerate-reflection-abort-thread';
    const facts = Array.from({ length: 40 }, (_, i) => `- 🔴 Distinct fact number ${i} about the project setup`).join(
      '\n',
    );
    const observer = textModel([`<observations>\n${facts}\n</observations>`]);
    const reflector = textModel([degenerateLoop]);
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: observer.model, messageTokens: 100, bufferTokens: false },
      reflection: { model: reflector.model, observationTokens: 100, bufferActivation: undefined },
    });
    await seedMessages(storage, threadId);

    await expect(om.observe({ threadId })).rejects.toThrow(/degenerate repetition/);
  });
});

describe('detectDegenerateRepetition short-line loops', () => {
  it('flags a short line repeated past one maximum-size observation line', () => {
    const loop = Array.from({ length: 1000 }, () => '  * -> pnpm build → ok').join('\n');
    expect(detectDegenerateRepetition(loop)).toBe(true);
  });

  it('still accepts a bounded run of the same short line', () => {
    const bounded = ['* Ran the build', ...Array.from({ length: 200 }, () => '  * -> pnpm build → ok')].join('\n');
    expect(detectDegenerateRepetition(bounded)).toBe(false);
  });

  // 588 occurrences of a 16-char line split across two runs (so the bounded-run
  // collapse does not apply): the repeated-line aggregate is 588 * 16 + 587
  // separators = 9,995 characters before padding.
  // Padding one occurrence with leading spaces lands on the exact boundary.
  const splitRuns = (pad: number) => {
    const line = '* built pkg ok #';
    const first = Array.from({ length: 294 }, () => line);
    const second = Array.from({ length: 294 }, () => line);
    first[0] = ' '.repeat(pad) + line;
    return [...first, 'Ran a separate step here', ...second].join('\n');
  };

  it('accepts a short line whose occurrences total exactly one maximum-size observation line', () => {
    expect(detectDegenerateRepetition(splitRuns(5))).toBe(false);
  });

  it('flags a short line whose occurrences total one character more', () => {
    expect(detectDegenerateRepetition(splitRuns(6))).toBe(true);
  });
});

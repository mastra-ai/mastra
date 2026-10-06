/**
 * Regression tests for https://github.com/mastra-ai/mastra/issues/24354:
 * the Observer's degenerate-output detector must not reject faithful summaries
 * of long or repetitive tool output while still rejecting genuine loops.
 */
import { describe, it, expect } from 'vitest';
import {
  describeDegenerateOutput,
  detectDegenerateRepetition,
  parseMultiThreadObserverOutput,
  parseObserverOutput,
} from '../observer-agent';
import { parseReflectorOutput } from '../reflector-agent';

// A single legitimately-long line, e.g. a summarized progress bar (reporter saw 72k–237k chars).
const giantLine = `- 🟡 Build output: ${Array.from({ length: 12_000 }, (_, i) => `step${i}`).join(' ')}`;

// Faithful summary of a build thread: many identical short tool results in a row.
const repetitiveToolLines = [
  '- 🔴 User asked to run the build and tests',
  ...Array.from({ length: 200 }, () => '  * -> pnpm build → ok'),
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

});

describe('detectDegenerateRepetition short-line loops', () => {
  it('flags a short line repeated past one maximum-size observation line', () => {
    const loop = Array.from({ length: 1000 }, () => '  * -> pnpm build → ok').join('\n');
    expect(detectDegenerateRepetition(loop)).toBe(true);
    expect(describeDegenerateOutput(loop)).toContain('shortLineLoop');
  });

  it('does not treat one heavily padded short line as a loop', () => {
    const padded = 'ok' + ' '.repeat(10_050);
    expect(detectDegenerateRepetition(padded)).toBe(false);
    expect(describeDegenerateOutput(padded)).not.toContain('shortLineLoop');
  });

  it('names no strategy for output below the detector minimum length', () => {
    // Two runs, so the bounded-run collapse leaves every occurrence in place.
    const run = Array.from({ length: 10 }, () => 'a substantial repeated observation line');
    const short = [...run, 'a different substantial observation line', ...run].join('\n');
    expect(short.length).toBeLessThan(2000);
    expect(detectDegenerateRepetition(short)).toBe(false);
    expect(describeDegenerateOutput(short)).toContain('strategy=none');
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

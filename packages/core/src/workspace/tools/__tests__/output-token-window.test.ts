import { estimateTokenCount, sliceByTokens } from 'tokenx';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ToolExecutionContext } from '../../../tools/types';
import { Workspace } from '../../workspace';
import { executeCommandTool } from '../execute-command';
import { applyTokenLimit, applyTokenLimitSandwich, truncateOutput } from '../output-helpers';

// Records the length of every string handed to tokenx, so a test can prove the
// exact (slow) estimator never walks the whole of a huge output (#30951).
// `cap` turns a synchronous runaway loop into a thrown error instead of a hung test.
const scanned = vi.hoisted(() => ({ lengths: [] as number[], cap: Infinity }));
const record = (length: number) => {
  scanned.lengths.push(length);
  if (scanned.lengths.length > scanned.cap) throw new Error(`tokenx called more than ${scanned.cap} times`);
};
vi.mock('tokenx', async importOriginal => {
  const actual = await importOriginal<typeof import('tokenx')>();
  return {
    ...actual,
    estimateTokenCount: (text: string, ...rest: unknown[]) => {
      record(text?.length ?? 0);
      return (actual.estimateTokenCount as (...args: unknown[]) => number)(text, ...rest);
    },
    sliceByTokens: (text: string, ...rest: unknown[]) => {
      record(text?.length ?? 0);
      return (actual.sliceByTokens as (...args: unknown[]) => string)(text, ...rest);
    },
  };
});

afterEach(() => {
  scanned.lengths = [];
  scanned.cap = Infinity;
});

const LIMIT = 2_000;
const MB = 1_000_000;

/** Output shaped like `grep -rn` hitting source maps: a few lines, each several MB of VLQ text. */
function sourceMapGrepOutput(bytes: number): string {
  const vlq = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let seed = 1;
  const rnd = (n: number) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
  const lines: string[] = [];
  for (let i = 0; i < 10; i++) {
    const parts: string[] = [`packages/core/dist/chunk-${i}.js.map:1:{"mappings":"`];
    let size = 0;
    while (size < bytes / 10) {
      let word = '';
      for (let j = 0, n = 2 + rnd(5); j < n; j++) word += vlq[rnd(64)];
      word += rnd(8) === 0 ? ';' : ',';
      parts.push(word);
      size += word.length;
    }
    lines.push(parts.join('') + '"}');
  }
  return lines.join('\n') + '\n';
}

/** Many short log lines, ending in a recognisable last line. */
function logOutput(bytes: number): string {
  const lines: string[] = [];
  let size = 0;
  for (let i = 0; size < bytes; i++) {
    const line = `2026-11-19T10:00:00.000Z INFO request ${i} handled in ${i % 97} ms path=/api/items/${i}`;
    lines.push(line);
    size += line.length + 1;
  }
  lines.push('LAST LINE OF OUTPUT');
  return lines.join('\n');
}

const maxScanned = () => Math.max(0, ...scanned.lengths);

describe('token limits on huge output (#30951)', () => {
  const big = sourceMapGrepOutput(8 * MB);

  it('applyTokenLimit never runs the exact estimator over the whole output', async () => {
    const result = await applyTokenLimit(big, LIMIT, 'start');
    expect(maxScanned()).toBeLessThan(MB);
    expect(result.startsWith('[output truncated: showing last ~2000 of ~')).toBe(true);
  });

  it('applyTokenLimit keeping the start never scans the whole output', async () => {
    const result = await applyTokenLimit(big, LIMIT, 'end');
    expect(maxScanned()).toBeLessThan(MB);
    expect(result.startsWith('packages/core/dist/chunk-0.js.map:1:')).toBe(true);
  });

  it('sandwich truncation never scans the whole output', async () => {
    const result = await applyTokenLimitSandwich(big, LIMIT);
    expect(maxScanned()).toBeLessThan(MB);
    expect(result).toContain('[...output truncated');
  });

  it('truncateOutput (execute_command path) stays within a small time budget', async () => {
    // On main this takes several seconds; the bound leaves wide headroom for slow CI machines.
    const started = performance.now();
    await truncateOutput(big, 200, LIMIT, 'sandwich');
    await truncateOutput(big, 200, LIMIT, 'start');
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it.each(['start', 'end'] as const)('the kept piece still fits the limit by the real count (from=%s)', async from => {
    for (const output of [big, logOutput(3 * MB)]) {
      const result = await applyTokenLimit(output, LIMIT, from);
      const kept =
        from === 'start' ? result.slice(result.indexOf('\n') + 1) : result.slice(0, result.lastIndexOf('\n'));
      const tokens = estimateTokenCount(kept);
      expect(tokens).toBeLessThanOrEqual(LIMIT);
      expect(tokens).toBeGreaterThan(LIMIT * 0.9);
      if (from === 'start') expect(output.endsWith(kept)).toBe(true);
      else expect(output.startsWith(kept)).toBe(true);
    }
  });

  it('sandwich head and tail still fit the limit by the real count', async () => {
    const output = logOutput(3 * MB);
    const result = await applyTokenLimitSandwich(output, LIMIT);
    const [head, notice, tail] = result.split(/\n(\[\.\.\.output truncated[^\n]*)\n/);
    expect(notice).toMatch(
      /showing first ~200 tokens \(lines 1-\d+\) \+ last ~1800 tokens \(lines \d+-\d+\) of ~\d+ tokens/,
    );
    expect(output.startsWith(head!)).toBe(true);
    expect(output.endsWith(tail!)).toBe(true);
    expect(tail!.endsWith('LAST LINE OF OUTPUT')).toBe(true);
    expect(estimateTokenCount(head!) + estimateTokenCount(tail!)).toBeLessThanOrEqual(LIMIT);
  });

  it('reports a total close to the exact count', async () => {
    const output = logOutput(2 * MB);
    const exact = estimateTokenCount(output);
    scanned.lengths = [];
    const result = await applyTokenLimit(output, LIMIT, 'start');
    const total = Number(/of ~(\d+) tokens/.exec(result)![1]);
    expect(total).toBeGreaterThan(exact * 0.75);
    expect(total).toBeLessThan(exact * 1.25);
  });

  it('a huge output that is mostly whitespace and fits the limit is returned whole', async () => {
    const output = 'start ' + ' '.repeat(2 * MB) + ' end';
    expect(await applyTokenLimit(output, LIMIT, 'start')).toBe(output);
  });

  it.each([
    ['no-break spaces', '\u00a0'],
    ['ideographic spaces', '\u3000'],
    ['em spaces and line separators', '\u2003\u2028'],
  ])('under-budget output padded with Unicode whitespace (%s) is returned whole', async (_label, pad) => {
    const output = pad.repeat(65_000) + 'hello';
    expect(estimateTokenCount(output)).toBeLessThanOrEqual(LIMIT);
    expect(await applyTokenLimit(output, LIMIT, 'start')).toBe(output);
    expect(await applyTokenLimitSandwich(output, LIMIT)).toBe(output);
  });

  it('a long sparse output that fits is confirmed without handing tokenx the whole string', async () => {
    const output = ('word' + ' '.repeat(1_000) + '\n  ').repeat(900);
    const exact = estimateTokenCount(output);
    expect(exact).toBeLessThanOrEqual(LIMIT);
    scanned.lengths = [];
    expect(await applyTokenLimit(output, LIMIT, 'start')).toBe(output);
    expect(maxScanned()).toBeLessThanOrEqual(LIMIT * 32);
  });

  it('dense astral-plane text that tokenx counts cheaply but still fits is returned whole', async () => {
    // tokenx counts this one segment as ceil(code points / 4) tokens: ~8 UTF-16 chars per token.
    const output = ' '.repeat(50_000) + 'ж' + '𝐀'.repeat(7_000);
    expect(estimateTokenCount(output)).toBeLessThanOrEqual(LIMIT);
    expect(await applyTokenLimit(output, LIMIT, 'start')).toBe(output);
  });

  it('a long sparse output just over the limit reports the exact total', async () => {
    // Each repeat is 2 tokens: the word, plus the newline-and-indent whitespace run.
    const output = ('word' + ' '.repeat(1_000) + '\n  ').repeat(1_100);
    const exact = estimateTokenCount(output);
    expect(exact).toBeGreaterThan(LIMIT);
    scanned.lengths = [];
    const result = await applyTokenLimit(output, LIMIT, 'start');
    expect(maxScanned()).toBeLessThanOrEqual(LIMIT * 32);
    expect(result.startsWith(`[output truncated: showing last ~${LIMIT} of ~${exact} tokens]`)).toBe(true);
  });

  it('output within the size cap is cut exactly as before', async () => {
    const output = logOutput(60_000);
    expect(output.length).toBeLessThanOrEqual(LIMIT * 32);
    const result = await applyTokenLimitSandwich(output, LIMIT);
    const [head, , tail] = result.split(/\n(\[\.\.\.output truncated[^\n]*)\n/);
    expect(sliceByTokens(output, 0, 200).startsWith(head!)).toBe(true);
    expect(sliceByTokens(output, -1_800).endsWith(tail!)).toBe(true);
    expect(sliceByTokens(output, -1_800).length - tail!.length).toBeLessThanOrEqual(2);
    expect(await applyTokenLimit(output, LIMIT, 'start')).toBe(
      `[output truncated: showing last ~${LIMIT} of ~${estimateTokenCount(output)} tokens]\n${sliceByTokens(output, -LIMIT)}`,
    );
  });

  it.each([
    ['one unbroken word', 'x'.repeat(5 * MB)],
    ['CJK text', '漢字かなカナ'.repeat(MB / 2)],
    ['tokens spread thinly through whitespace', ('word' + ' '.repeat(1_000)).repeat(5_000)],
    ['minified code', 'function a(b,c){return b+c};var d=a(1,2);'.repeat(MB / 10)],
  ])('%s: bounded scan, kept piece fits the limit', async (_label, output) => {
    for (const from of ['start', 'end'] as const) {
      scanned.lengths = [];
      const result = await applyTokenLimit(output, LIMIT, from);
      expect(maxScanned()).toBeLessThanOrEqual(LIMIT * 32);
      const kept =
        from === 'start' ? result.slice(result.indexOf('\n') + 1) : result.slice(0, result.lastIndexOf('\n'));
      expect(estimateTokenCount(kept)).toBeLessThanOrEqual(LIMIT);
      expect(result).toMatch(/\[output truncated: showing (last|first) ~2000 of ~\d+ tokens\]/);
    }
    scanned.lengths = [];
    await applyTokenLimitSandwich(output, LIMIT);
    expect(maxScanned()).toBeLessThanOrEqual(LIMIT * 32);
  });

  it('a negative limit returns instead of looping (maxOutputTokens is not validated)', async () => {
    scanned.cap = 1_000;
    for (const from of ['start', 'end'] as const) {
      expect(typeof (await applyTokenLimit('x'.repeat(1_000), -1, from))).toBe('string');
    }
    expect(typeof (await applyTokenLimitSandwich('x'.repeat(1_000), -1))).toBe('string');
  });

  it('a window ending inside a long mixed-language segment still keeps head and tail within the budget', async () => {
    // tokenx counts a segment by its whole length, so cutting the window inside one can
    // move the cut away from whole-output slicing; the kept text must still fit.
    const segment = 'a'.repeat(65_000) + 'é' + 'ж漢字'.repeat(20_000) + 'b'.repeat(65_000);
    for (const output of [segment, 'é' + 'a'.repeat(65_000), 'a'.repeat(65_000) + 'é', `log ${segment} done`]) {
      const tail = await applyTokenLimit(output, LIMIT, 'start');
      const keptTail = tail.slice(tail.indexOf('\n') + 1);
      expect(output.endsWith(keptTail)).toBe(true);
      expect(keptTail.length).toBeGreaterThan(0);
      expect(estimateTokenCount(keptTail)).toBeLessThanOrEqual(LIMIT);

      const head = await applyTokenLimit(output, LIMIT, 'end');
      const keptHead = head.slice(0, head.lastIndexOf('\n'));
      expect(output.startsWith(keptHead)).toBe(true);
      expect(keptHead.length).toBeGreaterThan(0);
      expect(estimateTokenCount(keptHead)).toBeLessThanOrEqual(LIMIT);

      const sandwich = await applyTokenLimitSandwich(output, LIMIT);
      const [sHead, , sTail] = sandwich.split(/\n(\[\.\.\.output truncated[^\n]*)\n/);
      expect(output.startsWith(sHead!)).toBe(true);
      expect(output.endsWith(sTail!)).toBe(true);
      expect(estimateTokenCount(sHead!) + estimateTokenCount(sTail!)).toBeLessThanOrEqual(LIMIT);
    }
  });

  it('a cut through a segment whose language changes when trimmed is recounted to fit the budget', async () => {
    // With ж in the segment tokenx counts it as Russian (4 chars/token) and keeps 8,000 漢;
    // without ж the kept text counts as CJK, 1 token per char.
    // Outputs within the size cap keep tokenx's own cut, exactly as before; these are past it.
    const cases = [
      { output: '漢'.repeat(30_000) + 'ж' + '漢'.repeat(35_000), side: 'end' as const },
      { output: '漢'.repeat(35_000) + 'ж' + '漢'.repeat(30_000), side: 'start' as const },
      { output: 'x '.repeat(10_000) + '漢'.repeat(5_000) + 'ж' + '漢'.repeat(40_000), side: 'start' as const },
      { output: '漢'.repeat(40_000) + 'ж' + '漢'.repeat(5_000) + ' x'.repeat(10_000), side: 'end' as const },
    ];
    for (const { output, side } of cases) {
      const result = await applyTokenLimit(output, LIMIT, side);
      const kept =
        side === 'start' ? result.slice(result.indexOf('\n') + 1) : result.slice(0, result.lastIndexOf('\n'));
      expect(side === 'start' ? output.endsWith(kept) : output.startsWith(kept)).toBe(true);
      expect(kept.length).toBeGreaterThan(0);
      expect(estimateTokenCount(kept)).toBeLessThanOrEqual(LIMIT);
    }
    const output = cases[0]!.output;
    const sandwich = await applyTokenLimitSandwich(output, LIMIT);
    const [head, , tail] = sandwich.split(/\n(\[\.\.\.output truncated[^\n]*)\n/);
    expect(output.startsWith(head!)).toBe(true);
    expect(output.endsWith(tail!)).toBe(true);
    expect(estimateTokenCount(head!) + estimateTokenCount(tail!)).toBeLessThanOrEqual(LIMIT);
  });

  it('cuts match tokenx slicing the whole output when segments are short, across mixed text and whitespace', async () => {
    let seed = 7;
    const rnd = (n: number) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
    const pieces = ['error', 'at', 'src/index.ts:42:7', '{"a":1}', '12345', '...', '漢字', '𝐀𝐁', 'ж'];
    const gaps = [' ', '\n', '\n    ', '\t', '\u00a0', '\u3000', ' '.repeat(3_000), '\n' + ' '.repeat(5_000)];
    for (let round = 0; round < 12; round++) {
      const parts: string[] = [];
      let size = 0;
      while (size < 300_000) {
        const part = pieces[rnd(pieces.length)]! + gaps[rnd(gaps.length)]!;
        parts.push(part);
        size += part.length;
      }
      const output = parts.join('');
      const result = await applyTokenLimit(output, LIMIT, 'start');
      expect(result.slice(result.indexOf('\n') + 1)).toBe(
        sliceByTokens(output, -LIMIT).replace(/[\uD800-\uDFFF]/gu, '\uFFFD'),
      );
      const head = await applyTokenLimit(output, LIMIT, 'end');
      expect(head.slice(0, head.lastIndexOf('\n'))).toBe(
        sliceByTokens(output, 0, LIMIT).replace(/[\uD800-\uDFFF]/gu, '\uFFFD'),
      );
    }
  });

  it('execute_command keeps the final diagnostic behind trailing whitespace padding', async () => {
    const stdout = 'x '.repeat(2_500) + '\nBUILD FAILED' + ' '.repeat(65_000);
    const workspace = new Workspace({
      sandbox: {
        id: 'remote-like',
        name: 'remote-like',
        provider: 'remote-like',
        status: 'running' as const,
        executeCommand: async () => ({ success: false, exitCode: 1, stdout, stderr: '', executionTimeMs: 1 }),
      },
    });
    const context = { workspace, writer: { custom: vi.fn() } } as unknown as ToolExecutionContext;
    scanned.lengths = [];
    const result = String(
      await executeCommandTool.execute!({ command: 'make', args: [], timeout: null, cwd: null }, context),
    );
    expect(result).toContain('BUILD FAILED');
    expect(result).toContain('[...output truncated');
    expect(maxScanned()).toBeLessThanOrEqual(LIMIT * 32);
  });

  it.each(['start', 'end'] as const)(
    'whitespace padding at the kept end does not crowd out the text behind it (from=%s)',
    async from => {
      const padding = ' '.repeat(200_000);
      const output =
        from === 'start' ? 'x '.repeat(5_000) + 'FINAL ERROR' + padding : padding + 'FIRST ERROR ' + 'x '.repeat(5_000);
      scanned.lengths = [];
      const result = await applyTokenLimit(output, LIMIT, from);
      expect(maxScanned()).toBeLessThanOrEqual(LIMIT * 32);
      const kept =
        from === 'start' ? result.slice(result.indexOf('\n') + 1) : result.slice(0, result.lastIndexOf('\n'));
      expect(kept).toContain(from === 'start' ? 'FINAL ERROR' : 'FIRST ERROR');
      if (from === 'start') expect(output.endsWith(kept)).toBe(true);
      else expect(output.startsWith(kept)).toBe(true);
      // The cut through the dense text matches tokenx slicing the whole output.
      expect(kept).toBe(from === 'start' ? sliceByTokens(output, -LIMIT) : sliceByTokens(output, 0, LIMIT));
    },
  );

  it('execute_command with a remote sandbox returning huge stdout does not stall the event loop', async () => {
    const stdout = sourceMapGrepOutput(8 * MB);
    const workspace = new Workspace({
      sandbox: {
        id: 'remote-like',
        name: 'remote-like',
        provider: 'remote-like',
        status: 'running' as const,
        // Remote providers return the full stdout of a finished command.
        executeCommand: async () => ({ success: true, exitCode: 0, stdout, stderr: '', executionTimeMs: 1 }),
      },
    });
    const context = { workspace, writer: { custom: vi.fn() } } as unknown as ToolExecutionContext;

    let last = performance.now();
    let worst = 0;
    const heartbeat = setInterval(() => {
      const now = performance.now();
      worst = Math.max(worst, now - last);
      last = now;
    }, 5);
    try {
      await new Promise(resolve => setTimeout(resolve, 20));
      last = performance.now();
      worst = 0;
      const result = await executeCommandTool.execute!(
        { command: 'grep', args: [], timeout: null, cwd: null },
        context,
      );
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(String(result)).toContain('[...output truncated');
      expect(String(result).length).toBeLessThan(20_000);
    } finally {
      clearInterval(heartbeat);
    }
    // On main this stalls for seconds; the bound leaves headroom for slow CI machines.
    expect(worst).toBeLessThan(500);
    expect(maxScanned()).toBeLessThan(MB);
  });
});

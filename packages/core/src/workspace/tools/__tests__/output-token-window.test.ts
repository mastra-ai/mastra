import { estimateTokenCount } from 'tokenx';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ToolExecutionContext } from '../../../tools/types';
import { Workspace } from '../../workspace';
import { executeCommandTool } from '../execute-command';
import { applyTokenLimit, applyTokenLimitSandwich, truncateOutput } from '../output-helpers';

// Records the length of every string handed to tokenx, so a test can prove the
// exact (slow) estimator never walks the whole of a huge output (#30951).
const scanned = vi.hoisted(() => ({ lengths: [] as number[] }));
vi.mock('tokenx', async importOriginal => {
  const actual = await importOriginal<typeof import('tokenx')>();
  return {
    ...actual,
    estimateTokenCount: (text: string, ...rest: unknown[]) => {
      scanned.lengths.push(text?.length ?? 0);
      return (actual.estimateTokenCount as (...args: unknown[]) => number)(text, ...rest);
    },
    sliceByTokens: (text: string, ...rest: unknown[]) => {
      scanned.lengths.push(text?.length ?? 0);
      return (actual.sliceByTokens as (...args: unknown[]) => string)(text, ...rest);
    },
  };
});

afterEach(() => {
  scanned.lengths = [];
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
    ['one unbroken word', 'x'.repeat(5 * MB), 0],
    // tokenx rounds up when a slice cuts one long CJK segment: slicing the whole output on main recounts 2001 too.
    ['CJK text', '漢字かなカナ'.repeat(MB / 2), 1],
    ['tokens spread thinly through whitespace', ('word' + ' '.repeat(1_000)).repeat(5_000), 0],
    ['minified code', 'function a(b,c){return b+c};var d=a(1,2);'.repeat(MB / 10), 0],
  ])('%s: bounded scan, kept piece fits the limit', async (_label, output, rounding) => {
    for (const from of ['start', 'end'] as const) {
      scanned.lengths = [];
      const result = await applyTokenLimit(output, LIMIT, from);
      expect(maxScanned()).toBeLessThanOrEqual(LIMIT * 32);
      const kept =
        from === 'start' ? result.slice(result.indexOf('\n') + 1) : result.slice(0, result.lastIndexOf('\n'));
      expect(estimateTokenCount(kept)).toBeLessThanOrEqual(LIMIT + rounding);
      expect(result).toMatch(/\[output truncated: showing (last|first) ~2000 of ~\d+ tokens\]/);
    }
    scanned.lengths = [];
    await applyTokenLimitSandwich(output, LIMIT);
    expect(maxScanned()).toBeLessThanOrEqual(LIMIT * 32);
  });

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

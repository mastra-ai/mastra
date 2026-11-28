import { describe, expect, it } from 'vitest';
import { createCodeModeLogCollector } from './log-collector';
import type { CodeModeLogCollectorOptions } from './log-collector';

/** The deterministic marker appended once when capture overflows. */
const MARKER = '[code mode logs truncated]';

function collect(lines: string[], options: CodeModeLogCollectorOptions = {}): string[] {
  const collector = createCodeModeLogCollector(options);
  for (const line of lines) collector.push(line);
  return collector.logs();
}

describe('createCodeModeLogCollector — line cap', () => {
  it.each<[string, string[], CodeModeLogCollectorOptions, string[]]>([
    ['keeps every line when unlimited', ['a', 'b', 'c'], {}, ['a', 'b', 'c']],
    ['an exact fit adds no marker', ['a', 'b'], { maxLogLines: 2 }, ['a', 'b']],
    ['overflow keeps the prefix and appends one marker', ['a', 'b', 'c', 'd'], { maxLogLines: 3 }, ['a', 'b', MARKER]],
    ['a one-line cap keeps only the marker', ['a', 'b'], { maxLogLines: 1 }, [MARKER]],
    ['a zero-line cap captures nothing', ['a', 'b'], { maxLogLines: 0 }, []],
  ])('%s', (_name, lines, options, expected) => {
    expect(collect(lines, options)).toEqual(expected);
  });
});

describe('createCodeModeLogCollector — byte cap', () => {
  it.each<[string, string[], CodeModeLogCollectorOptions, string[]]>([
    ['keeps lines whose UTF-8 bytes fit', ['a'.repeat(20)], { maxLogBytes: 30 }, ['a'.repeat(20)]],
    // A 20-character line is 20 bytes of ASCII but 40 bytes of `é`, so this only
    // overflows if bytes — not characters — are measured.
    ['measures UTF-8 bytes, not characters', ['é'.repeat(20)], { maxLogBytes: 30 }, [MARKER]],
    ['counts surrogate pairs as their UTF-8 byte length', ['😀'.repeat(10)], { maxLogBytes: 30 }, [MARKER]],
    [
      'the marker itself counts toward the cap',
      ['a'.repeat(10), 'a'.repeat(10), 'a'.repeat(10), 'a'.repeat(10), 'a'.repeat(10)],
      { maxLogBytes: 40 },
      ['a'.repeat(10), MARKER],
    ],
    // An empty line has no bytes of its own; charging at least one byte keeps a
    // finite byte cap bounding the line count too. Cap 30 leaves room for the
    // 26-byte marker plus four one-byte lines.
    [
      'charges at least one byte per empty line',
      Array.from({ length: 100 }, () => ''),
      { maxLogBytes: 30 },
      ['', '', '', '', MARKER],
    ],
    ['a zero-byte cap cannot retain even an empty line', [''], { maxLogBytes: 0 }, []],
  ])('%s', (_name, lines, options, expected) => {
    expect(collect(lines, options)).toEqual(expected);
  });

  it('omits the marker when it cannot fit within maxLogBytes', () => {
    const collector = createCodeModeLogCollector({ maxLogBytes: 20 });
    collector.push('a'.repeat(15));
    collector.push('b');
    collector.push('c'.repeat(10));
    expect(collector.logs()).toEqual([]);
  });
});

describe('createCodeModeLogCollector — lifecycle', () => {
  it('ignores lines pushed after overflow', () => {
    const collector = createCodeModeLogCollector({ maxLogLines: 2 });
    collector.push('a');
    collector.push('b');
    collector.push('c');
    collector.push('d');
    expect(collector.logs()).toEqual(['a', MARKER]);
  });

  it('is idempotent and returns a fresh array each call', () => {
    const collector = createCodeModeLogCollector({ maxLogLines: 2 });
    collector.push('a');
    collector.push('b');
    collector.push('c');

    const first = collector.logs();
    expect(collector.logs()).toEqual(first);

    first.push('mutated');
    expect(collector.logs()).toEqual(['a', MARKER]);
  });

  it('returns the captured lines without the marker when nothing overflowed', () => {
    const collector = createCodeModeLogCollector();
    collector.push('only line');
    expect(collector.logs()).toEqual(['only line']);
  });
});

describe('createCodeModeLogCollector — scale', () => {
  // Guest code controls how many lines it logs. Once the cap trips, further
  // pushes must short-circuit: an unbounded console.log loop can't keep doing
  // per-line work (or hold the captured lines) for the life of the run.
  it('stays bounded and fast past the cap for a very chatty program', { timeout: 10_000 }, () => {
    const collector = createCodeModeLogCollector({ maxLogLines: 5 });
    const started = performance.now();
    for (let i = 0; i < 200_000; i += 1) collector.push(`line ${i} ${'x'.repeat(200)}`);
    const elapsed = performance.now() - started;

    expect(collector.logs()).toEqual([
      'line 0 ' + 'x'.repeat(200),
      'line 1 ' + 'x'.repeat(200),
      'line 2 ' + 'x'.repeat(200),
      'line 3 ' + 'x'.repeat(200),
      MARKER,
    ]);
    expect(elapsed).toBeLessThan(2_000);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createDeployLogWriter,
  sanitizeLogLine,
  splitLogEntries,
  advanceSgrState,
  isErrorLogLine,
  selectFailureExcerpt,
  DeployLogRowRenderer,
  sgrOpenSequence,
  formatDeployLogLine,
  formatLogTimestamp,
  parseDeployLogLine,
  stripAnsi,
  truncateToWidth,
  TIMESTAMP_COLUMN_WIDTH,
} from './deploy-log-format.js';

const ISO = '2026-03-20T12:00:01.250Z';
const localTime = formatLogTimestamp(new Date(ISO));

function fakeStream(overrides: { isTTY?: boolean; columns?: number } = {}) {
  const chunks: string[] = [];
  return {
    chunks,
    stream: {
      isTTY: overrides.isTTY ?? true,
      columns: overrides.columns ?? 200,
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    },
  };
}

describe('parseDeployLogLine', () => {
  it('extracts the platform ISO timestamp prefix', () => {
    const parsed = parseDeployLogLine(`[${ISO}] Downloading artifact...`);
    expect(parsed.timestamp?.toISOString()).toBe(ISO);
    expect(parsed.labels).toEqual([]);
    expect(parsed.message).toBe('Downloading artifact...');
  });

  it('extracts bracketed level labels after the timestamp', () => {
    const parsed = parseDeployLogLine(`[${ISO}] [info] Starting Container`);
    expect(parsed.timestamp?.toISOString()).toBe(ISO);
    expect(parsed.labels).toEqual(['info']);
    expect(parsed.message).toBe('Starting Container');
  });

  it('keeps several labels in order and leaves an ISO-shaped label alone', () => {
    const parsed = parseDeployLogLine('[stderr] [warn] [2026-03-20T12:00:00.000Z] tail');
    expect(parsed.labels).toEqual(['stderr', 'warn']);
    expect(parsed.message).toBe('[2026-03-20T12:00:00.000Z] tail');
  });

  it('folds pino-pretty application prefixes into timestamp and level', () => {
    const parsed = parseDeployLogLine('\x1b[32mINFO\x1b[39m [2026-03-20 12:00:01.250 Z] Mastra API running');
    expect(parsed.timestamp?.toISOString()).toBe(ISO);
    expect(parsed.labels).toEqual(['info']);
    expect(parsed.message).toBe('Mastra API running');
  });

  it('does not duplicate a level already given as a bracket label', () => {
    const parsed = parseDeployLogLine(`[${ISO}] [info] INFO [2026-03-20 12:00:01 +00:00] hello`);
    expect(parsed.labels).toEqual(['info']);
    expect(parsed.message).toBe('hello');
  });

  it('passes untagged lines through untouched', () => {
    const parsed = parseDeployLogLine('#5 [2/4] COPY .mastra/output .mastra/output');
    expect(parsed.timestamp).toBeUndefined();
    expect(parsed.labels).toEqual([]);
    expect(parsed.message).toBe('#5 [2/4] COPY .mastra/output .mastra/output');
  });

  it('ignores a bracketed prefix that is not a valid date', () => {
    const parsed = parseDeployLogLine('[2026-13-99T99:99:99Z] nonsense');
    expect(parsed.timestamp).toBeUndefined();
    expect(parsed.message).toBe('[2026-13-99T99:99:99Z] nonsense');
  });
});

describe('formatDeployLogLine', () => {
  it('renders a short local timestamp, the level without brackets, then the message', () => {
    const plain = stripAnsi(formatDeployLogLine(`[${ISO}] [info] Starting Container`));
    expect(plain).toBe(`${localTime} info  Starting Container`);
  });

  it('pads short levels so messages align', () => {
    const warn = stripAnsi(formatDeployLogLine(`[${ISO}] [warn] slow`));
    const error = stripAnsi(formatDeployLogLine(`[${ISO}] [error] boom`));
    expect(warn).toBe(`${localTime} warn  slow`);
    expect(error).toBe(`${localTime} error boom`);
  });

  it('indents lines without a timestamp past the timestamp column by default', () => {
    const plain = formatDeployLogLine('#5 DONE 0.1s');
    expect(plain).toBe(`${' '.repeat(TIMESTAMP_COLUMN_WIDTH)} #5 DONE 0.1s`);
  });

  it('closes a line whose ANSI styling was never reset', () => {
    const line = formatDeployLogLine('\x1b[31mred forever');
    expect(line.endsWith('\x1b[0m')).toBe(true);
    expect(stripAnsi(line)).toBe(`${' '.repeat(TIMESTAMP_COLUMN_WIDTH)} red forever`);
  });
});

describe('sanitizeLogLine', () => {
  it('expands tabs, drops cursor-moving escapes and control characters, keeps colours', () => {
    expect(sanitizeLogLine('a\tb')).toBe('a    b');
    expect(sanitizeLogLine('\x1b[2K\x1b[1Gprogress \x1b[32mok\x1b[0m\x07')).toBe('progress \x1b[32mok\x1b[0m');
  });

  it('keeps every SGR form the formatter understands', () => {
    const styled = '\x1b[1;38;5;208mx\x1b[38;2;1;2;3my\x1b[m';
    expect(sanitizeLogLine(styled)).toBe(styled);
  });

  it('removes OSC sequences that set the title, hyperlinks or the clipboard', () => {
    expect(sanitizeLogLine('a\x1b]0;pwned\x07b')).toBe('ab');
    expect(sanitizeLogLine('a\x1b]8;;http://evil\x1b\\link\x1b]8;;\x1b\\b')).toBe('alinkb');
    expect(sanitizeLogLine('a\x1b]52;c;cHduZWQ=\x07b')).toBe('ab');
    // Unterminated: the rest of the line belongs to the sequence.
    expect(sanitizeLogLine('a\x1b]0;no terminator')).toBe('a');
  });

  it('removes DCS, SOS, PM and APC strings', () => {
    expect(sanitizeLogLine('a\x1bPq#0;2;0;0;0\x1b\\b')).toBe('ab');
    expect(sanitizeLogLine('a\x1bXsos\x1b\\b\x1b^pm\x07c\x1b_apc\x1b\\d')).toBe('abcd');
  });

  it('removes CSI sequences with private parameters, intermediates or unusual final bytes', () => {
    expect(sanitizeLogLine('\x1b[?25l\x1b[?1049hhidden\x1b[?25h')).toBe('hidden');
    expect(sanitizeLogLine('a\x1b[2 qb\x1b[3~c\x1b[@d\x1b[>0;1{e')).toBe('abcde');
  });

  it('removes bare and two-byte escape sequences and 8-bit C1 controls', () => {
    expect(sanitizeLogLine('a\x1bcb\x1b(Bc\x1b7d\x1b8e\x1b#8f\x1b')).toBe('abcdef');
    expect(sanitizeLogLine('a\u009b2Jb\u009d0;t\u0007c\u0085d')).toBe('abcd');
  });

  it('leaves no escape byte behind except in SGR sequences', () => {
    const hostile = '\x1b]0;t\x07\x1b[31mred\x1b[0m\x1bc\x1b[?25l\x1bPx\x1b\\\x1b_y\x1b\\\u009b1m';
    const clean = sanitizeLogLine(hostile);
    // The 8-bit CSI at the end is a plain bold SGR once normalised, so it stays.
    expect(clean).toBe('\x1b[31mred\x1b[0m\x1b[1m');
    expect(clean.replace(/\x1b\[[0-9;]*m/g, '')).not.toContain('\x1b');
  });
});

describe('splitLogEntries', () => {
  it('splits entries on embedded line breaks, keeping interior blanks and dropping a trailing one', () => {
    expect(splitLogEntries(['one', 'two\nthree\r\n', '\n====\nBanner\n\n====\n'])).toEqual([
      'one',
      'two',
      'three',
      '',
      '====',
      'Banner',
      '',
      '====',
    ]);
  });

  it('keeps an entry that is blank on its own', () => {
    expect(splitLogEntries(['', 'x'])).toEqual(['', 'x']);
  });
});

describe('DeployLogRowRenderer', () => {
  const messageColumn = TIMESTAMP_COLUMN_WIDTH + 1 + 5 + 1;
  const renderAll = (entries: string[]) => {
    const renderer = new DeployLogRowRenderer();
    return entries.flatMap(entry => renderer.render(entry)).map(stripAnsi);
  };

  it('indents a continuation row to the previous entry message column', () => {
    expect(renderAll([`[${ISO}] [info] ====`, 'Starting Healthcheck'])).toEqual([
      `${localTime} info  ====`,
      `${' '.repeat(messageColumn)}Starting Healthcheck`,
    ]);
  });

  it('attaches a text-less head to the first continuation row', () => {
    expect(renderAll([`[${ISO}] [info] `, '====', 'Starting Healthcheck', '===='])).toEqual([
      `${localTime} info  ====`,
      `${' '.repeat(messageColumn)}Starting Healthcheck`,
      `${' '.repeat(messageColumn)}====`,
    ]);
  });

  it('turns a text-less head into a separator when a full entry follows', () => {
    expect(renderAll([`[${ISO}] [info] a`, `[${ISO}] [info] `, `[${ISO}] [info] b`])).toEqual([
      `${localTime} info  a`,
      '',
      `${localTime} info  b`,
    ]);
  });

  it('prints blank entries as a single separator, absorbing a held head', () => {
    expect(renderAll(['', `[${ISO}] [warn] `, '', 'tail'])).toEqual(['', '', `${' '.repeat(messageColumn)}tail`]);
  });
});

describe('carried ANSI style', () => {
  it('reopens a colour that spans rows and stops after its reset', () => {
    const renderer = new DeployLogRowRenderer();
    const rows = [
      '[2026-03-20T12:00:00.000Z] [info] \x1b[95m====',
      'Starting Healthcheck',
      '====\x1b[0m',
      'after',
    ].flatMap(entry => renderer.render(entry));
    const indent = ' '.repeat(TIMESTAMP_COLUMN_WIDTH + 1 + 5 + 1);
    expect(rows[0]!.endsWith('\x1b[95m====\x1b[0m')).toBe(true);
    expect(rows[1]).toBe(`${indent}\x1b[95mStarting Healthcheck\x1b[0m`);
    expect(rows[2]).toBe(`${indent}\x1b[95m====\x1b[0m`);
    expect(rows[3]).toBe(`${indent}after`);
  });

  it('carries colour through a held-back head and a blank separator', () => {
    const renderer = new DeployLogRowRenderer();
    const rows = ['[2026-03-20T12:00:00.000Z] [info] \x1b[1;33m', '', 'still bold yellow'].flatMap(entry =>
      renderer.render(entry),
    );
    expect(rows).toEqual(['', `${' '.repeat(TIMESTAMP_COLUMN_WIDTH + 1 + 5 + 1)}\x1b[1;33mstill bold yellow\x1b[0m`]);
  });

  it('tracks partial resets and extended colours', () => {
    const state = advanceSgrState(
      { bold: false, dim: false, italic: false, underline: false },
      '\x1b[1m\x1b[38;5;208mx\x1b[22m\x1b[44m',
    );
    expect(sgrOpenSequence(state)).toBe('\x1b[38;5;208;44m');
    expect(sgrOpenSequence(advanceSgrState(state, '\x1b[39m'))).toBe('\x1b[44m');
    expect(sgrOpenSequence(advanceSgrState(state, '\x1b[m'))).toBe('');
  });
});

describe('truncateToWidth', () => {
  it('leaves short lines alone', () => {
    expect(truncateToWidth('hello', 10)).toBe('hello');
    expect(truncateToWidth('hello', 0)).toBe('hello');
  });

  it('cuts long lines to the width with an ellipsis and reset', () => {
    expect(truncateToWidth('abcdefghij', 5)).toBe('abcd…\x1b[0m');
  });

  it('does not count ANSI escapes toward the width', () => {
    const value = '\x1b[31mabcdefghij\x1b[0m';
    expect(truncateToWidth(value, 5)).toBe('\x1b[31mabcd…\x1b[0m');
    expect(stripAnsi(truncateToWidth(value, 20))).toBe('abcdefghij');
  });
});

describe('createDeployLogWriter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('scrolls a small burst in one line per 100ms step on a TTY', () => {
    vi.useFakeTimers();
    const { stream, chunks } = fakeStream();
    const writer = createDeployLogWriter({ stream, maxLines: 2 });
    writer.write('a', 'b', 'c');

    expect(chunks).toHaveLength(0);
    vi.advanceTimersByTime(100);
    expect(chunks).toHaveLength(1);
    expect(stripAnsi(chunks[0]!)).toContain(' a\n');
    vi.advanceTimersByTime(100);
    expect(chunks).toHaveLength(2);
    vi.advanceTimersByTime(100);
    expect(chunks).toHaveLength(3);
    expect(chunks[2]!.startsWith('\x1b[2A\x1b[0J')).toBe(true);
    expect(stripAnsi(chunks[2]!).split('\n').filter(Boolean)).toEqual([
      `${' '.repeat(TIMESTAMP_COLUMN_WIDTH)} b`,
      `${' '.repeat(TIMESTAMP_COLUMN_WIDTH)} c`,
    ]);
  });

  it('commits several lines per step for a large burst so it drains in about two seconds', () => {
    vi.useFakeTimers();
    const { stream, chunks } = fakeStream();
    const writer = createDeployLogWriter({ stream, maxLines: 5 });
    writer.write(...Array.from({ length: 300 }, (_, i) => `line ${i}`));
    vi.advanceTimersByTime(100);
    expect(chunks).toHaveLength(1);
    expect(stripAnsi(chunks[0]!)).toContain('line 14\n');
    vi.advanceTimersByTime(2500);
    expect(chunks.length).toBeLessThanOrEqual(30);
    expect(stripAnsi(chunks[chunks.length - 1]!)).toContain('line 299\n');
  });

  it('flush draws everything still queued at once', () => {
    vi.useFakeTimers();
    const { stream, chunks } = fakeStream();
    const writer = createDeployLogWriter({ stream, maxLines: 2 });
    writer.write('a', 'b', 'c');
    writer.flush();

    expect(chunks).toHaveLength(1);
    expect(stripAnsi(chunks[0]!).split('\n').filter(Boolean)).toEqual([
      `${' '.repeat(TIMESTAMP_COLUMN_WIDTH)} b`,
      `${' '.repeat(TIMESTAMP_COLUMN_WIDTH)} c`,
    ]);
    vi.advanceTimersByTime(500);
    expect(chunks).toHaveLength(1);
  });

  it('prints separator rows as the bare prefix', () => {
    const { stream, chunks } = fakeStream({ isTTY: false });
    const writer = createDeployLogWriter({ stream, prefix: '| ' });
    writer.write(`[${ISO}] [info] a`, '', `[${ISO}] [info] b`);
    expect(stripAnsi(chunks.join(''))).toBe(`| ${localTime} info  a\n|\n| ${localTime} info  b\n`);
  });

  it('never lets non-SGR escapes reach the stream, on or off a TTY', () => {
    const hostile = '[2026-03-20T12:00:00.000Z] [info] \x1b]0;pwned\x07\x1b[32mok\x1b[0m\x1bc\x1b[?1049h';
    for (const isTTY of [true, false]) {
      const { stream, chunks } = fakeStream({ isTTY });
      createDeployLogWriter({ stream, scroll: false }).write(hostile);
      const output = chunks.join('');
      expect(output).toContain('\x1b[32mok\x1b[0m');
      expect(output.replace(/\x1b\[[0-9;]*m/g, '')).not.toContain('\x1b');
    }
  });

  it('prints immediately off a TTY even with scrolling on', () => {
    const { stream, chunks } = fakeStream({ isTTY: false });
    createDeployLogWriter({ stream }).write('a', 'b');
    expect(chunks).toHaveLength(1);
  });

  it('prints every line, with prefix, when the stream is not a TTY', () => {
    const { stream, chunks } = fakeStream({ isTTY: false });
    const writer = createDeployLogWriter({ stream, maxLines: 2, prefix: '| ' });
    writer.write('a', 'b', 'c');

    const output = chunks.join('');
    expect(output).not.toContain('\x1b[');
    expect(output.split('\n').filter(Boolean)).toEqual([
      `| ${' '.repeat(TIMESTAMP_COLUMN_WIDTH)} a`,
      `| ${' '.repeat(TIMESTAMP_COLUMN_WIDTH)} b`,
      `| ${' '.repeat(TIMESTAMP_COLUMN_WIDTH)} c`,
    ]);
  });

  it('prints every line on a TTY when showAll is set', () => {
    const { stream, chunks } = fakeStream();
    const writer = createDeployLogWriter({ stream, maxLines: 2, showAll: true });
    writer.write('a');
    writer.write('b');
    writer.write('c');

    expect(chunks.join('')).not.toContain('\x1b[2A');
    expect(chunks.join('').split('\n').filter(Boolean)).toHaveLength(3);
  });

  it('appends until the window is full, then redraws only the last lines', () => {
    const { stream, chunks } = fakeStream();
    const writer = createDeployLogWriter({ stream, maxLines: 2, scroll: false });
    writer.write('a');
    writer.write('b');
    expect(chunks).toHaveLength(2);
    expect(chunks.join('')).not.toContain('\x1b[');

    writer.write('c');
    expect(chunks).toHaveLength(3);
    const redraw = chunks[2]!;
    expect(redraw.startsWith('\x1b[2A\x1b[0J')).toBe(true);
    expect(stripAnsi(redraw).split('\n').filter(Boolean)).toEqual([
      `${' '.repeat(TIMESTAMP_COLUMN_WIDTH)} b`,
      `${' '.repeat(TIMESTAMP_COLUMN_WIDTH)} c`,
    ]);
  });

  it('redraws once for a batch and keeps only the newest lines', () => {
    const { stream, chunks } = fakeStream();
    const writer = createDeployLogWriter({ stream, maxLines: 3, scroll: false });
    writer.write('1', '2');
    writer.write('3', '4', '5', '6');

    expect(chunks).toHaveLength(2);
    expect(chunks[1]!.startsWith('\x1b[2A\x1b[0J')).toBe(true);
    expect(stripAnsi(chunks[1]!).split('\n').filter(Boolean)).toEqual([
      `${' '.repeat(TIMESTAMP_COLUMN_WIDTH)} 4`,
      `${' '.repeat(TIMESTAMP_COLUMN_WIDTH)} 5`,
      `${' '.repeat(TIMESTAMP_COLUMN_WIDTH)} 6`,
    ]);

    writer.write('7');
    expect(chunks[2]!.startsWith('\x1b[3A\x1b[0J')).toBe(true);
  });

  it('renders an entry with embedded newlines as separate rows so the redraw stays aligned', () => {
    const { stream, chunks } = fakeStream();
    const writer = createDeployLogWriter({ stream, maxLines: 2, scroll: false });
    writer.write('[2026-03-20T12:00:00.000Z] [info] ====\nStarting Healthcheck\n====\n');
    writer.write('next');

    const messageColumn = TIMESTAMP_COLUMN_WIDTH + 1 + 5 + 1;
    expect(chunks[1]!.startsWith('\x1b[2A\x1b[0J')).toBe(true);
    expect(stripAnsi(chunks[1]!).split('\n').filter(Boolean)).toEqual([
      `${' '.repeat(messageColumn)}====`,
      `${' '.repeat(messageColumn)}next`,
    ]);
  });

  it('shrinks the window so it and the cursor row fit the terminal height', () => {
    const { stream, chunks } = fakeStream();
    (stream as { rows?: number }).rows = 4;
    const writer = createDeployLogWriter({ stream, maxLines: 20, scroll: false });
    writer.write('1', '2', '3', '4', '5');
    expect(stripAnsi(chunks[0]!).split('\n').filter(Boolean)).toHaveLength(3);
    writer.write('6');
    expect(chunks[1]!.startsWith('\x1b[3A\x1b[0J')).toBe(true);
  });

  it('truncates windowed lines to one column short of the terminal width', () => {
    const { stream, chunks } = fakeStream({ columns: 30 });
    const writer = createDeployLogWriter({ stream, maxLines: 5, scroll: false });
    writer.write('x'.repeat(100));

    const plain = stripAnsi(chunks[0]!).replace(/\n$/, '');
    expect(plain.length).toBe(29);
    expect(plain.endsWith('…')).toBe(true);
  });

  it('assumes 80 columns when a TTY does not report its width', () => {
    const { stream, chunks } = fakeStream({ columns: 0 });
    const writer = createDeployLogWriter({ stream, maxLines: 5, scroll: false });
    writer.write('x'.repeat(100));
    expect(stripAnsi(chunks[0]!).replace(/\n$/, '').length).toBe(79);
  });

  it('never truncates off a TTY', () => {
    const { stream, chunks } = fakeStream({ isTTY: false, columns: 30 });
    const writer = createDeployLogWriter({ stream });
    writer.write('x'.repeat(100));
    expect(chunks[0]).toContain('x'.repeat(100));
  });

  it('ignores empty writes', () => {
    const { stream, chunks } = fakeStream();
    createDeployLogWriter({ stream }).write();
    expect(chunks).toHaveLength(0);
  });
});

describe('selectFailureExcerpt', () => {
  const ts = (i: number) => `[2026-03-20T12:00:${String(i).padStart(2, '0')}.000Z]`;
  const log = (i: number, level = 'info', text = `step ${i}`) => `${ts(i)} [${level}] ${text}`;

  it('flags error levels and error-like text', () => {
    expect(isErrorLogLine(log(1, 'error'))).toBe(true);
    expect(isErrorLogLine(log(1, 'fatal'))).toBe(true);
    expect(isErrorLogLine(log(1, 'info', 'npm ERR! Error: boom'))).toBe(true);
    expect(isErrorLogLine(log(1, 'info', 'Healthcheck failed'))).toBe(true);
    expect(isErrorLogLine(log(1, 'info', 'Healthcheck succeeded'))).toBe(false);
    expect(isErrorLogLine(log(1, 'warn', 'slow'))).toBe(false);
  });

  it('returns matching rows with context, merging overlapping ranges and marking gaps', () => {
    const entries = Array.from({ length: 30 }, (_, i) => log(i));
    entries[5] = log(5, 'error', 'first');
    entries[7] = log(7, 'error', 'second');
    entries[25] = log(25, 'error', 'third');
    const excerpt = selectFailureExcerpt(entries, { context: 2 });

    expect(excerpt.matched).toBe(true);
    expect(excerpt.lines).toEqual([...entries.slice(3, 10), '', ...entries.slice(23, 28)]);
  });

  it('keeps the most recent ranges when over the line budget', () => {
    const entries = Array.from({ length: 40 }, (_, i) => log(i));
    entries[2] = log(2, 'error', 'old');
    entries[30] = log(30, 'error', 'new');
    const excerpt = selectFailureExcerpt(entries, { context: 1, maxLines: 5 });
    expect(excerpt.lines).toEqual(entries.slice(29, 32));
  });

  it('falls back to the tail of the log when nothing matches', () => {
    const entries = Array.from({ length: 10 }, (_, i) => log(i));
    const excerpt = selectFailureExcerpt(entries, { fallbackLines: 4 });
    expect(excerpt.matched).toBe(false);
    expect(excerpt.lines).toEqual(entries.slice(6));
  });

  it('splits multi-row entries before selecting', () => {
    const excerpt = selectFailureExcerpt([`${ts(1)} [info] ok\n${ts(2)} [error] bad\nnext`], { context: 0 });
    expect(excerpt.lines).toEqual([`${ts(2)} [error] bad`]);
  });
});

import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sanitizePipedOutput } from '../stdin-pipe.js';

// ---------------------------------------------------------------------------
// sanitizePipedOutput (pure function — no mocking needed)
// ---------------------------------------------------------------------------

describe('sanitizePipedOutput', () => {
  it('returns plain text unchanged', () => {
    expect(sanitizePipedOutput('hello world')).toBe('hello world');
  });

  it('strips SGR color codes', () => {
    expect(sanitizePipedOutput('\x1b[31mred\x1b[0m text')).toBe('red text');
  });

  it('strips cursor movement sequences', () => {
    // CSI A (cursor up), CSI 2K (erase line)
    expect(sanitizePipedOutput('before\x1b[A\x1b[2Kafter')).toBe('beforeafter');
  });

  it('strips OSC title sequences', () => {
    expect(sanitizePipedOutput('\x1b]0;window title\x07real content')).toBe('real content');
  });

  it('simulates \\r overwrites — keeps last segment', () => {
    // Spinner: "Building... |" overwritten by "Building... /" then "Done!"
    expect(sanitizePipedOutput('Building... |\rBuilding... /\rDone!')).toBe('Done!');
  });

  it('preserves visible text when input ends with bare \\r', () => {
    expect(sanitizePipedOutput('hello\r')).toBe('hello');
  });

  it('handles \\r overwrites on multiple lines', () => {
    const input = 'line1\nspinner |\rspinner /\rspinner done\nline3';
    expect(sanitizePipedOutput(input)).toBe('line1\nspinner done\nline3');
  });

  it('leaves lines without \\r unchanged', () => {
    expect(sanitizePipedOutput('line1\nline2\nline3')).toBe('line1\nline2\nline3');
  });

  it('collapses 3+ blank lines into 2', () => {
    expect(sanitizePipedOutput('a\n\n\n\n\nb')).toBe('a\n\nb');
  });

  it('strips binary control characters but preserves tabs', () => {
    expect(sanitizePipedOutput('col1\tcol2\x00\x01\x7F')).toBe('col1\tcol2');
  });

  it('strips NUL bytes from binary-ish content', () => {
    expect(sanitizePipedOutput('\x00\x00hello\x00')).toBe('hello');
  });

  it('handles combined ANSI + \\r + binary noise', () => {
    const input = '\x1b[32mLoading\x1b[0m\rDone\x00\x01';
    expect(sanitizePipedOutput(input)).toBe('Done');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizePipedOutput('  \n  hello  \n  ')).toBe('hello');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(sanitizePipedOutput('   \n\n  ')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// drainPipedStdin — needs process.stdin mocking
// ---------------------------------------------------------------------------

describe('drainPipedStdin', () => {
  const originalStdinDescriptor = Object.getOwnPropertyDescriptor(process, 'stdin');
  const originalStderrWrite = process.stderr.write;

  beforeEach(() => {
    // Suppress stderr warnings during tests
    process.stderr.write = vi.fn() as any;
  });

  afterEach(() => {
    if (originalStdinDescriptor) {
      Object.defineProperty(process, 'stdin', originalStdinDescriptor);
    }
    process.stderr.write = originalStderrWrite;
  });

  /** Create a fake piped stdin from an array of string chunks. */
  function mockPipedStdin(chunks: string[]) {
    const stream = new Readable({
      read() {
        for (const chunk of chunks) {
          this.push(Buffer.from(chunk));
        }
        this.push(null); // EOF
      },
    });
    Object.defineProperty(stream, 'isTTY', { value: false });
    Object.defineProperty(process, 'stdin', {
      value: stream,
      writable: true,
      configurable: true,
    });
  }

  /** Create a fake TTY stdin. */
  function mockTTYStdin() {
    const stream = new Readable({ read() {} });
    Object.defineProperty(stream, 'isTTY', { value: true });
    Object.defineProperty(process, 'stdin', {
      value: stream,
      writable: true,
      configurable: true,
    });
  }

  it('returns null when stdin is a TTY', async () => {
    mockTTYStdin();
    // Re-import to get fresh module with mocked stdin
    const { drainPipedStdin } = await import('../stdin-pipe.js');
    expect(await drainPipedStdin()).toBeNull();
  });

  it('reads all chunks and returns concatenated string', async () => {
    mockPipedStdin(['hello ', 'world']);
    const { drainPipedStdin } = await import('../stdin-pipe.js');
    expect(await drainPipedStdin()).toBe('hello world');
  });

  it('returns null for empty pipe', async () => {
    mockPipedStdin([]);
    const { drainPipedStdin } = await import('../stdin-pipe.js');
    expect(await drainPipedStdin()).toBeNull();
  });

  it('returns null for whitespace-only pipe', async () => {
    mockPipedStdin(['   \n\n  ']);
    const { drainPipedStdin } = await import('../stdin-pipe.js');
    expect(await drainPipedStdin()).toBeNull();
  });

  it('concatenates multiple chunks arriving over time', async () => {
    // Simulate chunks arriving with delays
    const stream = new Readable({
      read() {},
    });
    Object.defineProperty(stream, 'isTTY', { value: false });
    Object.defineProperty(process, 'stdin', {
      value: stream,
      writable: true,
      configurable: true,
    });

    const { drainPipedStdin } = await import('../stdin-pipe.js');
    const promise = drainPipedStdin();

    // Push chunks asynchronously
    stream.push(Buffer.from('chunk1 '));
    await new Promise(r => setTimeout(r, 10));
    stream.push(Buffer.from('chunk2 '));
    await new Promise(r => setTimeout(r, 10));
    stream.push(Buffer.from('chunk3'));
    stream.push(null); // EOF — sender exited

    expect(await promise).toBe('chunk1 chunk2 chunk3');
  });

  it('truncates content exceeding 1MB and warns on stderr', async () => {
    const oneMB = 1024 * 1024;
    const bigChunk = 'x'.repeat(oneMB + 100);
    mockPipedStdin([bigChunk]);
    const { drainPipedStdin } = await import('../stdin-pipe.js');

    const result = await drainPipedStdin();

    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(oneMB);
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('truncated'));
  });

  it('sanitizes ANSI codes and \\r overwrites in piped content', async () => {
    mockPipedStdin(['\x1b[32mLoading\x1b[0m\rDone!']);
    const { drainPipedStdin } = await import('../stdin-pipe.js');
    expect(await drainPipedStdin()).toBe('Done!');
  });
});

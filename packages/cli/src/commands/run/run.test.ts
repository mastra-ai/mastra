import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@mastra/deployer', () => ({
  FileService: vi.fn().mockImplementation(() => ({
    getFirstExistingFile: vi.fn().mockReturnValue('/fake/src/mastra/index.ts'),
  })),
}));

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('../../utils/logger.js', () => ({
  createLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./RunBundler.js', () => ({
  RunBundler: vi.fn().mockImplementation(() => ({
    __setLogger: vi.fn(),
    prepare: vi.fn().mockResolvedValue(undefined),
    getAllToolPaths: vi.fn().mockReturnValue([]),
    bundle: vi.fn().mockResolvedValue(undefined),
    loadEnvVars: vi.fn().mockResolvedValue(new Map()),
  })),
}));

import { isOutputFormat, run } from './run';
import type { RunArgs } from './run';

const baseArgs: RunArgs = {
  prompt: 'Hello',
  agent: 'myAgent',
  outputFormat: 'text',
  strict: false,
  debug: false,
};

describe('isOutputFormat', () => {
  it('accepts valid formats', () => {
    expect(isOutputFormat('text')).toBe(true);
    expect(isOutputFormat('json')).toBe(true);
    expect(isOutputFormat('stream-json')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isOutputFormat('yaml')).toBe(false);
    expect(isOutputFormat('')).toBe(false);
    expect(isOutputFormat('TEXT')).toBe(false);
    expect(isOutputFormat('text ')).toBe(false);
  });
});

describe('run — input validation', () => {
  let stderrWrites: string[];
  let exitCalls: number[];
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let originalStdinIsTTY: boolean | undefined;

  beforeEach(() => {
    stderrWrites = [];
    exitCalls = [];

    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
      stderrWrites.push(String(chunk));
      return true;
    });

    // process.exit halts execution; throw so tests can assert without the rest of run() executing
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null): never => {
      exitCalls.push(typeof code === 'number' ? code : 0);
      throw new Error(`__exit_${code}__`);
    });

    // Force stdin to look like a TTY so readStdin is not triggered
    originalStdinIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: originalStdinIsTTY });
    vi.clearAllMocks();
  });

  it('exits 2 with usage message when no prompt is provided and stdin is a TTY', async () => {
    await expect(run({ ...baseArgs, prompt: undefined })).rejects.toThrow('__exit_2__');

    expect(exitCalls).toEqual([2]);
    const stderrText = stderrWrites.join('');
    expect(stderrText).toContain('No prompt provided');
    expect(stderrText).toContain('-p "your prompt"');
    expect(stderrText).toContain('pipe via stdin');
  });

  it('exits 2 when --output-format is invalid', async () => {
    await expect(run({ ...baseArgs, outputFormat: 'yaml' })).rejects.toThrow('__exit_2__');

    expect(exitCalls).toEqual([2]);
    expect(stderrWrites.join('')).toContain('Invalid --output-format "yaml"');
    expect(stderrWrites.join('')).toContain('text, json, stream-json');
  });

  it('exits 2 when --json-schema is used with --output-format text', async () => {
    await expect(run({ ...baseArgs, outputFormat: 'text', jsonSchema: '{"type":"object"}' })).rejects.toThrow(
      '__exit_2__',
    );

    expect(exitCalls).toEqual([2]);
    expect(stderrWrites.join('')).toContain('--json-schema requires --output-format json or stream-json');
  });

  it('validates --output-format before prompt validity (invalid format with missing prompt still flags prompt first)', async () => {
    // Prompt check comes first in the function; invalid format alone after valid prompt
    await expect(run({ ...baseArgs, prompt: undefined, outputFormat: 'yaml' })).rejects.toThrow('__exit_2__');

    // Should be the prompt error, not the format error
    expect(stderrWrites.join('')).toContain('No prompt provided');
    expect(stderrWrites.join('')).not.toContain('Invalid --output-format');
  });
});

import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { looksLikePath, parseScheduleCreateArgs } from './args.js';

const cwd = '/work';

function opts(files: Record<string, { exec?: boolean }> = {}) {
  return {
    cwd,
    homeDir: '/home/me',
    fileExists: (p: string) => p in files,
    isExecutable: (p: string) => files[p]?.exec === true,
  };
}

describe('looksLikePath', () => {
  it.each(['./a', '../a', '~/a', '/abs', 'dir/file', 'notes.md', 'check.sh'])('%s looks like a path', t => {
    expect(looksLikePath(t)).toBe(true);
  });
  it.each(['check', 'the', 'deploy', 'v1.2.3x!'])('%s does not look like a path', t => {
    expect(looksLikePath(t)).toBe(false);
  });
});

describe('parseScheduleCreateArgs', () => {
  it('parses a plain prompt', () => {
    const result = parseScheduleCreateArgs(['5m', 'check', 'the', 'deploy'], opts());
    expect(result).toMatchObject({
      interval: { ms: 300_000, label: '5m' },
      prompt: 'check the deploy',
    });
    expect(result).not.toHaveProperty('file');
    expect(result).not.toHaveProperty('warning');
  });

  it('strips one pair of quotes wrapping the whole prompt', () => {
    expect(parseScheduleCreateArgs(['5m', '"schedules', 'test"'], opts())).toMatchObject({ prompt: 'schedules test' });
    expect(parseScheduleCreateArgs(['5m', "'ping'"], opts())).toMatchObject({ prompt: 'ping' });
    expect(parseScheduleCreateArgs(['5m', 'say', '"hi"'], opts())).toMatchObject({ prompt: 'say "hi"' });
    expect(parseScheduleCreateArgs(['5m', '""'], opts())).toHaveProperty('error');
  });

  it('strips wrapping quotes from the extra prompt', () => {
    const abs = path.join(cwd, 'check.sh');
    const result = parseScheduleCreateArgs(['5m', './check.sh', '"Report', 'it"'], opts({ [abs]: { exec: true } }));
    expect(result).toMatchObject({ extraPrompt: 'Report it' });
  });

  it('accepts spelled-out two-token intervals', () => {
    const result = parseScheduleCreateArgs(['5', 'minutes', 'ping'], opts());
    expect(result).toMatchObject({ interval: { label: '5m' }, prompt: 'ping' });
  });

  it('parses an executable script file with no extra prompt', () => {
    const abs = path.join(cwd, 'check.sh');
    const result = parseScheduleCreateArgs(['1h', './check.sh'], opts({ [abs]: { exec: true } }));
    expect(result).toMatchObject({
      interval: { label: '1h' },
      file: { path: abs, displayPath: './check.sh', mode: 'exec' },
    });
    expect(result).not.toHaveProperty('prompt');
    expect(result).not.toHaveProperty('extraPrompt');
  });

  it('parses a script file plus extra prompt', () => {
    const abs = path.join(cwd, 'scripts', 'check.py');
    const result = parseScheduleCreateArgs(['24h', 'scripts/check.py', 'Report', 'the', 'result'], opts({ [abs]: {} }));
    expect(result).toMatchObject({
      interval: { label: '24h' },
      file: { path: abs, mode: 'exec' },
      extraPrompt: 'Report the result',
    });
  });

  it('treats a non-executable file with unknown extension as a prompt file', () => {
    const abs = path.join(cwd, 'prompt.md');
    const result = parseScheduleCreateArgs(['10m', './prompt.md', 'and', 'summarize'], opts({ [abs]: {} }));
    expect(result).toMatchObject({ file: { path: abs, mode: 'prompt' }, extraPrompt: 'and summarize' });
  });

  it('treats an executable-bit file with no extension as exec', () => {
    const abs = path.join(cwd, 'bin', 'healthcheck');
    const result = parseScheduleCreateArgs(['2h', 'bin/healthcheck'], opts({ [abs]: { exec: true } }));
    expect(result).toMatchObject({ file: { path: abs, mode: 'exec' } });
  });

  it('expands ~ against homeDir', () => {
    const abs = '/home/me/notes.txt';
    const result = parseScheduleCreateArgs(['1d', '~/notes.txt'], opts({ [abs]: {} }));
    expect(result).toMatchObject({ file: { path: abs, mode: 'prompt' } });
  });

  it('falls back to prompt text with a warning when a path-looking token is missing', () => {
    const result = parseScheduleCreateArgs(['5m', './missing.sh', 'and', 'report'], opts());
    expect(result).toMatchObject({ prompt: './missing.sh and report' });
    expect((result as { warning?: string }).warning).toMatch(/missing\.sh.*not found/);
    expect(result).not.toHaveProperty('file');
  });

  it('errors when no prompt or file follows the interval', () => {
    expect(parseScheduleCreateArgs(['5m'], opts())).toEqual({
      error: 'Provide a prompt or a file path after the interval.',
    });
  });

  it('errors on missing interval', () => {
    expect(parseScheduleCreateArgs([], opts())).toHaveProperty('error');
  });

  it('errors on invalid interval', () => {
    expect(parseScheduleCreateArgs(['soon', 'ping'], opts())).toHaveProperty('error');
  });

  it('surfaces interval validation errors with a suggestion', () => {
    const result = parseScheduleCreateArgs(['90m', 'ping'], opts());
    expect((result as { error: string }).error).toMatch(/Try 2h\./);
  });

  it('rejects sub-minute intervals', () => {
    const result = parseScheduleCreateArgs(['30s', 'ping'], opts());
    expect((result as { error: string }).error).toMatch(/once per minute.*Try 1m/);
  });
});

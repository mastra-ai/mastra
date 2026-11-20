import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { noopLogger } from '@mastra/core/logger';
import { afterEach, describe, expect, it } from 'vitest';
import { createChildProcessLogger, toWindowsShellArg, toWindowsShellArgs } from './log';

describe.skipIf(process.platform === 'win32')('createChildProcessLogger', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });
  async function tempDir() {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-cp-logger-'));
    dirs.push(dir);
    return dir;
  }

  it('passes shell metacharacters through to the binary verbatim without running them', async () => {
    const root = await tempDir();
    const hostile = ['out dir;touch pwned', '$(touch pwned)', '`touch pwned`', 'a && touch pwned', 'a | touch pwned'];
    const run = createChildProcessLogger({ logger: noopLogger, root });

    const result: any = await run({
      cmd: 'node -p',
      args: ['JSON.stringify(process.argv.slice(1))', ...hostile],
      env: { PATH: process.env.PATH! },
    });

    expect(result.success).toBe(true);
    expect(JSON.parse(result.stdout)).toEqual(hostile);
    expect(await readdir(root)).toEqual([]);
  });

  it('rejects with the exit code when the binary fails', async () => {
    const root = await tempDir();
    const run = createChildProcessLogger({ logger: noopLogger, root });

    await expect(run({ cmd: 'node -e', args: ['process.exit(3)'], env: { PATH: process.env.PATH! } })).rejects.toThrow(
      'Process exited with code 3',
    );
  });
});

describe('toWindowsShellArg', () => {
  it.each(['C:\\Users\\José\\repo\\output', '/home/zoë/プロジェクト/out', '--pack-destination', '@scope/pkg@1.2.3'])(
    'passes plain %s through unquoted',
    arg => {
      expect(toWindowsShellArg(arg)).toBe(arg);
    },
  );

  it.each([
    'C:\\Users\\John Smith\\out',
    "C:\\Users\\O'Brien\\out",
    'C:\\out\\🚀',
    'C:\\out\\€',
    'a;b',
    'a&b',
    'a|b',
    'a>b',
    '$(x)',
    '\x60x\x60',
    '^1.2.3',
  ])('quotes %j so cmd.exe reads it literally', arg => {
    expect(toWindowsShellArg(arg)).toBe(`"${arg}"`);
  });

  it('doubles trailing backslashes so they do not escape the closing quote', () => {
    expect(toWindowsShellArg('C:\\John Smith\\out\\')).toBe('"C:\\John Smith\\out\\\\"');
  });

  it('handles a long backslash run in linear time', () => {
    const arg = `a ${'\\'.repeat(200_000)}x`;
    const start = performance.now();
    expect(toWindowsShellArg(arg)).toBe(`"${arg}"`);
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it.each(['"a"', 'a!b', 'a\nb', 'a\rb'])('refuses %j, which cmd.exe expands even inside quotes', arg => {
    expect(() => toWindowsShellArg(arg)).toThrow('Refusing to pass unsafe argument');
  });
});

describe('toWindowsShellArgs', () => {
  it("keeps Yarn Berry's %v output path", () => {
    expect(toWindowsShellArgs('yarn', ['pack', '--out', 'C:\\Users\\José\\out/scope-utilities-%v.tgz'])).toEqual([
      'pack',
      '--out',
      '"C:\\Users\\José\\out/scope-utilities-%v.tgz"',
    ]);
  });

  it.each([
    [['pack', '%PATH%']],
    [['pack', '--out', 'C:\\100%\\out/pkg-%v.tgz']],
    [['--pack-destination', 'C:\\a%b', 'c%d']],
  ])('refuses %j, where a %%name%% pair could expand', args => {
    expect(() => toWindowsShellArgs('yarn', args)).toThrow('more than one "%"');
  });

  it('refuses a command with shell characters', () => {
    expect(() => toWindowsShellArgs('yarn&calc', ['pack'])).toThrow('Refusing to spawn unsafe command');
  });
});

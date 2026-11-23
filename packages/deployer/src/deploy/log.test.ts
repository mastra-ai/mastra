import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execPath } from 'node:process';
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

  it.each(['"a"', 'a!b', 'a\nb', 'a\rb'])('refuses %j, which cmd.exe expands even inside quotes', arg => {
    expect(() => toWindowsShellArg(arg)).toThrow('Refusing to pass unsafe argument');
  });

  it('doubles trailing backslashes so they do not escape the closing quote', () => {
    expect(toWindowsShellArg('C:\\John Smith\\out\\')).toBe('"C:\\John Smith\\out\\\\"');
    expect(toWindowsShellArg("C:\\O'Brien\\out\\")).toBe('"C:\\O\'Brien\\out\\\\"');
  });

  it('quotes a long trailing backslash run in linear time', () => {
    const tail = '\\'.repeat(200_000);
    const arg = `C:\\Program Files\\out ${tail}`;
    const started = performance.now();
    const quoted = toWindowsShellArg(arg);
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(quoted).toBe(`"${arg}${tail}"`);
  });

  it('quotes a long backslash run that is not at the end in linear time', () => {
    const arg = `a ${'\\'.repeat(200_000)}x`;
    const started = performance.now();
    expect(toWindowsShellArg(arg)).toBe(`"${arg}"`);
    expect(performance.now() - started).toBeLessThan(1_000);
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

// The cmd.exe stand-in is a Node script with a shebang, which only POSIX can execute directly.
describe.skipIf(process.platform === 'win32')('Windows package-manager .cmd shims', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });

  it('packs into a quoted destination that ends in a backslash', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mastra-win-shim-'));
    dirs.push(root);
    const binDir = join(root, 'bin');
    const packageDir = join(root, 'pkg');
    // Space, apostrophe, and a trailing backslash: quoted, and the backslash must not escape the quote.
    const destination = join(root, "O'Brien out") + '\\';
    const argvOut = join(root, 'argv.json');
    const shell = join(root, 'windows-cmd.mjs');
    await mkdir(binDir);
    await mkdir(packageDir);
    // Absolute shebang: the child env's PATH only contains the shim directory.
    await writeFile(shell, windowsCmdStandIn.replace(/^#!.*\n/, `#!${execPath}\n`), 'utf8');
    await chmod(shell, 0o755);
    await writeFile(join(binDir, 'npm.cmd'), npmCmdShim, 'utf8');

    const run = createChildProcessLogger({
      logger: noopLogger,
      root: packageDir,
      platform: 'win32',
      windowsShell: shell,
    });
    const result: any = await run({
      cmd: 'npm pack',
      args: ['--pack-destination', destination],
      env: { PATH: binDir, ARGV_OUT: argvOut },
    });

    expect(result.success, result.stderr).toBe(true);
    expect(JSON.parse(await readFile(argvOut, 'utf8'))).toEqual(['pack', '--pack-destination', destination]);
    expect(await readdir(destination)).toEqual(['workspace-module-1.0.0.tgz']);
  });
});

// cmd.exe /d /s /c stand-in. Strips the outer quotes Node adds, then applies the
// C runtime argument parser a `.cmd` shim's `node … %*` invocation uses, and runs npm.cmd.
const windowsCmdStandIn = `#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';

function parseWindowsArgv(line) {
  const args = [];
  let arg = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\\\') {
      let n = 0;
      while (i < line.length && line[i] === '\\\\') {
        n++;
        i++;
      }
      if (i < line.length && line[i] === '"') {
        arg += '\\\\'.repeat(Math.floor(n / 2));
        if (n % 2 === 1) {
          arg += '"';
        } else {
          inQuote = !inQuote;
        }
      } else {
        arg += '\\\\'.repeat(n);
        i--;
      }
      continue;
    }
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && (ch === ' ' || ch === '\\t')) {
      args.push(arg);
      arg = '';
      while (i + 1 < line.length && (line[i + 1] === ' ' || line[i + 1] === '\\t')) i++;
      continue;
    }
    arg += ch;
  }
  args.push(arg);
  return args;
}

const raw = process.argv[process.argv.indexOf('/c') + 1] ?? '';
let line = raw;
if (line.startsWith('"')) {
  const last = line.lastIndexOf('"');
  line = line.slice(1, last) + line.slice(last + 1);
}
const args = parseWindowsArgv(line);
const bin = args[0];
let shim;
for (const dir of (process.env.PATH ?? '').split(delimiter)) {
  const candidate = join(dir, bin + '.cmd');
  if (existsSync(candidate)) {
    shim = candidate;
    break;
  }
}
if (!shim) {
  console.error('package manager shim not found: ' + bin);
  process.exit(127);
}
// A .cmd file is not a module extension, so run the shim source with --eval.
// Node drops the --eval script from argv, leaving the pack arguments.
const child = spawnSync(
  process.execPath,
  ['--input-type=module', '--eval', readFileSync(shim, 'utf8'), ...args.slice(1)],
  { env: process.env, stdio: 'inherit' },
);
process.exit(child.status ?? 1);
`;

const npmCmdShim = `import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const argv = process.argv.slice(1);
const dest = argv[argv.indexOf('--pack-destination') + 1];
mkdirSync(dest, { recursive: true });
writeFileSync(join(dest, 'workspace-module-1.0.0.tgz'), 'packed');
writeFileSync(process.env.ARGV_OUT, JSON.stringify(argv));
`;

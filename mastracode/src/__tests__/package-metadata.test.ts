import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const packageJsonPath = new URL('../../package.json', import.meta.url);
const packageRootPath = fileURLToPath(new URL('../../', import.meta.url));

type PackageJson = {
  type?: string;
  files?: string[];
  main?: string;
  types?: string;
  bin?: Record<string, string>;
  exports?: Record<string, unknown>;
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

async function readPackageJson(): Promise<PackageJson> {
  return JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageJson;
}

type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

async function runBuiltCli(args: string[]): Promise<CliResult> {
  const pkg = await readPackageJson();
  const cliPath = join(packageRootPath, pkg.bin?.mastracode ?? '');
  const appDataDir = await mkdtemp(join(tmpdir(), 'mastracode-packed-cli-'));
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, ...args], {
      cwd: packageRootPath,
      env: {
        ...process.env,
        MASTRA_APP_DATA_DIR: appDataDir,
        MASTRACODE_DISABLE_HOOKS: '1',
        MASTRACODE_DISABLE_MCP: '1',
        MASTRACODE_DISABLE_MEMORY: '1',
        MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB: '1',
      },
      timeout: 10_000,
    });
    return { exitCode: 0, stdout: String(stdout), stderr: String(stderr) };
  } catch (error) {
    const err = error as { code?: number | string; stdout?: string | Buffer; stderr?: string | Buffer };
    return {
      exitCode: typeof err.code === 'number' ? err.code : 1,
      stdout: String(err.stdout ?? ''),
      stderr: String(err.stderr ?? ''),
    };
  } finally {
    await rm(appDataDir, { recursive: true, force: true });
  }
}

describe('mastracode package metadata', () => {
  it('keeps the installed CLI entrypoint and public exports aligned with dist output', async () => {
    const pkg = await readPackageJson();

    expect(pkg.type).toBe('module');
    expect(pkg.files).toEqual(expect.arrayContaining(['dist', 'CHANGELOG.md']));
    expect(pkg.bin).toEqual({ mastracode: './dist/cli.js' });
    expect(pkg.main).toBe('dist/index.js');
    expect(pkg.types).toBe('dist/index.d.ts');
    expect(pkg.exports).toMatchObject({
      '.': {
        import: { types: './dist/index.d.ts', default: './dist/index.js' },
        require: { types: './dist/index.d.ts', default: './dist/index.cjs' },
      },
      './tui': {
        import: { types: './dist/tui/index.d.ts', default: './dist/tui.js' },
        require: { types: './dist/tui/index.d.ts', default: './dist/tui.cjs' },
      },
      './package.json': './package.json',
    });
    expect(pkg.engines?.node).toBe('>=22.13.0');
  });

  it('runs the built CLI help and headless prompt validation paths', async () => {
    const help = await runBuiltCli(['--help']);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain('Usage: mastracode --prompt <text>');
    expect(help.stdout).toContain('--output-format <type>');
    expect(help.stderr).toBe('');

    const tempDir = await mkdtemp(join(tmpdir(), 'mastracode-missing-settings-'));
    try {
      const missingSettings = join(tempDir, 'settings.json');
      const prompt = await runBuiltCli(['--prompt', 'packed artifact smoke', '--settings', missingSettings]);
      expect(prompt.exitCode).toBe(1);
      expect(prompt.stderr).toContain(`Error: Settings file not found: ${missingSettings}`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not publish floating latest dependency ranges', async () => {
    const pkg = await readPackageJson();
    const dependencyGroups = {
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
      peerDependencies: pkg.peerDependencies ?? {},
      optionalDependencies: pkg.optionalDependencies ?? {},
    };

    for (const [groupName, deps] of Object.entries(dependencyGroups)) {
      for (const [name, range] of Object.entries(deps)) {
        expect(range, `${groupName}.${name}`).not.toBe('latest');
      }
    }
  });
});

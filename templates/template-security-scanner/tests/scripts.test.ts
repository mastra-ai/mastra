import { execFile } from 'node:child_process';
import { chmod, cp, copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const execute = promisify(execFile);
const require = createRequire(import.meta.url);

describe('runtime script process boundaries', () => {
  it('rejects invalid dev settings before replacing existing console assets', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'scanner-dev-configuration-'));
    try {
      for (const directory of ['src', 'scripts', 'web', 'example-target-api', 'docker'])
        await cp(join(root, directory), join(folder, directory), {
          recursive: true,
          filter: source => source !== join(root, 'web/dist'),
        });
      await copyFile(join(root, 'package.json'), join(folder, 'package.json'));
      await copyFile(join(root, 'tsconfig.json'), join(folder, 'tsconfig.json'));
      await symlink(join(root, 'node_modules'), join(folder, 'node_modules'), 'dir');
      await mkdir(join(folder, 'web/dist'), { recursive: true });
      await writeFile(join(folder, 'web/dist/preserved.txt'), 'Existing console assets.');
      await writeFile(join(folder, '.env'), 'DOCKER_PLATFORM=linux/amd64\n');
      const launch = () =>
        execute('npm', ['run', 'dev'], {
          cwd: folder,
          env: { PATH: process.env.PATH, npm_config_cache: join(folder, 'npm-cache') },
          timeout: 20000,
          maxBuffer: 16384,
        }).then(
          output => ({ ...output, code: 0 }),
          error => error as { stdout: string; stderr: string; code: number },
        );
      const result = await launch();
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('INVALID_CONFIGURATION');
      expect(result.stderr).toContain('DOCKER_PLATFORM');
      expect(await readdir(join(folder, 'web/dist'))).toEqual(['preserved.txt']);
      expect(await readFile(join(folder, 'web/dist/preserved.txt'), 'utf8')).toBe('Existing console assets.');
      expect(await readdir(folder)).not.toContain('data');

      // Valid settings still reach the real console build, then the deliberately absent daemon.
      await writeFile(
        join(folder, '.env'),
        `DOCKER_PLATFORM=linux/arm64\nDOCKER_SOCKET=${join(folder, 'absent.sock')}\n`,
      );
      const valid = await launch();
      expect(valid.code).toBe(1);
      expect(valid.stderr).toContain('DOCKER_UNAVAILABLE');
      const manifest = JSON.parse(await readFile(join(folder, 'web/dist/manifest.json'), 'utf8'));
      expect(manifest.script).toMatch(/^console-[a-f0-9]{64}\.js$/);
      expect((await readFile(join(folder, 'web/dist', manifest.script))).length).toBeGreaterThan(1024);
      expect(await readdir(join(folder, 'web/dist'))).not.toContain('preserved.txt');
      expect(await readdir(folder)).not.toContain('data');
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }, 30000);

  it.each(['discovery', 'operations'])(
    'retains trailing %s reporter output after the child exits',
    async kind => {
      const folder = await mkdtemp(join(tmpdir(), 'scanner-reporter-'));
      try {
        // The real runner reads this bounded source tree and launches a wire-level reporter fixture.
        for (const directory of [
          'src',
          'scripts',
          'tests',
          'docker',
          'web',
          'references',
          'docs',
          'example-target-api',
          'data',
          'node_modules/vitest',
        ])
          await mkdir(join(folder, directory), { recursive: true });
        for (const file of [
          'package.json',
          'tsconfig.json',
          'vitest.config.ts',
          'README.md',
          'CONTRIBUTING.md',
          '.env.example',
          '.gitignore',
          '.nvmrc',
          '.oxfmtrc.json',
        ])
          await writeFile(join(folder, file), '');
        await copyFile(
          join(root, 'tests/fixtures/delayed-vitest-report.mjs'),
          join(folder, 'node_modules/vitest/vitest.mjs'),
        );
        const selector =
          kind === 'discovery'
            ? 'headless_preserves_actual_browser_boundary'
            : 'documented_setup_and_complete_p0_lab_matrix';
        const result = await execute(
          process.execPath,
          ['--import', require.resolve('tsx'), join(root, `scripts/test-${kind}.ts`), selector],
          {
            cwd: folder,
            env: { HOME: process.env.HOME, PATH: process.env.PATH },
            timeout: 15000,
            maxBuffer: 65536,
          },
        );
        const lines = result.stdout.trim().split('\n');
        expect(JSON.parse(lines.at(-1)!)).toMatchObject({
          status: 'passed',
          executed: 1,
          failed: 0,
          selectedPresent: true,
          sourceStable: true,
        });
        if (kind === 'operations') expect(lines).toContain('OPERATIONS_MATRIX_RECORD {"case":"trailing-proof"}');
        expect(result.stderr).toBe('');
      } finally {
        await rm(folder, { recursive: true, force: true });
      }
    },
    20000,
  );

  it('applies the same Chromium policy to single and double dash switches', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'scanner-browser-switches-'));
    try {
      const script = await readFile(join(root, 'scripts/runtime/chromium-safe.sh'), 'utf8');
      const wrapper = join(folder, 'chromium-safe.sh');
      const recorder = join(folder, 'record-browser-args');
      // Replace only the final browser executable. All filtering executes through the real POSIX shell.
      expect(script.match(/exec \/usr\/local\/bin\/scanner-chromium/g)).toHaveLength(1);
      await writeFile(wrapper, script.replace('exec /usr/local/bin/scanner-chromium', 'exec "$SCANNER_TEST_BROWSER"'));
      await writeFile(recorder, '#!/bin/sh\nprintf "%s\\n" "$@"\n');
      await chmod(recorder, 0o700);
      const invoke = (args: string[]) =>
        execute('/bin/sh', [wrapper, ...args], {
          env: { SCANNER_TEST_BROWSER: recorder },
          timeout: 2000,
          maxBuffer: 8192,
        });
      for (const prefix of ['--', '-']) {
        for (const flag of ['no-sandbox', 'ignore-certificate-errors', 'remote-allow-origins'])
          for (const value of ['', '=true']) {
            const result = await invoke([`${prefix}${flag}${value}`, '--headless']);
            expect(result.stdout.trim().split('\n')).toEqual([
              '--headless',
              '--remote-debugging-port=9222',
              '--remote-debugging-address=127.0.0.1',
            ]);
          }
        for (const flag of [
          'disable-setuid-sandbox',
          'disable-seccomp-filter-sandbox',
          'disable-namespace-sandbox',
          'disable-web-security',
          'allow-running-insecure-content',
          'allow-insecure-localhost',
          'ignore-certificate-errors-spki-list',
          'single-process',
          'no-zygote',
          'renderer-cmd-prefix',
          'utility-cmd-prefix',
          'gpu-launcher',
        ])
          for (const value of ['', '=true'])
            await expect(invoke([`${prefix}${flag}${value}`])).rejects.toMatchObject({ code: 77, stdout: '' });
        const controlled = await invoke([
          `${prefix}remote-debugging-port=1234`,
          `${prefix}remote-debugging-address=0.0.0.0`,
        ]);
        expect(controlled.stdout.trim().split('\n')).toEqual([
          '--remote-debugging-port=9222',
          '--remote-debugging-address=127.0.0.1',
        ]);
      }
      const safe = await invoke(['-headless', '--proxy-server=http://127.0.0.1:8080', 'http://owned.test/path']);
      expect(safe.stdout.trim().split('\n')).toEqual([
        '--headless',
        '--proxy-server=http://127.0.0.1:8080',
        'http://owned.test/path',
        '--remote-debugging-port=9222',
        '--remote-debugging-address=127.0.0.1',
      ]);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});

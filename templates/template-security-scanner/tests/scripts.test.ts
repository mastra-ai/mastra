import { execFile } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const execute = promisify(execFile);
const require = createRequire(import.meta.url);

describe('runtime script process boundaries', () => {
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

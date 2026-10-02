import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);

it('interleaves real clack notices with HTTP deployment logs in piped output', async () => {
  const env = { ...process.env, NO_COLOR: '1' };
  delete env.FORCE_COLOR;
  const { stdout, stderr } = await promisify(execFile)(
    process.execPath,
    [require.resolve('tsx/cli'), fileURLToPath(new URL('./__fixtures__/poll-output.ts', import.meta.url))],
    { timeout: 20_000, env },
  );
  expect(stderr).toBe('');
  const warning = stdout.indexOf('Unable to check deployment status.');
  const recovery = stdout.indexOf('Deployment status checks resumed.');
  const success = stdout.indexOf('Deployment is running.');
  expect(warning).toBeGreaterThan(0);
  expect(recovery).toBeGreaterThan(warning);
  expect(success).toBeGreaterThan(recovery);
  for (const section of [stdout.slice(0, warning), stdout.slice(warning, recovery), stdout.slice(recovery, success)]) {
    expect(section).toContain('build-output-');
  }
  expect(stdout.match(/Unable to check deployment status/g)).toHaveLength(1);
  expect(stdout.match(/Deployment status checks resumed/g)).toHaveLength(1);
  expect(stdout).not.toMatch(/\x1b\[\d*A/);
  expect(stdout.slice(success)).not.toContain('build-output-');
}, 25_000);

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const tsconfig = join(here, '__tests__/exact-optional/tsconfig.json');
const tscBin = join(dirname(createRequire(import.meta.url).resolve('typescript/package.json')), 'bin/tsc');

describe('exactOptionalPropertyTypes compatibility', () => {
  it('allows createTool tools to be registered with new Mastra({ tools })', () => {
    const files = spawnSync(process.execPath, [tscBin, '-p', tsconfig, '--listFilesOnly'], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
    expect(files.error).toBeUndefined();
    expect(files.status).toBe(0);
    expect(files.stdout.split('\n').some(line => line.trim().endsWith('exact-optional/fixture.ts'))).toBe(true);

    // Core source has unrelated diagnostics under this flag, so only the fixture's own errors are checked.
    const result = spawnSync(process.execPath, [tscBin, '-p', tsconfig], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
    expect(result.error).toBeUndefined();
    const output = `${result.stdout}${result.stderr}`;
    const fixtureErrors = output.split('\n').filter(line => line.includes('exact-optional/fixture.ts'));
    expect(fixtureErrors).toEqual([]);
  }, 120_000);
});

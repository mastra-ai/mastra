import { describe, expect, it } from 'vitest';
import { heapFlagRelaunchArgv } from './heap-flags.js';

const proc = (overrides: Partial<Parameters<typeof heapFlagRelaunchArgv>[0]> = {}) => ({
  execPath: '/usr/bin/node',
  execArgv: [],
  argv: ['/usr/bin/node', '/opt/mastracode/dist/cli.js', '--continue'],
  env: {},
  versions: { node: '24.0.0' } as NodeJS.ProcessVersions,
  ...overrides,
});

describe('heapFlagRelaunchArgv', () => {
  it('adds the heap flags ahead of existing node flags and keeps the script arguments', () => {
    expect(heapFlagRelaunchArgv(proc({ execArgv: ['--enable-source-maps'] }))).toEqual([
      '/usr/bin/node',
      '--max-semi-space-size=8',
      '--enable-source-maps',
      '/opt/mastracode/dist/cli.js',
      '--continue',
    ]);
  });

  it('does not restart once the flag is set, whether by us, the command line or NODE_OPTIONS', () => {
    expect(heapFlagRelaunchArgv(proc({ execArgv: ['--max-semi-space-size=8'] }))).toBeUndefined();
    expect(heapFlagRelaunchArgv(proc({ execArgv: ['--max-semi-space-size=32'] }))).toBeUndefined();
    expect(heapFlagRelaunchArgv(proc({ env: { NODE_OPTIONS: '--max-semi-space-size=2' } }))).toBeUndefined();
  });

  it('skips the restart when opted out or not running on Node', () => {
    expect(heapFlagRelaunchArgv(proc({ env: { MASTRACODE_NO_HEAP_FLAGS: '1' } }))).toBeUndefined();
    expect(
      heapFlagRelaunchArgv(proc({ versions: { node: '24.0.0', bun: '1.2.0' } as NodeJS.ProcessVersions })),
    ).toBeUndefined();
  });
});

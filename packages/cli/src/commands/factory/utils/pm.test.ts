import { describe, expect, it } from 'vitest';

import { getInstallArgs } from './pm.js';

describe('getInstallArgs', () => {
  it('keeps npm installs online while disabling audit and funding requests', () => {
    expect(getInstallArgs('npm')).toEqual(['install', '--no-audit', '--no-fund']);
  });

  it.each(['pnpm', 'yarn', 'bun'] as const)('keeps %s installs online', packageManager => {
    expect(getInstallArgs(packageManager)).toEqual(['install']);
  });
});

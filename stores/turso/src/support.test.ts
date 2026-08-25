import { describe, expect, it } from 'vitest';

import { getTursoDatabaseSupport } from './support';

describe('getTursoDatabaseSupport', () => {
  it.each([
    ['darwin', 'arm64', undefined],
    ['win32', 'x64', undefined],
    ['linux', 'x64', 'glibc'],
    ['linux', 'arm64', 'glibc'],
  ] as const)('supports %s/%s/%s', (platform, arch, linuxLibc) => {
    expect(getTursoDatabaseSupport({ platform, arch, linuxLibc })).toMatchObject({ supported: true, platform, arch });
  });

  it.each([
    ['darwin', 'x64', undefined],
    ['linux', 'x64', 'musl'],
    ['linux', 'arm64', 'unknown'],
    ['linux', 'ia32', 'glibc'],
    ['win32', 'arm64', undefined],
  ] as const)('rejects %s/%s/%s', (platform, arch, linuxLibc) => {
    expect(getTursoDatabaseSupport({ platform, arch, linuxLibc })).toMatchObject({
      supported: false,
      platform,
      arch,
      reason: expect.any(String),
    });
  });
});

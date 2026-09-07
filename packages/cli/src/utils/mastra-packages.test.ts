import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPackageInfo } from 'local-pkg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getMastraPackages } from './mastra-packages.js';

vi.mock('local-pkg', () => ({
  getPackageInfo: vi.fn(),
}));

const mockGetPackageInfo = vi.mocked(getPackageInfo);

describe('getMastraPackages', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'mastra-packages-'));
    mockGetPackageInfo.mockResolvedValue(undefined);
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('includes optional Mastra dependencies and filters unrelated packages', async () => {
    writeFileSync(
      join(rootDir, 'package.json'),
      JSON.stringify({
        optionalDependencies: {
          '@mastra/optional': '^1.0.0',
          mastra: '^1.0.0',
          unrelated: '^1.0.0',
        },
      }),
    );

    await expect(getMastraPackages(rootDir)).resolves.toEqual([
      { name: '@mastra/optional', version: '^1.0.0' },
      { name: 'mastra', version: '^1.0.0' },
    ]);
  });

  it('uses the optional dependency specification when package sections overlap', async () => {
    writeFileSync(
      join(rootDir, 'package.json'),
      JSON.stringify({
        dependencies: { '@mastra/core': '^1.0.0' },
        devDependencies: { '@mastra/core': '^2.0.0' },
        optionalDependencies: { '@mastra/core': '^3.0.0' },
      }),
    );

    await expect(getMastraPackages(rootDir)).resolves.toEqual([{ name: '@mastra/core', version: '^3.0.0' }]);
  });
});

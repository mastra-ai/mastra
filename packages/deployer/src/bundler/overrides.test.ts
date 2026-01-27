import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeJSON, ensureDir, remove } from 'fs-extra/esm';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTransformedOverrides } from './index';

describe('getTransformedOverrides', () => {
  let tempDir: string;
  let outputDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `mastra-test-${Date.now()}`);
    outputDir = join(tempDir, '.mastra', 'output');
    await ensureDir(tempDir);
    await ensureDir(outputDir);
  });

  afterEach(async () => {
    await remove(tempDir);
  });

  it('should read and transform pnpm overrides', async () => {
    await writeJSON(join(tempDir, 'package.json'), {
      name: 'test-project',
      pnpm: {
        overrides: {
          '@mastra/core': 'link:../../packages/core',
          lodash: '^4.17.21',
        },
      },
    });

    const result = await getTransformedOverrides(tempDir, outputDir);

    expect(result.pnpm?.overrides).toEqual({
      '@mastra/core': 'link:../../../../packages/core',
      lodash: '^4.17.21',
    });
    expect(result.overrides).toBeUndefined();
    expect(result.resolutions).toBeUndefined();
  });

  it('should read and transform npm overrides', async () => {
    await writeJSON(join(tempDir, 'package.json'), {
      name: 'test-project',
      overrides: {
        '@mastra/core': 'file:../packages/core',
        lodash: '^4.17.21',
      },
    });

    const result = await getTransformedOverrides(tempDir, outputDir);

    expect(result.overrides).toEqual({
      '@mastra/core': 'file:../../../packages/core',
      lodash: '^4.17.21',
    });
    expect(result.pnpm).toBeUndefined();
    expect(result.resolutions).toBeUndefined();
  });

  it('should read and transform yarn resolutions', async () => {
    await writeJSON(join(tempDir, 'package.json'), {
      name: 'test-project',
      resolutions: {
        '@mastra/core': 'portal:../packages/core',
        'react-dom': '18.2.0',
      },
    });

    const result = await getTransformedOverrides(tempDir, outputDir);

    expect(result.resolutions).toEqual({
      '@mastra/core': 'portal:../../../packages/core',
      'react-dom': '18.2.0',
    });
    expect(result.pnpm).toBeUndefined();
    expect(result.overrides).toBeUndefined();
  });

  it('should read and transform all override types when present', async () => {
    await writeJSON(join(tempDir, 'package.json'), {
      name: 'test-project',
      pnpm: {
        overrides: {
          '@mastra/core': 'link:../../packages/core',
        },
      },
      overrides: {
        lodash: 'file:../lodash-fork',
      },
      resolutions: {
        'react-dom': 'portal:../react-fork',
      },
    });

    const result = await getTransformedOverrides(tempDir, outputDir);

    expect(result.pnpm?.overrides).toEqual({
      '@mastra/core': 'link:../../../../packages/core',
    });
    expect(result.overrides).toEqual({
      lodash: 'file:../../../lodash-fork',
    });
    expect(result.resolutions).toEqual({
      'react-dom': 'portal:../../../react-fork',
    });
  });

  it('should return empty object when package.json does not exist', async () => {
    const result = await getTransformedOverrides(join(tempDir, 'nonexistent'), outputDir);
    expect(result).toEqual({});
  });

  it('should return empty object when no overrides are present', async () => {
    await writeJSON(join(tempDir, 'package.json'), {
      name: 'test-project',
      dependencies: {
        lodash: '^4.17.21',
      },
    });

    const result = await getTransformedOverrides(tempDir, outputDir);

    expect(result.pnpm).toBeUndefined();
    expect(result.overrides).toBeUndefined();
    expect(result.resolutions).toBeUndefined();
  });

  it('should pass through non-path overrides unchanged', async () => {
    await writeJSON(join(tempDir, 'package.json'), {
      name: 'test-project',
      pnpm: {
        overrides: {
          'workspace-pkg': 'workspace:*',
          'npm-alias': 'npm:@other/pkg@^1.0.0',
          'version-range': '^2.0.0',
          'exact-version': '1.0.0',
          'git-url': 'git+https://github.com/org/repo.git',
        },
      },
    });

    const result = await getTransformedOverrides(tempDir, outputDir);

    expect(result.pnpm?.overrides).toEqual({
      'workspace-pkg': 'workspace:*',
      'npm-alias': 'npm:@other/pkg@^1.0.0',
      'version-range': '^2.0.0',
      'exact-version': '1.0.0',
      'git-url': 'git+https://github.com/org/repo.git',
    });
  });

  it('should handle mixed path and non-path overrides', async () => {
    await writeJSON(join(tempDir, 'package.json'), {
      name: 'test-project',
      pnpm: {
        overrides: {
          'pkg-link': 'link:../pkg-link',
          'pkg-file': 'file:../pkg-file',
          'pkg-portal': 'portal:../pkg-portal',
          'pkg-version': '^2.0.0',
        },
      },
    });

    const result = await getTransformedOverrides(tempDir, outputDir);

    expect(result.pnpm?.overrides).toEqual({
      'pkg-link': 'link:../../../pkg-link',
      'pkg-file': 'file:../../../pkg-file',
      'pkg-portal': 'portal:../../../pkg-portal',
      'pkg-version': '^2.0.0',
    });
  });

  it('should leave absolute paths unchanged', async () => {
    await writeJSON(join(tempDir, 'package.json'), {
      name: 'test-project',
      pnpm: {
        overrides: {
          'pkg-absolute-link': 'link:/absolute/path/to/package',
          'pkg-absolute-file': 'file:/absolute/path/to/package',
          'pkg-relative-link': 'link:../relative/path',
        },
      },
    });

    const result = await getTransformedOverrides(tempDir, outputDir);

    expect(result.pnpm?.overrides).toEqual({
      'pkg-absolute-link': 'link:/absolute/path/to/package',
      'pkg-absolute-file': 'file:/absolute/path/to/package',
      'pkg-relative-link': 'link:../../../relative/path',
    });
  });
});

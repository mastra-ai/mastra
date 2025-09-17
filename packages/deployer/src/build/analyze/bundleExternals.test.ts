import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createVirtualDependencies, bundleExternals } from './bundleExternals';
import type { DependencyMetadata } from '../types';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import { tmpdir } from 'os';
import { join } from 'path';
import { ensureDir, remove, pathExists } from 'fs-extra';

// Mock the utilities that bundleExternals depends on
vi.mock('../utils', () => ({
  getCompiledDepCachePath: vi.fn((rootPath: string, fileName: string) =>
    join(rootPath, 'node_modules', '.cache', fileName),
  ),
  getPackageRootPath: vi.fn((pkg: string) => {
    if (pkg.startsWith('@workspace/')) return '/workspace/packages/' + pkg.split('/')[1];
    if (pkg === 'lodash') return '/node_modules/lodash';
    if (pkg === 'react') return '/node_modules/react';
    return null;
  }),
}));

vi.mock('../plugins/esbuild', () => ({
  esbuild: vi.fn(() => ({ name: 'esbuild-mock' })),
}));

vi.mock('../plugins/hono-alias', () => ({
  aliasHono: vi.fn(() => ({ name: 'hono-alias-mock' })),
}));

describe('createVirtualDependencies', () => {
  it('should handle named exports only', () => {
    const depsToOptimize = new Map<string, DependencyMetadata>([
      [
        'lodash',
        {
          exports: ['map', 'filter', 'reduce'],
          rootPath: '/node_modules/lodash',
          isWorkspace: false,
        },
      ],
    ]);

    const result = createVirtualDependencies(depsToOptimize, {
      workspaceRoot: null,
      projectRoot: '/',
      outputDir: '/.mastra/.build',
    });

    expect(result.fileNameToDependencyMap.get('.mastra/.build/lodash')).toBe('lodash');
    expect(result.optimizedDependencyEntries.get('lodash')).toEqual({
      name: '.mastra/.build/lodash',
      virtual: "export { map, filter, reduce } from 'lodash';",
    });
  });

  it('should handle default export only', () => {
    const depsToOptimize = new Map<string, DependencyMetadata>([
      [
        'react',
        {
          exports: ['default'],
          rootPath: '/node_modules/react',
          isWorkspace: false,
        },
      ],
    ]);

    const result = createVirtualDependencies(depsToOptimize, {
      workspaceRoot: null,
      projectRoot: '/',
      outputDir: '/.mastra/.build',
    });

    expect(result.fileNameToDependencyMap.get('.mastra/.build/react')).toBe('react');
    expect(result.optimizedDependencyEntries.get('react')).toEqual({
      name: '.mastra/.build/react',
      virtual: "export { default } from 'react';",
    });
  });

  it('should handle star export only', () => {
    const depsToOptimize = new Map<string, DependencyMetadata>([
      [
        '@types/node',
        {
          exports: ['*'],
          rootPath: '/node_modules/@types/node',
          isWorkspace: false,
        },
      ],
    ]);

    const result = createVirtualDependencies(depsToOptimize, {
      workspaceRoot: null,
      projectRoot: '/',
      outputDir: '/.mastra/.build',
    });

    expect(result.fileNameToDependencyMap.get('.mastra/.build/@types-node')).toBe('@types/node');
    expect(result.optimizedDependencyEntries.get('@types/node')).toEqual({
      name: '.mastra/.build/@types-node',
      virtual: "export * from '@types/node';",
    });
  });

  it('should handle mixed exports (named + default)', () => {
    const depsToOptimize = new Map<string, DependencyMetadata>([
      [
        'axios',
        {
          exports: ['default', 'AxiosError', 'AxiosResponse'],
          rootPath: '/node_modules/axios',
          isWorkspace: false,
        },
      ],
    ]);

    const result = createVirtualDependencies(depsToOptimize, {
      workspaceRoot: null,
      projectRoot: '/',
      outputDir: '/.mastra/.build',
    });

    expect(result.optimizedDependencyEntries.get('axios')).toEqual({
      name: '.mastra/.build/axios',
      virtual: "export { default, AxiosError, AxiosResponse } from 'axios';",
    });
  });

  it('should handle mixed exports (named + star)', () => {
    const depsToOptimize = new Map<string, DependencyMetadata>([
      [
        'utils-lib',
        {
          exports: ['*', 'specificUtil', 'anotherUtil'],
          rootPath: '/node_modules/utils-lib',
          isWorkspace: false,
        },
      ],
    ]);

    const result = createVirtualDependencies(depsToOptimize, {
      workspaceRoot: null,
      projectRoot: '/',
      outputDir: '/.mastra/.build',
    });

    expect(result.optimizedDependencyEntries.get('utils-lib')).toEqual({
      name: '.mastra/.build/utils-lib',
      virtual: `export * from 'utils-lib';
export { specificUtil, anotherUtil } from 'utils-lib';`,
    });
  });

  it('should handle mixed exports (default + star)', () => {
    const depsToOptimize = new Map<string, DependencyMetadata>([
      [
        'full-lib',
        {
          exports: ['*', 'default'],
          rootPath: '/node_modules/full-lib',
          isWorkspace: false,
        },
      ],
    ]);

    const result = createVirtualDependencies(depsToOptimize, {
      workspaceRoot: null,
      projectRoot: '/',
      outputDir: '/.mastra/.build',
    });

    expect(result.optimizedDependencyEntries.get('full-lib')).toEqual({
      name: '.mastra/.build/full-lib',
      virtual: `export * from 'full-lib';
export { default } from 'full-lib';`,
    });
  });

  it('should handle all export types together', () => {
    const depsToOptimize = new Map<string, DependencyMetadata>([
      [
        'complete-lib',
        {
          exports: ['*', 'default', 'namedExport1', 'namedExport2'],
          rootPath: '/node_modules/complete-lib',
          isWorkspace: false,
        },
      ],
    ]);

    const result = createVirtualDependencies(depsToOptimize, {
      workspaceRoot: null,
      projectRoot: '/',
      outputDir: '/.mastra/.build',
    });

    expect(result.optimizedDependencyEntries.get('complete-lib')).toEqual({
      name: '.mastra/.build/complete-lib',
      virtual: "export * from 'complete-lib';\nexport { default, namedExport1, namedExport2 } from 'complete-lib';",
    });
  });

  it('should handle scoped package names by replacing slashes with dashes', () => {
    const depsToOptimize = new Map<string, DependencyMetadata>([
      [
        '@scope/package',
        {
          exports: ['someExport'],
          rootPath: '/node_modules/@scope/package',
          isWorkspace: false,
        },
      ],
      [
        '@another/deeply/nested/package',
        {
          exports: ['anotherExport'],
          rootPath: '/node_modules/@another/deeply/nested/package',
          isWorkspace: false,
        },
      ],
    ]);

    const result = createVirtualDependencies(depsToOptimize, {
      workspaceRoot: null,
      projectRoot: '/',
      outputDir: '/.mastra/.build',
    });

    expect(result.fileNameToDependencyMap.get('.mastra/.build/@scope-package')).toBe('@scope/package');
    expect(result.fileNameToDependencyMap.get('.mastra/.build/@another-deeply-nested-package')).toBe(
      '@another/deeply/nested/package',
    );

    expect(result.optimizedDependencyEntries.get('@scope/package')).toEqual({
      name: '.mastra/.build/@scope-package',
      virtual: "export { someExport } from '@scope/package';",
    });
  });

  it('should handle multiple dependencies', () => {
    const depsToOptimize = new Map<string, DependencyMetadata>([
      [
        'lodash',
        {
          exports: ['map', 'filter'],
          rootPath: '/node_modules/lodash',
          isWorkspace: false,
        },
      ],
      [
        'react',
        {
          exports: ['default'],
          rootPath: '/node_modules/react',
          isWorkspace: false,
        },
      ],
      [
        '@types/node',
        {
          exports: ['*'],
          rootPath: '/node_modules/@types/node',
          isWorkspace: false,
        },
      ],
    ]);

    const result = createVirtualDependencies(depsToOptimize, {
      workspaceRoot: null,
      projectRoot: '/',
      outputDir: '/.mastra/.build',
    });

    expect(result.fileNameToDependencyMap.size).toBe(3);
    expect(result.optimizedDependencyEntries.size).toBe(3);

    expect(result.optimizedDependencyEntries.get('lodash')?.virtual).toBe("export { map, filter } from 'lodash';");
    expect(result.optimizedDependencyEntries.get('react')?.virtual).toBe("export { default } from 'react';");
    expect(result.optimizedDependencyEntries.get('@types/node')?.virtual).toBe("export * from '@types/node';");
  });

  it('should handle empty exports array', () => {
    const depsToOptimize = new Map<string, DependencyMetadata>([]);

    const result = createVirtualDependencies(depsToOptimize, {
      workspaceRoot: null,
      projectRoot: '/',
      outputDir: '/.mastra/.build',
    });

    expect(result.fileNameToDependencyMap.get('empty-lib')).toBeUndefined();
    expect(result.optimizedDependencyEntries.get('empty-lib')).toBeUndefined();
  });

  it('should handle workspace packages', () => {
    const depsToOptimize = new Map<string, DependencyMetadata>([
      [
        '@workspace/internal-lib',
        {
          exports: ['internalUtil', 'default'],
          rootPath: '/workspace/packages/internal-lib',
          isWorkspace: true,
        },
      ],
    ]);

    const result = createVirtualDependencies(depsToOptimize, {
      workspaceRoot: '/workspace',
      projectRoot: '/workspace/app',
      outputDir: '/workspace/app/.mastra/.build',
    });

    const compiledDepCachePath = `packages/internal-lib/node_modules/.cache/@workspace-internal-lib`;
    expect(result.fileNameToDependencyMap.get(compiledDepCachePath)).toBe('@workspace/internal-lib');
    expect(result.optimizedDependencyEntries.get('@workspace/internal-lib')).toEqual({
      name: compiledDepCachePath,
      virtual: "export { internalUtil, default } from '@workspace/internal-lib';",
    });
  });
});

describe('bundleExternals', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), 'bundleExternals-test-' + Date.now());
    await ensureDir(testDir);
  });

  afterEach(async () => {
    if (await pathExists(testDir)) {
      await remove(testDir);
    }
  });

  it('should bundle dependencies and return correct structure', async () => {
    const depsToOptimize = new Map<string, DependencyMetadata>([
      [
        'lodash',
        {
          exports: ['map', 'filter'],
          rootPath: '/node_modules/lodash',
          isWorkspace: false,
        },
      ],
    ]);

    const result = await bundleExternals(depsToOptimize, testDir, {
      projectRoot: testDir,
    });

    // Verify return structure
    expect(result).toHaveProperty('output');
    expect(result).toHaveProperty('fileNameToDependencyMap');
    expect(result).toHaveProperty('usedExternals');

    // Verify output is an array of Rollup output chunks
    expect(Array.isArray(result.output)).toBe(true);
    expect(result.output.length).toBe(1);

    // Verify file mapping - the key format depends on the internal logic
    expect(result.fileNameToDependencyMap).toBeInstanceOf(Map);
    expect(result.fileNameToDependencyMap.size).toBe(1);
    const mappingEntries = Array.from(result.fileNameToDependencyMap.entries());
    expect(mappingEntries[0][1]).toBe('lodash');

    // Verify usedExternals is a plain object
    expect(typeof result.usedExternals).toBe('object');
    expect(result.usedExternals).not.toBeInstanceOf(Map);
  });

  it('should handle different bundler options configurations', async () => {
    const depsToOptimize = new Map<string, DependencyMetadata>([
      [
        'react',
        {
          exports: ['default', 'useState'],
          rootPath: '/node_modules/react',
          isWorkspace: false,
        },
      ],
    ]);

    // Test with custom externals and transpilePackages
    const result = await bundleExternals(depsToOptimize, testDir, {
      projectRoot: testDir,
      bundlerOptions: {
        externals: ['custom-external'],
        transpilePackages: ['some-package'],
        isDev: true,
      },
    });

    expect(result.output).toBeDefined();
    expect(result.fileNameToDependencyMap.size).toBe(1);
    expect(Array.from(result.fileNameToDependencyMap.values())[0]).toBe('react');

    // Test with minimal options
    const result2 = await bundleExternals(depsToOptimize, testDir, {});

    expect(result2.output).toBeDefined();
    expect(result2.fileNameToDependencyMap).toBeInstanceOf(Map);
    expect(result2.fileNameToDependencyMap.size).toBe(1);
  });

  it('should handle workspace packages correctly', async () => {
    const workspaceMap = new Map<string, WorkspacePackageInfo>([
      [
        '@workspace/utils',
        {
          location: join(testDir, 'packages', 'utils'),
          dependencies: {},
          version: '1.0.0',
        },
      ],
    ]);

    const depsToOptimize = new Map<string, DependencyMetadata>([
      [
        '@workspace/utils',
        {
          exports: ['helper', 'default'],
          rootPath: join(testDir, 'packages', 'utils'),
          isWorkspace: true,
        },
      ],
      [
        'lodash',
        {
          exports: ['map'],
          rootPath: '/node_modules/lodash',
          isWorkspace: false,
        },
      ],
    ]);

    const result = await bundleExternals(depsToOptimize, testDir, {
      workspaceRoot: testDir,
      projectRoot: join(testDir, 'app'),
      workspaceMap,
      bundlerOptions: {
        isDev: true,
      },
    });

    expect(result.output).toBeDefined();
    expect(result.fileNameToDependencyMap).toBeInstanceOf(Map);
    expect(result.fileNameToDependencyMap.size).toBe(3);

    // Check that both workspace and external packages are handled
    const dependencyValues = Array.from(result.fileNameToDependencyMap.values());
    expect(dependencyValues).toContain('@workspace/utils');
    expect(dependencyValues).toContain('lodash');
  });

  it('should validate output structure and file patterns', async () => {
    const depsToOptimize = new Map<string, DependencyMetadata>([
      [
        '@scoped/package',
        {
          exports: ['namedExport'],
          rootPath: '/node_modules/@scoped/package',
          isWorkspace: false,
        },
      ],
      [
        'regular-package',
        {
          exports: ['*'],
          rootPath: '/node_modules/regular-package',
          isWorkspace: false,
        },
      ],
    ]);

    const result = await bundleExternals(depsToOptimize, testDir, {
      projectRoot: testDir,
    });

    // Validate all output chunks have .mjs extension
    const chunks = result.output.filter(o => o.type === 'chunk');
    chunks.forEach(chunk => {
      expect(chunk.fileName).toMatch(/\.mjs$/);
    });

    // Validate file mapping structure - check values instead of specific keys
    const mappingValues = Array.from(result.fileNameToDependencyMap.values());
    expect(mappingValues).toContain('@scoped/package');
    expect(mappingValues).toContain('regular-package');
    expect(result.fileNameToDependencyMap.size).toBe(2);
  });

  it('should handle edge cases gracefully', async () => {
    // Test with dependency that has no root path
    const depsWithNullPath = new Map<string, DependencyMetadata>([
      [
        'unknown-package',
        {
          exports: ['something'],
          rootPath: null,
          isWorkspace: false,
        },
      ],
    ]);

    const nullPathResult = await bundleExternals(depsWithNullPath, testDir, {
      projectRoot: testDir,
    });

    expect(nullPathResult.output).toBeDefined();
    expect(nullPathResult.fileNameToDependencyMap.size).toBe(1);
    expect(Array.from(nullPathResult.fileNameToDependencyMap.values())[0]).toBe('unknown-package');

    // Test with mixed workspace and non-workspace dependencies using testDir
    const mixedDeps = new Map<string, DependencyMetadata>([
      [
        'external-lib',
        {
          exports: ['default'],
          rootPath: '/node_modules/external-lib',
          isWorkspace: false,
        },
      ],
    ]);

    const mixedResult = await bundleExternals(mixedDeps, testDir, {
      workspaceRoot: testDir,
      projectRoot: join(testDir, 'app'),
      workspaceMap: new Map([
        [
          '@workspace/internal',
          {
            location: join(testDir, 'packages', 'internal'),
            dependencies: {},
            version: '1.0.0',
          },
        ],
      ]),
    });

    expect(mixedResult.output).toBeDefined();
    expect(mixedResult.fileNameToDependencyMap.size).toBe(1);

    // Test bundler options structure validation
    const optionsTestResult = await bundleExternals(
      new Map([['test-pkg', { exports: ['test'], rootPath: null, isWorkspace: false }]]),
      testDir,
      {
        bundlerOptions: {
          externals: ['test'],
          transpilePackages: ['pkg'],
          isDev: false,
        },
      },
    );

    expect(optionsTestResult.output).toBeDefined();
  });
});

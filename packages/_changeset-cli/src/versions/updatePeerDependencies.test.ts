import { PnpmTool } from '@manypkg/tools';
import { describe, it, expect, vi } from 'vitest';
import type { VersionBumps } from '../types.js';
import { updatePeerDependencies } from './updatePeerDependencies.js';

const packages = {
  '@mastra/core': {
    packageJson: {
      name: '@mastra/core',
      version: '0.20.1',
    },
    dir: '/packages/core',
    relativeDir: 'packages/core',
  },
  '@mastra/server': {
    packageJson: {
      name: '@mastra/server',
      version: '0.20.1',
      peerDependencies: {
        '@mastra/core': '>=0.20.0-0 <0.21.0-0',
      },
    },
    dir: '/packages/server',
    relativeDir: 'packages/server',
  },
  '@mastra/memory': {
    packageJson: {
      name: '@mastra/memory',
      version: '0.10.0',
      peerDependencies: {
        '@mastra/core': '>=0.20.0-0 <0.21.0-0',
      },
    },
    dir: '/packages/memory',
    relativeDir: 'packages/memory',
  },
  '@mastra/standalone': {
    packageJson: {
      name: '@mastra/standalone',
      version: '0.1.0',
    },
    dir: '/packages/standalone',
    relativeDir: 'packages/standalone',
  },
};

vi.mock('@clack/prompts', () => {
  return {
    spinner: () => {
      return {
        start: () => {},
        stop: () => {},
      };
    },
  };
});

vi.mock('@manypkg/get-packages', () => {
  return {
    getPackages: () => {
      return {
        tool: PnpmTool,
        packages: Array.from(Object.values(packages)),
        rootPackage: {
          dir: '/',
          relativeDir: '.',
          packageJson: {
            name: '@mastra/monorepo',
            version: '0.0.0',
          },
        },
        rootDir: '/',
      };
    },
  };
});
vi.mock('../pkg/getPackageJson.js', () => {
  return {
    getPackageJson: dir => {
      return Array.from(Object.values(packages)).find(pkg => pkg.relativeDir === dir);
    },
  };
});
vi.mock('@changesets/config', () => {
  return {
    read: () => {
      return {
        access: 'public',
        commit: false,
        fixed: [['@mastra/core', '@mastra/server']],
        ignore: [],
        linked: [],
        baseBranch: 'main',
        changedFilePatterns: ['**'],
        updateInternalDependencies: 'patch',
        bumpVersionsWithWorkspaceProtocolOnly: true,
        snapshot: { prereleaseTemplate: null, useCalculatedVersion: false },
        ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
          onlyUpdatePeerDependentsWhenOutOfRange: false,
          updateInternalDependents: 'out-of-range',
        },
        prettier: true,
        privatePackages: { version: false, tag: false },
      };
    },
  };
});
vi.mock('fs');
vi.mock('node:fs');
vi.mock('@changesets/write');

describe('updatePeerDependencies', () => {
  it('should update all packages when core got bumped to minor', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/core': 'minor',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual([]);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual(['@mastra/server', '@mastra/memory']);
  });

  it('should update only direct packages when core got bumped to patch', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/core': 'patch',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual([]);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual([]);
  });

  it('should update "@mastra/memory" when "@mastra/server" got bumped to minor', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/server': 'minor',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual([]);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual(['@mastra/server', '@mastra/memory']);
  });

  it('should update nothing when "@mastra/server" version got bumped to patch', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/server': 'patch',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual([]);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual([]);
  });

  it('should update nothing when "@mastra/memory" version got bumped to minor', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/memory': 'minor',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual([]);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual([]);
  });

  it('should update nothing when "@mastra/memory" version got bumped to patch', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/memory': 'patch',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual([]);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual([]);
  });

  it('should update all packages when core & server got bumped to minor', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/core': 'minor',
      '@mastra/server': 'minor',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual(['@mastra/server']);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual(['@mastra/memory']);
  });

  it('should update only direct packages when core & server got bumped to patch', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/core': 'patch',
      '@mastra/server': 'patch',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual(['@mastra/server']);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual([]);
  });
});

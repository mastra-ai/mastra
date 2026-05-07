import { PnpmTool } from '@manypkg/tools';
import { describe, it, expect, vi } from 'vitest';
import type { VersionBumps } from '../types.js';
import { updatePeerDependencies } from './updatePeerDependencies.js';

const packages = {
  '@mastra/core': {
    packageJson: {
      name: '@mastra/core',
      version: '1.2.1',
    },
    dir: '/packages/core',
    relativeDir: 'packages/core',
  },
  '@mastra/server': {
    packageJson: {
      name: '@mastra/server',
      version: '1.2.1',
      peerDependencies: {
        '@mastra/core': '>=1.0.0-0 <2.0.0-0',
      },
    },
    dir: '/packages/server',
    relativeDir: 'packages/server',
  },
  '@mastra/memory': {
    packageJson: {
      name: '@mastra/memory',
      version: '1.0.0',
      peerDependencies: {
        '@mastra/core': '>=1.0.0-0 <2.0.0-0',
      },
    },
    dir: '/packages/memory',
    relativeDir: 'packages/memory',
  },
  '@mastra/standalone': {
    packageJson: {
      name: '@mastra/standalone',
      version: '1.1.0',
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
  it('should update nothing when core got bumped to minor', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/core': 'minor',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual([]);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual([]);
  });

  it('should update nothing when core got bumped to patch', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/core': 'patch',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual([]);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual([]);
  });

  it('should update nothing when "@mastra/server" got bumped to minor', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/server': 'minor',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual([]);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual([]);
  });

  it('should update nothing when "@mastra/server" got bumped to patch', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/server': 'patch',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual([]);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual([]);
  });

  it('should update nothing when "@mastra/memory" got bumped to minor', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/memory': 'minor',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual([]);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual([]);
  });

  it('should update nothing when "@mastra/memory" got bumped to patch', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/memory': 'patch',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual([]);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual([]);
  });

  it('should update all packages when core got bumped to major', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/core': 'major',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual([]);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual(['@mastra/server', '@mastra/memory']);
  });

  it('should update all packages when core & server got bumped to major', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/core': 'major',
      '@mastra/server': 'major',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual(['@mastra/server']);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual(['@mastra/memory']);
  });

  it('should update nothing when core & server got bumped to minor', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/core': 'minor',
      '@mastra/server': 'minor',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual([]);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual([]);
  });

  it('should update nothing when core & server got bumped to patch', async () => {
    const versionBumps: VersionBumps = {
      '@mastra/core': 'patch',
      '@mastra/server': 'patch',
    };
    const updatedPeerDeps = await updatePeerDependencies(versionBumps);

    expect(updatedPeerDeps.directUpdatedPackages).toEqual([]);
    expect(updatedPeerDeps.indirectUpdatedPackages).toEqual([]);
  });
});

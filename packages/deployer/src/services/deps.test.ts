import { describe, expect, it } from 'vitest';
import { copyPnpmWorkspaceSettings, extractPnpmPatchedDependencies } from './deps';

describe('copyPnpmWorkspaceSettings', () => {
  it('copies pnpm install policy without copying source workspace packages', () => {
    const output = copyPnpmWorkspaceSettings(
      `packages:\n  - packages/*\n\ncatalog:\n  react: ^19.0.0\n\nminimumReleaseAge: 1440\nminimumReleaseAgeExclude:\n  - '@mastra/*'\n\nallowBuilds:\n  onnxruntime-node: false\n  node-pty: true\n\npatchedDependencies:\n  foo@1.0.0: patches/foo.patch\n`,
    );

    expect(output).toBe(
      `packages:\n  - '.'\n\nminimumReleaseAge: 1440\n\nminimumReleaseAgeExclude:\n  - '@mastra/*'\n\nallowBuilds:\n  onnxruntime-node: false\n  node-pty: true\n`,
    );
  });

  it('uses requested architecture over source supportedArchitectures', () => {
    const output = copyPnpmWorkspaceSettings(
      `packages:\n  - packages/*\n\nsupportedArchitectures:\n  os: [\"linux\"]\n`,
      { os: ['darwin'], cpu: ['arm64'] },
    );

    expect(output).toBe(`packages:\n  - '.'\n\nsupportedArchitectures:\n  os: [\"darwin\"]\n  cpu: [\"arm64\"]\n`);
  });

  it('emits provided patchedDependencies with allowUnusedPatches', () => {
    const output = copyPnpmWorkspaceSettings(`packages:\n  - packages/*\n`, {
      patchedDependencies: {
        'foo@1.0.0': 'patches/foo.patch',
        '@scope/bar@2.3.4': 'patches/scope_bar.patch',
      },
    });

    expect(output).toBe(
      `packages:\n  - '.'\n\npatchedDependencies:\n  'foo@1.0.0': patches/foo.patch\n  '@scope/bar@2.3.4': patches/scope_bar.patch\n\nallowUnusedPatches: true\n`,
    );
  });

  it('does not emit a patchedDependencies block when none are provided', () => {
    const output = copyPnpmWorkspaceSettings(
      `packages:\n  - packages/*\n\npatchedDependencies:\n  foo@1.0.0: patches/foo.patch\n`,
    );

    expect(output).toBe(`packages:\n  - '.'\n`);
    expect(output).not.toContain('patchedDependencies');
    expect(output).not.toContain('allowUnusedPatches');
  });
});

describe('extractPnpmPatchedDependencies', () => {
  it('parses unquoted and quoted (scoped) specs', () => {
    const patches = extractPnpmPatchedDependencies(
      `packages:\n  - packages/*\n\npatchedDependencies:\n  foo@1.0.0: patches/foo.patch\n  '@scope/bar@2.3.4': ../../patches/@scope__bar@2.3.4.patch\n\nallowBuilds:\n  esbuild: true\n`,
    );

    expect(patches).toEqual({
      'foo@1.0.0': 'patches/foo.patch',
      '@scope/bar@2.3.4': '../../patches/@scope__bar@2.3.4.patch',
    });
  });

  it('returns an empty object when there is no patchedDependencies block', () => {
    expect(extractPnpmPatchedDependencies(`packages:\n  - packages/*\n`)).toEqual({});
  });

  it('strips quotes from both keys and values', () => {
    const patches = extractPnpmPatchedDependencies(`patchedDependencies:\n  "foo@1.0.0": "patches/foo.patch"\n`);

    expect(patches).toEqual({ 'foo@1.0.0': 'patches/foo.patch' });
  });
});

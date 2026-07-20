import { describe, expect, it } from 'vitest';
import { copyPnpmWorkspaceSettings } from './deps';

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

  it('writes workspace dependency overrides for pnpm installs', () => {
    const output = copyPnpmWorkspaceSettings('', {
      pnpmOverrides: {
        '@inner/transitive-c': 'file:./workspace-module/inner-transitive-c-1.0.0.tgz',
      },
    });

    expect(output).toBe(
      `packages:\n  - '.'\n\noverrides:\n  \"@inner/transitive-c\": \"file:./workspace-module/inner-transitive-c-1.0.0.tgz\"\n`,
    );
  });
});

import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const { mockInstall, mockSetLogger } = vi.hoisted(() => ({
  mockInstall: vi.fn(async () => undefined),
  mockSetLogger: vi.fn(),
}));

vi.mock('@mastra/deployer', () => ({
  Deployer: class {
    outputDir = 'output';
    logger = {};
  },
}));

vi.mock('@mastra/deployer/services', () => ({
  DepsService: class {
    __setLogger = mockSetLogger;
    install = mockInstall;
  },
}));

import { NetlifyDeployer } from './index';

const state = {
  packageManager: 'pnpm' as const,
  frozen: true,
  generateSecondaryNpmLockfile: false,
};

describe('NetlifyDeployer dependency routing', () => {
  it('preserves serverless architecture constraints while forwarding install state', async () => {
    const deployer = new NetlifyDeployer({ target: 'serverless' });

    await (deployer as any).installDependencies('/test/output', '/test/project', { foo: 'bar' }, state);

    expect(mockInstall).toHaveBeenCalledWith({
      dir: join('/test/output', '.netlify', 'v1', 'functions', 'api'),
      pnpmOverrides: { foo: 'bar' },
      installState: state,
      architecture: { os: ['linux'], cpu: ['x64'], libc: ['gnu'] },
    });
  });

  it('preserves the edge path without serverless architecture constraints', async () => {
    const deployer = new NetlifyDeployer({ target: 'edge' });

    await (deployer as any).installDependencies('/test/output', '/test/project', undefined, state);

    expect(mockInstall).toHaveBeenCalledWith({
      dir: join('/test/output', '.netlify', 'v1', 'edge-functions'),
      pnpmOverrides: undefined,
      installState: state,
    });
  });
});

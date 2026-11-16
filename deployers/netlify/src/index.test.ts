import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import type { BundlerConfig } from '@mastra/core/bundler';
import { afterEach, expect, it, vi } from 'vitest';
import { NetlifyDeployer } from './index';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => {
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() });
    process.nextTick(() => child.emit('close', 0));
    return child;
  }),
}));

class InstallableNetlifyDeployer extends NetlifyDeployer {
  install(
    output: string,
    root: string,
    overrides: Record<string, string>,
    settings: BundlerConfig['pnpmWorkspaceSettings'],
  ) {
    return this.installDependencies(output, root, overrides, settings);
  }
}

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

it.each(['edge', 'serverless'] as const)(
  'preserves explicit pnpm policy and packed dependency overrides for %s deployments',
  async target => {
    const root = await mkdtemp(join(tmpdir(), 'mastra-netlify-pnpm-'));
    directories.push(root);
    const output = join(root, 'deployment');
    const workspaceDir = join(output, '.netlify', 'v1', target === 'edge' ? 'edge-functions' : 'functions/api');
    await mkdir(workspaceDir, { recursive: true });
    await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'minimumReleaseAge: 1440\n');
    await writeFile(join(workspaceDir, 'package.json'), '{"name":"deployment"}');

    await new InstallableNetlifyDeployer({ target }).install(
      output,
      root,
      { 'workspace-dependency': 'file:./workspace-module/dependency.tgz' },
      { blockExoticSubdeps: false, minimumReleaseAge: 0 },
    );

    const workspace = await readFile(join(workspaceDir, 'pnpm-workspace.yaml'), 'utf8');
    expect(workspace).toContain('blockExoticSubdeps: false');
    expect(workspace).toContain('minimumReleaseAge: 0');
    expect(workspace).not.toContain('minimumReleaseAge: 1440');
    expect(workspace).toContain('"workspace-dependency": "file:./workspace-module/dependency.tgz"');
    if (target === 'serverless') {
      expect(workspace).toContain('supportedArchitectures:');
      expect(workspace).toContain('os: ["linux"]');
      expect(workspace).toContain('cpu: ["x64"]');
      expect(workspace).toContain('libc: ["gnu"]');
    } else {
      expect(workspace).not.toContain('supportedArchitectures:');
    }
  },
);

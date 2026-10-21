import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import type { BundlerConfig } from '@mastra/core/bundler';
import { afterEach, expect, it, vi } from 'vitest';
import { ExperimentBundler } from './ExperimentBundler';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => {
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() });
    process.nextTick(() => child.emit('close', 0));
    return child;
  }),
}));

class InstallableExperimentBundler extends ExperimentBundler {
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

it('preserves explicit pnpm policy and packed dependency overrides in experiment worker installs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mastra-experiment-pnpm-'));
  directories.push(root);
  const output = join(root, 'worker');
  await mkdir(join(output, 'node_modules'), { recursive: true });
  await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  await writeFile(join(root, 'pnpm-workspace.yaml'), 'minimumReleaseAge: 1440\n');
  await writeFile(join(output, 'package.json'), '{"name":"worker"}');
  await writeFile(join(output, 'node_modules', '.modules.yaml'), 'virtualStoreDir: /build-machine/store\n');

  await new InstallableExperimentBundler().install(
    output,
    root,
    { 'workspace-dependency': 'file:./workspace-module/dependency.tgz' },
    { blockExoticSubdeps: false, minimumReleaseAge: 0 },
  );

  const workspace = await readFile(join(output, 'pnpm-workspace.yaml'), 'utf8');
  expect(workspace).toContain('blockExoticSubdeps: false');
  expect(workspace).toContain('minimumReleaseAge: 0');
  expect(workspace).not.toContain('minimumReleaseAge: 1440');
  expect(workspace).toContain('"workspace-dependency": "file:./workspace-module/dependency.tgz"');
  expect(workspace).toContain('nodeLinker: hoisted');
  await expect(readFile(join(output, 'node_modules', '.modules.yaml'))).rejects.toMatchObject({ code: 'ENOENT' });
});

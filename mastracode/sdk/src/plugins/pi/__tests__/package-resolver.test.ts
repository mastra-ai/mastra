import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const execaMock = vi.hoisted(() => vi.fn());
vi.mock('execa', () => ({ execa: execaMock }));

import { resolvePiPackageSource } from '../package-resolver.js';

let tempDir: string | undefined;

afterEach(() => {
  vi.clearAllMocks();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

function makeOptions() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-resolver-'));
  tempDir = root;
  return { projectRoot: path.join(root, 'project'), homeDir: path.join(root, 'home') };
}

describe('resolvePiPackageSource', () => {
  it('resolves npm metadata to an exact version, verifies integrity, and materializes without scripts', async () => {
    const options = makeOptions();
    const archive = Buffer.from('fixture archive');
    const integrity = `sha512-${createHash('sha512').update(archive).digest('base64')}`;
    execaMock.mockImplementation((command: string, args: string[]) => {
      if (command === 'npm' && args[0] === 'view') {
        return Promise.resolve({
          stdout: JSON.stringify({ name: 'pi-fixture', version: '1.2.3', 'dist.integrity': integrity }),
        });
      }
      if (command === 'npm' && args[0] === 'pack') {
        const destination = args.at(-1)!;
        fs.writeFileSync(path.join(destination, 'pi-fixture-1.2.3.tgz'), archive);
        return Promise.resolve({ stdout: JSON.stringify([{ filename: 'pi-fixture-1.2.3.tgz' }]) });
      }
      if (command === 'tar' && args[0] === '-tzf') {
        return Promise.resolve({ stdout: 'package/package.json\npackage/index.ts\n' });
      }
      if (command === 'tar' && args[0] === '-tvzf') {
        return Promise.resolve({ stdout: '-rw-r--r-- package/package.json\n-rw-r--r-- package/index.ts\n' });
      }
      if (command === 'tar' && args[0] === '-xzf') {
        const destination = args.at(-1)!;
        fs.writeFileSync(
          path.join(destination, 'package.json'),
          JSON.stringify({ name: 'pi-fixture', version: '1.2.3', pi: { extensions: ['./index.ts'] } }),
        );
        fs.writeFileSync(path.join(destination, 'index.ts'), 'export default () => {}');
        return Promise.resolve({ stdout: '' });
      }
      throw new Error(`unexpected command: ${command} ${args.join(' ')}`);
    });

    const prepared = await resolvePiPackageSource('npm:pi-fixture@1.2.3', 'global', options);

    expect(prepared.resolution).toMatchObject({
      sourceType: 'npm',
      resolvedSpecifier: 'npm:pi-fixture@1.2.3',
      integrity,
      version: '1.2.3',
    });
    expect(fs.existsSync(path.join(prepared.resolution.packageRoot, 'index.ts'))).toBe(true);
    expect(execaMock).toHaveBeenCalledWith(
      'npm',
      expect.arrayContaining(['pack', 'pi-fixture@1.2.3', '--ignore-scripts']),
      expect.objectContaining({ env: expect.objectContaining({ npm_config_ignore_scripts: 'true' }) }),
    );

    fs.writeFileSync(path.join(prepared.resolution.packageRoot, 'package.json'), '{"name":"tampered"}');
    await expect(resolvePiPackageSource('npm:pi-fixture@1.2.3', 'global', options)).rejects.toThrow(
      'Cached Pi Package integrity mismatch',
    );
  });

  it('rejects npm archives containing links before extraction', async () => {
    const options = makeOptions();
    const archive = Buffer.from('linked archive');
    const integrity = `sha512-${createHash('sha512').update(archive).digest('base64')}`;
    execaMock.mockImplementation((command: string, args: string[]) => {
      if (command === 'npm' && args[0] === 'view') {
        return Promise.resolve({
          stdout: JSON.stringify({ name: 'pi-linked', version: '1.0.0', 'dist.integrity': integrity }),
        });
      }
      if (command === 'npm' && args[0] === 'pack') {
        const destination = args.at(-1)!;
        fs.writeFileSync(path.join(destination, 'pi-linked-1.0.0.tgz'), archive);
        return Promise.resolve({ stdout: JSON.stringify([{ filename: 'pi-linked-1.0.0.tgz' }]) });
      }
      if (command === 'tar' && args[0] === '-tzf') {
        return Promise.resolve({ stdout: 'package/package.json\npackage/link.ts\n' });
      }
      if (command === 'tar' && args[0] === '-tvzf') {
        return Promise.resolve({
          stdout: '-rw-r--r-- package/package.json\nlrwxr-xr-x package/link.ts -> ../../outside\n',
        });
      }
      throw new Error(`unexpected command: ${command} ${args.join(' ')}`);
    });

    await expect(resolvePiPackageSource('npm:pi-linked@1.0.0', 'global', options)).rejects.toThrow(
      'cannot contain symbolic or hard links',
    );
    expect(execaMock.mock.calls.some(([, args]) => (args as string[])[0] === '-xzf')).toBe(false);
  });

  it('rejects mutable npm tags and ranges before resolution', async () => {
    const options = makeOptions();

    await expect(resolvePiPackageSource('npm:pi-fixture@latest', 'global', options)).rejects.toThrow(
      'exact name@version',
    );
    await expect(resolvePiPackageSource('npm:@scope/pi-fixture@^1.0.0', 'global', options)).rejects.toThrow(
      'exact name@version',
    );
    expect(execaMock).not.toHaveBeenCalled();
  });

  it('rejects project-scoped local sources outside the project directory', async () => {
    const options = makeOptions();
    const outsideRoot = path.join(path.dirname(options.projectRoot), 'outside');
    fs.mkdirSync(options.projectRoot, { recursive: true });
    fs.mkdirSync(outsideRoot, { recursive: true });
    fs.writeFileSync(path.join(outsideRoot, 'package.json'), JSON.stringify({ name: 'outside', version: '1.0.0' }));

    await expect(resolvePiPackageSource(outsideRoot, 'project', options)).rejects.toThrow(
      'must be inside the project directory',
    );
  });

  it('resolves a git ref to an immutable commit', async () => {
    const options = makeOptions();
    const commit = 'a'.repeat(40);
    execaMock.mockImplementation((command: string, args: string[]) => {
      if (command !== 'git') throw new Error('unexpected command');
      if (args[0] === 'clone') {
        const checkout = args.at(-1)!;
        fs.mkdirSync(checkout, { recursive: true });
        fs.writeFileSync(
          path.join(checkout, 'package.json'),
          JSON.stringify({ name: 'git-fixture', pi: { extensions: ['./index.ts'] } }),
        );
        fs.writeFileSync(path.join(checkout, 'index.ts'), 'export default () => {}');
      }
      return Promise.resolve({ stdout: args.includes('rev-parse') ? commit : '' });
    });

    const prepared = await resolvePiPackageSource('github:acme/pi-fixture@v1', 'project', options);

    expect(prepared.resolution).toMatchObject({
      sourceType: 'git',
      resolvedSpecifier: `git:https://github.com/acme/pi-fixture.git@${commit}`,
      commit,
    });
    expect(prepared.resolution.integrity).toMatch(/^sha512-/);
  });

  it('rejects credential-bearing git URLs before clone', async () => {
    const options = makeOptions();

    await expect(
      resolvePiPackageSource('https://user:secret@github.com/acme/pi-fixture', 'global', options),
    ).rejects.toThrow('cannot contain embedded credentials');
    expect(execaMock).not.toHaveBeenCalled();
  });

  it('snapshots local packages by content hash and rejects symlinks', async () => {
    const options = makeOptions();
    const local = path.join(options.projectRoot, 'fixture');
    fs.mkdirSync(local, { recursive: true });
    fs.writeFileSync(path.join(local, 'package.json'), JSON.stringify({ name: 'local-fixture' }));
    fs.writeFileSync(path.join(local, 'index.ts'), 'export default () => {}');

    const first = await resolvePiPackageSource('./fixture', 'project', options);
    fs.writeFileSync(path.join(local, 'index.ts'), 'export default () => ({ changed: true })');
    const second = await resolvePiPackageSource('./fixture', 'project', options);

    expect(first.resolution.packageRoot).not.toBe(second.resolution.packageRoot);
    expect(first.resolution.integrity).not.toBe(second.resolution.integrity);
    fs.symlinkSync(path.join(local, 'index.ts'), path.join(local, 'link.ts'));
    await expect(resolvePiPackageSource('./fixture', 'project', options)).rejects.toThrow('cannot contain symlinks');
  });
});

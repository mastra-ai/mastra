import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountS3 } from './s3';
import { cleanupS3Credentials, s3CredentialsPrefix } from './s3-credentials';

describe('S3 credential lifetime', () => {
  let root: string;
  let mountPath: string;
  const directories: string[] = [];
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    root = mkdtempSync(join(tmpdir(), 's3-credential-test-'));
    mountPath = `/data/${root.split('/').at(-1)}`;
    mkdirSync(join(root, 'proc/self'), { recursive: true });
    writeFileSync(join(root, 'proc/self/comm'), 'sh');
  });

  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  });

  function credentials(path = mountPath) {
    const directory = mkdtempSync(s3CredentialsPrefix(path));
    directories.push(directory);
    writeFileSync(`${directory}/credentials`, 'test-access:test-secret');
    return directory;
  }

  function process(pid: number, directory: string, name = 's3fs') {
    mkdirSync(join(root, `proc/${pid}`));
    writeFileSync(join(root, `proc/${pid}/comm`), name);
    writeFileSync(
      join(root, `proc/${pid}/cmdline`),
      `s3fs\0bucket\0/relocated\0-o\0passwd_file=${directory}/credentials\0`,
    );
  }

  // Execute the real cleanup shell against a synthetic process table, without requiring Linux or sudo.
  function ctx() {
    return {
      logger,
      run: vi.fn(async (cmd: string) => {
        expect(cmd).toMatch(/^sh -c /);
        const result = spawnSync(
          'sh',
          ['-c', cmd.replaceAll('/proc/', `${root}/proc/`).replaceAll('sleep 0.25', ':')],
          { encoding: 'utf8' },
        );
        if (result.error) throw result.error;
        return { exitCode: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
      }),
    };
  }

  it('retains a mounted password file, then cleans it up using only persisted ownership after the daemon exits', async () => {
    const context = ctx();
    const mountCtx = {
      logger,
      run: vi.fn(async (cmd: string) => {
        if (/^(mkdir -m 700|chmod 600) /.test(cmd)) execFileSync('sh', ['-c', cmd]);
        return { exitCode: 0, stdout: cmd === 'id -u && id -g' ? '1000\n1000' : '', stderr: '' };
      }),
      writeFile: vi.fn(async (path: string, content: string) => {
        directories.push(path.slice(0, path.lastIndexOf('/')));
        writeFileSync(path, content);
      }),
    };
    await mountS3(
      mountPath,
      { type: 's3', bucket: 'test-bucket', region: 'auto', accessKeyId: 'access', secretAccessKey: 'secret' },
      mountCtx,
    );
    const directory = directories[0]!;
    process(42, directory);
    await cleanupS3Credentials(mountPath, context);
    expect(existsSync(`${directory}/credentials`)).toBe(true);
    expect(logger.warn).toHaveBeenCalled();

    rmSync(join(root, 'proc/42'), { recursive: true });
    await cleanupS3Credentials(`${mountPath}/`, ctx());
    expect(existsSync(directory)).toBe(false);
  });

  it('cleans only inactive attempts belonging to this mount and preserves relocated daemons', async () => {
    const inactive = credentials();
    const relocated = credentials();
    const otherMount = credentials(`${mountPath}-other`);
    process(42, relocated);
    await cleanupS3Credentials(mountPath, ctx());
    expect(existsSync(inactive)).toBe(false);
    expect(existsSync(`${relocated}/credentials`)).toBe(true);
    expect(existsSync(`${otherMount}/credentials`)).toBe(true);
  });

  it('does not match another process merely mentioning the credential path', async () => {
    const directory = credentials();
    process(42, directory, 'sh');
    await cleanupS3Credentials(mountPath, ctx());
    expect(existsSync(directory)).toBe(false);
  });

  it('retains credentials when the process table cannot be inspected', async () => {
    const directory = credentials();
    rmSync(join(root, 'proc'), { recursive: true });
    await cleanupS3Credentials(mountPath, ctx());
    expect(existsSync(`${directory}/credentials`)).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('retains credentials when a live process cannot be inspected', async () => {
    const directory = credentials();
    mkdirSync(join(root, 'proc/42'));
    await cleanupS3Credentials(mountPath, ctx());
    expect(existsSync(`${directory}/credentials`)).toBe(true);
  });

  it('does not follow credential-directory symlinks', async () => {
    const outside = join(root, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'credentials'), 'keep');
    const link = `${s3CredentialsPrefix(mountPath)}link`;
    directories.push(link);
    symlinkSync(outside, link);
    await cleanupS3Credentials(mountPath, ctx());
    expect(existsSync(join(outside, 'credentials'))).toBe(true);
  });

  it('does not turn a cleanup transport error into an unmount failure', async () => {
    await expect(
      cleanupS3Credentials(mountPath, { logger, run: vi.fn().mockRejectedValue(new Error('offline')) }),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not clean up'));
  });
});

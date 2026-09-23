import { execFileSync } from 'node:child_process';
import { rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { mountS3 } from './s3';

const credentials = { accessKeyId: 'test-access-key', secretAccessKey: 'test-secret-key' };
const config = { type: 's3' as const, bucket: 'test-bucket', region: 'auto', ...credentials };

function makeCtx() {
  return {
    run: vi.fn(async (cmd: string) => ({
      exitCode: 0,
      stdout: cmd === 'id -u && id -g' ? '1000\n1000' : '',
      stderr: '',
    })),
    writeFile: vi.fn(async (_path: string, _content: string) => {}),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

describe('mountS3 credentials', () => {
  it('keeps the existing password-file format for long-lived credentials', async () => {
    const ctx = makeCtx();
    await mountS3('/mnt/s3', config, ctx);
    const [path, content] = ctx.writeFile.mock.calls[0]!;
    expect(content).toBe('test-access-key:test-secret-key');
    expect(ctx.run.mock.calls.find(([cmd]) => cmd.startsWith('s3fs '))![0]).toContain(`passwd_file=${path}`);
    expect(ctx.run.mock.calls.find(([cmd]) => cmd.startsWith('s3fs '))![0]).not.toContain('use_session_token');
  });

  it('loads temporary credentials from a private per-mount file without logging secrets', async () => {
    const ctx = makeCtx();
    const sessionToken = 'test-session-token';
    await mountS3('/mnt/s3', { ...config, sessionToken }, ctx);
    const [path, content] = ctx.writeFile.mock.calls[0]!;
    expect(content).toContain('export AWS_ACCESS_KEY_ID=test-access-key');
    expect(content).toContain('export AWS_SECRET_ACCESS_KEY=test-secret-key');
    expect(content).toContain(`export AWS_SESSION_TOKEN=${sessionToken}`);
    expect(ctx.run.mock.calls).toContainEqual([`chmod 600 ${path}`, 30_000]);
    const command = ctx.run.mock.calls.find(([cmd]) => cmd.includes('&& s3fs'))![0];
    expect(command).toContain(`. ${path} && s3fs`);
    expect(command).toContain('-o use_session_token');
    expect(command).not.toContain('passwd_file=');
    for (const secret of [...Object.values(credentials), sessionToken]) {
      expect(JSON.stringify(ctx.run.mock.calls)).not.toContain(secret);
      expect(JSON.stringify(ctx.logger.debug.mock.calls)).not.toContain(secret);
    }
  });

  it('shell-quotes credential values when sourcing them', async () => {
    const ctx = makeCtx();
    const sessionToken = "token'\n$(printf injected);`printf injected`";
    const accessKeyId = "access'$(printf injected)";
    const secretAccessKey = "secret'`printf injected`";
    await mountS3('/mnt/s3', { ...config, accessKeyId, secretAccessKey, sessionToken }, ctx);
    const content = ctx.writeFile.mock.calls[0]![1];
    const output = execFileSync(
      'sh',
      ['-c', `${content}\nprintf '%s\\0' "$AWS_ACCESS_KEY_ID" "$AWS_SECRET_ACCESS_KEY" "$AWS_SESSION_TOKEN"`],
      { encoding: 'utf8' },
    );
    expect(output.split('\0')).toEqual([accessKeyId, secretAccessKey, sessionToken, '']);
  });

  it('uses separate credential files for concurrent mounts', async () => {
    const ctx = makeCtx();
    await Promise.all([
      mountS3('/mnt/a', { ...config, sessionToken: 'token-a' }, ctx),
      mountS3('/mnt/b', { ...config, sessionToken: 'token-b' }, ctx),
    ]);
    expect(new Set(ctx.writeFile.mock.calls.map(([path]) => path)).size).toBe(2);
  });

  it('protects the upload with a private directory even if upload creates a readable file', async () => {
    const ctx = makeCtx();
    let directory: string | undefined;
    ctx.run.mockImplementation(async cmd => {
      if (/^(mkdir -m 700|chmod 600) /.test(cmd)) execFileSync('sh', ['-c', cmd]);
      return { exitCode: 0, stdout: cmd === 'id -u && id -g' ? '1000\n1000' : '', stderr: '' };
    });
    ctx.writeFile.mockImplementation(async (path, content) => {
      directory = dirname(path);
      expect(statSync(directory).mode & 0o777).toBe(0o700);
      writeFileSync(path, content, { mode: 0o644 });
    });
    try {
      await mountS3('/mnt/s3', config, ctx);
      expect(statSync(ctx.writeFile.mock.calls[0]![0]).mode & 0o777).toBe(0o600);
    } finally {
      if (directory) rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not upload credentials or remove an unowned directory if private directory creation fails', async () => {
    const ctx = makeCtx();
    ctx.run.mockImplementation(async cmd => ({
      exitCode: cmd.startsWith('mkdir -m 700 ') ? 1 : 0,
      stdout: cmd === 'id -u && id -g' ? '1000\n1000' : '',
      stderr: '',
    }));
    await expect(mountS3('/mnt/s3', { ...config, sessionToken: 'token' }, ctx)).rejects.toThrow(
      'private S3 credentials directory',
    );
    expect(ctx.writeFile).not.toHaveBeenCalled();
    expect(ctx.run.mock.calls.some(([cmd]) => cmd.startsWith('rm -f ') || cmd.includes('&& s3fs'))).toBe(false);
  });

  it.each([undefined, 'token'])('fails closed on chmod failure (sessionToken: %s)', async sessionToken => {
    const ctx = makeCtx();
    ctx.run.mockImplementation(async cmd => ({
      exitCode: cmd.startsWith('chmod 600 ') ? 1 : 0,
      stdout: cmd === 'id -u && id -g' ? '1000\n1000' : '',
      stderr: '',
    }));
    await expect(mountS3('/mnt/s3', { ...config, sessionToken }, ctx)).rejects.toThrow('credentials file permissions');
    const path = ctx.writeFile.mock.calls[0]![0];
    expect(ctx.run.mock.calls.at(-1)![0]).toBe(`rm -f ${path} && rmdir ${dirname(path)}`);
    expect(ctx.run.mock.calls.some(([cmd]) => cmd.startsWith('s3fs ') || cmd.includes('&& s3fs'))).toBe(false);
  });

  it('cleans up a partial upload without masking the upload error', async () => {
    const ctx = makeCtx();
    const error = new Error('Upload failed');
    ctx.writeFile.mockRejectedValueOnce(error);
    await expect(mountS3('/mnt/s3', { ...config, sessionToken: 'token' }, ctx)).rejects.toBe(error);
    expect(ctx.run.mock.calls.at(-1)![0]).toContain('rm -f ');
  });

  it('cleans up after s3fs failure and preserves the error if cleanup also fails', async () => {
    const ctx = makeCtx();
    ctx.run.mockImplementation(async cmd => ({
      exitCode: cmd.includes('&& s3fs') || cmd.startsWith('rm -f ') ? 1 : 0,
      stdout: cmd === 'id -u && id -g' ? '1000\n1000' : '',
      stderr: 'failure',
    }));
    await expect(mountS3('/mnt/s3', { ...config, sessionToken: 'token' }, ctx)).rejects.toThrow(
      'Failed to mount S3 bucket',
    );
    expect(ctx.run.mock.calls.at(-1)![0]).toContain('rm -f ');
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to remove S3 credentials'));
  });

  it('does not reuse credential files for concurrent attempts at the same mount path', async () => {
    const ctx = makeCtx();
    await Promise.all([
      mountS3('/mnt/s3', { ...config, sessionToken: 'token-a' }, ctx),
      mountS3('/mnt/s3', { ...config, sessionToken: 'token-b' }, ctx),
    ]);
    expect(new Set(ctx.writeFile.mock.calls.map(([path]) => path)).size).toBe(2);
  });

  it('does not create credential files for public AWS buckets', async () => {
    const ctx = makeCtx();
    await mountS3('/mnt/s3', { type: 's3', bucket: 'public-bucket', region: 'us-east-1' }, ctx);
    expect(ctx.writeFile).not.toHaveBeenCalled();
    expect(ctx.run.mock.calls.find(([cmd]) => cmd.startsWith('s3fs '))![0]).toContain('public_bucket=1');
    expect(ctx.run.mock.calls.some(([cmd]) => cmd.startsWith('mkdir -m 700 '))).toBe(false);
  });

  it('removes temporary credential staging files after a successful mount', async () => {
    const ctx = makeCtx();
    await mountS3('/mnt/s3', { ...config, sessionToken: 'token' }, ctx);
    const path = ctx.writeFile.mock.calls[0]![0];
    expect(ctx.run.mock.calls.at(-1)![0]).toBe(`rm -f ${path} && rmdir ${dirname(path)}`);
    expect(ctx.run.mock.calls).toContainEqual(['timeout -k 5s 15s stat -L -- /mnt/s3 > /dev/null', 30_000]);
  });

  it('retains password files used by successful long-lived mounts', async () => {
    const ctx = makeCtx();
    await mountS3('/mnt/s3', config, ctx);
    expect(ctx.run.mock.calls.some(([cmd]) => cmd.startsWith('rm -f '))).toBe(false);
  });

  it.each([1, 124, 137])('rejects a launched but unreadable mount (probe exit: %s)', async exitCode => {
    const ctx = makeCtx();
    ctx.run.mockImplementation(async cmd => ({
      exitCode: cmd.startsWith('timeout -k ') ? exitCode : 0,
      stdout: cmd === 'id -u && id -g' ? '1000\n1000' : '',
      stderr: 'Transport endpoint is not connected',
    }));
    await expect(mountS3('/mnt/s3', config, ctx)).rejects.toThrow('S3 mount is not readable');
    // The sandbox unmount path checks daemon lifetime before deleting password files.
    expect(ctx.run.mock.calls.some(([cmd]) => cmd.startsWith('rm -f '))).toBe(false);
  });

  it('warns without reporting a working mount as failed if staging cleanup fails', async () => {
    const ctx = makeCtx();
    ctx.run.mockImplementation(async cmd => ({
      exitCode: cmd.startsWith('rm -f ') ? 1 : 0,
      stdout: cmd === 'id -u && id -g' ? '1000\n1000' : '',
      stderr: '',
    }));
    await expect(mountS3('/mnt/s3', { ...config, sessionToken: 'token' }, ctx)).resolves.toBeUndefined();
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to remove S3 credentials'));
  });

  it('rejects a session token without its access and secret keys before side effects', async () => {
    const ctx = makeCtx();
    await expect(
      mountS3(
        '/mnt/s3',
        {
          type: 's3',
          bucket: 'test-bucket',
          region: 'auto',
          sessionToken: 'token',
        },
        ctx,
      ),
    ).rejects.toThrow('sessionToken requires accessKeyId and secretAccessKey');
    expect(ctx.run).not.toHaveBeenCalled();
    expect(ctx.writeFile).not.toHaveBeenCalled();
  });
});

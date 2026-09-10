import { createHash, createHmac, randomUUID } from 'node:crypto';

import { Daytona } from '@daytonaio/sdk';
import { Workspace } from '@mastra/core/workspace';
import { S3Filesystem } from '@mastra/s3';
import { describe, expect, it } from 'vitest';

import { shellQuote } from '../../utils/shell-quote';
import { DaytonaSandbox } from '../index';

// Explicit opt-in: creates billable sandboxes and disposable objects in the configured R2 bucket.
// Requires DAYTONA_API_KEY, S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.
describe.skipIf(process.env.RUN_R2_ISOLATION_TEST !== '1')('R2 temporary-credential mounts', () => {
  it('initializes, removes staged credentials, and denies access to another scope', async () => {
    for (const name of ['DAYTONA_API_KEY', 'S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
      if (!process.env[name]) throw new Error(`Missing ${name}`);
    }
    const endpoint = new URL(process.env.S3_ENDPOINT!);
    if (!endpoint.hostname.endsWith('.r2.cloudflarestorage.com'))
      throw new Error('This signer requires an R2 endpoint');
    const bucket = process.env.S3_BUCKET!;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID!;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY!;
    const root = `mastra-daytona-isolation/${randomUUID()}/`;
    const parent = new S3Filesystem({
      bucket,
      endpoint: endpoint.origin,
      region: 'auto',
      prefix: root,
      accessKeyId,
      secretAccessKey,
    });
    const daytona = new Daytona();
    const scopes = ['a', 'b'].map(name => {
      const prefix = `${root}${name}/`;
      // R2-specific local signing, not a portable S3 credential provider.
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const now = Math.floor(Date.now() / 1000);
      const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
        sub: endpoint.hostname.split('.')[0],
        iss: accessKeyId,
        aud: endpoint.host,
        iat: now,
        exp: now + 1800,
        bucket,
        scope: 'object-read-write',
        paths: { prefixPaths: [prefix], objectPaths: [] },
      })}`;
      const jwt = `${unsigned}.${createHmac('sha256', secretAccessKey).update(unsigned).digest('base64url')}`;
      const filesystem = new S3Filesystem({
        bucket,
        endpoint: endpoint.origin,
        region: 'auto',
        prefix,
        accessKeyId,
        secretAccessKey: createHash('sha256').update(jwt).digest('hex'),
        sessionToken: Buffer.from(`jwt/${jwt}`).toString('base64'),
      });
      const sandbox = new DaytonaSandbox({ language: 'python', ephemeral: true });
      return {
        name,
        prefix,
        filesystem,
        sandbox,
        workspace: new Workspace({ mounts: { '/s3-data': filesystem }, sandbox }),
      };
    });
    const started: typeof scopes = [];
    async function command(sandbox: DaytonaSandbox, shell: string) {
      const result = await sandbox.executeCommand('sh', ['-c', shell], { cwd: '/', timeout: 30_000 });
      expect(result.exitCode, result.stderr || result.stdout).toBe(0);
      return result.stdout.trim();
    }
    try {
      for (const scope of scopes) {
        // s3fs needs the prefix-root directory marker, independently of credential isolation.
        await parent.mkdir(scope.name);
        await parent.writeFile(`${scope.name}/sentinel.txt`, `original-${scope.name}`);
        started.push(scope);
        await scope.workspace.init();
        await scope.filesystem.init(); // Workspace initialization can report partial success.
        expect(await scope.filesystem.readFile('/sentinel.txt', { encoding: 'utf-8' })).toBe(`original-${scope.name}`);
        expect(await command(scope.sandbox, 'timeout 15 cat /s3-data/sentinel.txt')).toBe(`original-${scope.name}`);
        await command(scope.sandbox, 'printf own-write > /s3-data/own.txt');
        expect(await parent.readFile(`${scope.name}/own.txt`, { encoding: 'utf-8' })).toBe('own-write');
        await command(scope.sandbox, 'rm /s3-data/own.txt');
        await expect.poll(() => parent.exists(`${scope.name}/own.txt`)).toBe(false);
      }
      for (const scope of scopes) {
        const peer = scopes.find(candidate => candidate !== scope)!;
        await command(scope.sandbox, 'python -c "import boto3" 2>/dev/null || pip -q install boto3');
        const python = `import boto3, glob
from pathlib import Path
from botocore.exceptions import ClientError
assert not glob.glob('/tmp/.mastra-s3-*'), 'Credential staging directory was not removed'
credentials = []
for process in Path('/proc').iterdir():
 if not process.name.isdigit():
  continue
 try:
  if (process / 'comm').read_text().strip() != 's3fs':
   continue
  env = dict(entry.split(b'=', 1) for entry in (process / 'environ').read_bytes().split(b'\\0') if b'=' in entry)
  credentials.append({key.decode(): value.decode() for key, value in env.items() if key.startswith(b'AWS_')})
 except (FileNotFoundError, PermissionError):
  continue
assert len(credentials) == 1
credential = credentials[0]
s3 = boto3.client('s3', endpoint_url=${JSON.stringify(endpoint.origin)}, region_name='auto',
 aws_access_key_id=credential['AWS_ACCESS_KEY_ID'], aws_secret_access_key=credential['AWS_SECRET_ACCESS_KEY'],
 aws_session_token=credential['AWS_SESSION_TOKEN'])
bucket = ${JSON.stringify(bucket)}
prefix = ${JSON.stringify(scope.prefix)}
peer = ${JSON.stringify(peer.prefix)}
assert s3.get_object(Bucket=bucket, Key=prefix+'sentinel.txt')['Body'].read().decode() == ${JSON.stringify(`original-${scope.name}`)}
operations = {
 'list': lambda: s3.list_objects_v2(Bucket=bucket, Prefix=peer),
 'read': lambda: s3.get_object(Bucket=bucket, Key=peer+'sentinel.txt'),
 'overwrite': lambda: s3.put_object(Bucket=bucket, Key=peer+'sentinel.txt', Body=b'bad'),
 'create': lambda: s3.put_object(Bucket=bucket, Key=peer+'cross.txt', Body=b'bad'),
 'delete': lambda: s3.delete_object(Bucket=bucket, Key=peer+'sentinel.txt'),
}
for name, operation in operations.items():
 try:
  operation()
 except ClientError as error:
  assert error.response['Error']['Code'] == 'AccessDenied'
  assert error.response['ResponseMetadata']['HTTPStatusCode'] == 403
 else:
  raise AssertionError(name + ' unexpectedly succeeded')
print('5 cross-scope operations denied')
`;
        await scope.sandbox.daytona.fs.uploadFile(Buffer.from(python), '/tmp/check-isolation.py');
        // Same-user sandbox code can still read daemon credentials, even after staging-file cleanup.
        // Reuse those credentials, never the parent secret.
        const output = await command(scope.sandbox, `python ${shellQuote('/tmp/check-isolation.py')}`);
        expect(output).toBe('5 cross-scope operations denied');
        expect(await parent.readFile(`${peer.name}/sentinel.txt`, { encoding: 'utf-8' })).toBe(`original-${peer.name}`);
        expect(await parent.exists(`${peer.name}/cross.txt`)).toBe(false);
      }

      // A seeded prefix without its directory marker must not report a successful mount.
      const scope = scopes[0]!;
      await parent.writeFile(`${scope.name}/missing-marker/seed.txt`, 'seed');
      const missingMarker = new S3Filesystem({
        ...scope.filesystem.getMountConfig(),
        prefix: `${scope.prefix}missing-marker/`,
      });
      const failedMount = await scope.sandbox.mount(missingMarker, '/missing-marker');
      expect(failedMount.success).toBe(false);
      expect(failedMount.error).toMatch(/S3 mount is not readable|Failed to mount S3 bucket/);
      await command(scope.sandbox, 'test -z "$(find /tmp -maxdepth 1 -name ".mastra-s3-*")"');
      await command(scope.sandbox, "! grep -Fq -- ' /missing-marker ' /proc/mounts");

      await parent.mkdir(`${scope.name}/missing-marker`);
      const retriedMount = await scope.sandbox.mount(missingMarker, '/missing-marker');
      expect(retriedMount.success, retriedMount.error).toBe(true);
      expect(await command(scope.sandbox, 'timeout 15 cat /missing-marker/seed.txt')).toBe('seed');
      expect(await command(scope.sandbox, 'timeout 15 cat /s3-data/sentinel.txt')).toBe(`original-${scope.name}`);

      // After isolation checks, use long-lived test-bucket credentials to verify cleanup across reconnects.
      const longLived = new S3Filesystem({
        ...scope.filesystem.getMountConfig(),
        accessKeyId,
        secretAccessKey,
        sessionToken: undefined,
      });
      const mounted = await scope.sandbox.mount(longLived, '/long-lived');
      expect(mounted.success, mounted.error).toBe(true);
      const credentialFile = await command(scope.sandbox, "printf '%s\\n' /tmp/.mastra-s3-*/credentials");
      const reconnected = new DaytonaSandbox({ id: scope.sandbox.id, ephemeral: true });
      await reconnected.start(); // Empty registry: reconcile persisted mounts from the previous instance.
      expect(reconnected.daytona.id).toBe(scope.sandbox.daytona.id);
      async function verifyCredentialCleanup(file: string) {
        await command(reconnected, "! grep -Fq -- ' /long-lived ' /proc/mounts");
        // Daytona may move even a healthy mount aside rather than detach it. Check retention
        // before explicitly terminating ONLY this test's relocated daemon to exercise later cleanup.
        const terminate = `from pathlib import Path
import os, signal
file = ${JSON.stringify(file)}
for process in Path('/proc').iterdir():
 if not process.name.isdigit():
  continue
 try:
  args = (process / 'cmdline').read_bytes().split(b'\\0')
 except (FileNotFoundError, PermissionError):
  continue
 if ('passwd_file=' + file).encode() in args:
  assert (process / 'comm').read_text().strip() == 's3fs'
  assert Path(file).is_file(), 'Active mount lost its password file'
  os.kill(int(process.name), signal.SIGTERM)
`;
        await command(reconnected, `python -c ${shellQuote(terminate)}`);
        await reconnected.unmount('/long-lived');
        await command(reconnected, `test ! -e ${shellQuote(file.slice(0, file.lastIndexOf('/')))}`);
      }
      await verifyCredentialCleanup(credentialFile);
      const mountedAgain = await reconnected.mount(longLived, '/long-lived');
      expect(mountedAgain.success, mountedAgain.error).toBe(true);
      const nextCredentialFile = await command(reconnected, "printf '%s\\n' /tmp/.mastra-s3-*/credentials");
      await reconnected.unmount('/long-lived');
      await verifyCredentialCleanup(nextCredentialFile);
    } finally {
      const cleanup = await Promise.allSettled(
        started.map(async scope => {
          let id: string | undefined;
          try {
            id = scope.sandbox.daytona.id;
          } catch {
            /* Startup may fail before a sandbox exists. */
          }
          await scope.workspace.destroy();
          if (id) {
            await expect
              .poll(
                async () => {
                  try {
                    await daytona.get(id);
                    return false;
                  } catch (error) {
                    if (error instanceof Error && /not found|404/i.test(error.message)) return true;
                    throw error;
                  }
                },
                { timeout: 30_000, interval: 1000 },
              )
              .toBe(true);
          }
        }),
      );
      try {
        await parent.rmdir('/', { recursive: true });
        expect(await parent.readdir('/')).toEqual([]);
      } finally {
        await parent.destroy();
      }
      const errors = cleanup.filter(result => result.status === 'rejected').map(result => result.reason);
      if (errors.length) throw new AggregateError(errors, 'Sandbox cleanup failed');
    }
  }, 300_000);
});

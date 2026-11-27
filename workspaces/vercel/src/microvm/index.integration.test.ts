import { Drive } from '@vercel/sandbox';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VercelSandbox } from './index';

// The @vercel/sandbox SDK authenticates via VERCEL_OIDC_TOKEN or the full
// VERCEL_TOKEN/VERCEL_TEAM_ID/VERCEL_PROJECT_ID triple. Only run when one of
// those complete credential sets is present so we never start a partially
// configured run.
const HAS_OIDC = Boolean(process.env.VERCEL_OIDC_TOKEN);
const HAS_TOKEN_TRIPLE = Boolean(
  process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID,
);
const HAS_CREDS = HAS_OIDC || HAS_TOKEN_TRIPLE;

describe.skipIf(!HAS_CREDS)('VercelSandbox Integration', () => {
  let sandbox: VercelSandbox | undefined;

  beforeAll(async () => {
    sandbox = new VercelSandbox({
      ...(HAS_TOKEN_TRIPLE
        ? {
            token: process.env.VERCEL_TOKEN,
            teamId: process.env.VERCEL_TEAM_ID,
            projectId: process.env.VERCEL_PROJECT_ID,
          }
        : {}),
      timeout: 300_000,
    });
    await sandbox._start();
  }, 180_000);

  afterAll(async () => {
    if (sandbox) await sandbox._destroy();
  }, 30_000);

  it('executes an echo command', async () => {
    const result = await sandbox!.executeCommand('echo', ['hello world']);
    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toBe('hello world');
    expect(result.exitCode).toBe(0);
  });

  it('reports a non-zero exit code for a failing command', async () => {
    const result = await sandbox!.executeCommand('ls', ['/nonexistent-path']);
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
  });

  it('persists files within the session filesystem', async () => {
    const write = await sandbox!.executeCommand('sh', ['-c', 'echo "persisted" > /tmp/note.txt']);
    expect(write.success).toBe(true);
    const read = await sandbox!.executeCommand('cat', ['/tmp/note.txt']);
    expect(read.stdout.trim()).toBe('persisted');
  });

  it('spawns and waits on a background process', async () => {
    const handle = await sandbox!.processes.spawn('echo background');
    const result = await handle.wait();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('background');
  });

  // Uses its own temporary Drive and sandboxes rather than the shared
  // beforeAll instance so a failure here cannot strand the shared sandbox.
  describe('region and Drive mounts', () => {
    const region = process.env.VERCEL_SANDBOX_TEST_REGION ?? 'iad1';
    const credentials = HAS_TOKEN_TRIPLE
      ? {
          token: process.env.VERCEL_TOKEN,
          teamId: process.env.VERCEL_TEAM_ID,
          projectId: process.env.VERCEL_PROJECT_ID,
        }
      : {};

    it('mounts one Drive into two sandboxes and reads what the first wrote', async () => {
      const driveName = `mastra-vercel-mount-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const drive = await Drive.getOrCreate({ name: driveName, region, ...credentials });

      let first: VercelSandbox | undefined;
      let second: VercelSandbox | undefined;
      try {
        const contents = `persisted-${driveName}`;

        first = new VercelSandbox({
          ...credentials,
          region,
          mounts: { '/data': drive },
          timeout: 300_000,
        });
        await first._start();
        // The getter reports the region the sandbox is configured for.
        expect(first.sandbox.region).toBe(region);

        const write = await first.executeCommand('sh', ['-c', `printf '%s' '${contents}' > /data/marker.txt`]);
        expect(write.success).toBe(true);
        // Stop to detach the Drive before remounting it in a second sandbox.
        await first._stop();

        second = new VercelSandbox({
          ...credentials,
          region,
          mounts: { '/data': drive },
          timeout: 300_000,
        });
        await second._start();

        const read = await second.executeCommand('cat', ['/data/marker.txt']);
        expect(read.success).toBe(true);
        expect(read.stdout.trim()).toBe(contents);
      } finally {
        await first?._destroy().catch(() => {});
        await second?._destroy().catch(() => {});
        // The Drive outlives both sandboxes, so only delete it after they
        // are detached.
        await drive.delete().catch(() => {});
      }
    }, 600_000);
  });
});

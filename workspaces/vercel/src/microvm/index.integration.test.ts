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

/** Credentials for the SDK, or an empty object when authenticating via OIDC. */
function credentialOptions() {
  return HAS_TOKEN_TRIPLE
    ? {
        token: process.env.VERCEL_TOKEN,
        teamId: process.env.VERCEL_TEAM_ID,
        projectId: process.env.VERCEL_PROJECT_ID,
      }
    : {};
}

describe.skipIf(!HAS_CREDS)('VercelSandbox Integration', () => {
  let sandbox: VercelSandbox | undefined;

  beforeAll(async () => {
    sandbox = new VercelSandbox({
      ...credentialOptions(),
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

  it('blocks the first outbound request when created with a deny-all network policy', async () => {
    // A dedicated sandbox: the SDK applies the policy only when it creates a
    // sandbox, so this must not share the unrestricted sandbox above.
    const restricted = new VercelSandbox({
      ...credentialOptions(),
      timeout: 300_000,
      networkPolicy: 'deny-all',
    });

    try {
      await restricted._start();

      // Run the outbound attempt as the sandbox's first command. The script
      // prints a marker before exiting so a failure can be traced to a
      // blocked request rather than a missing binary.
      const result = await restricted.executeCommand('node', [
        '-e',
        "fetch('https://example.com').then(() => { console.log('REACHED'); process.exit(0); }).catch(() => { console.log('BLOCKED'); process.exit(7); })",
      ]);

      expect(result.stdout).toContain('BLOCKED');
      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
    } finally {
      await restricted._destroy();
    }
  }, 180_000);
  it('extends the live session deadline by the requested duration', async () => {
    // `expiresAt` is the live deadline of the running session (session start
    // time plus its current timeout). getInfo().metadata.timeout would only
    // echo the constructor-derived `_timeout`, which this PR deliberately
    // leaves untouched, so it cannot prove the session actually got more time.
    const before = sandbox!.sandbox.expiresAt;
    expect(before).toBeInstanceOf(Date);

    await sandbox!.extendTimeout(60_000);

    const after = sandbox!.sandbox.expiresAt;
    expect(after).toBeInstanceOf(Date);

    // The SDK replaces its session snapshot with the extended one, so the live
    // deadline must move forward by the requested duration. Assert the full
    // minute landed (not a no-op or a partial extension) while tolerating a
    // second or two of provider-side rounding.
    const delta = after!.getTime() - before!.getTime();
    expect(delta).toBeGreaterThanOrEqual(58_000);
    expect(delta).toBeLessThanOrEqual(62_000);
  });

  // Uses its own temporary Drive and sandboxes rather than the shared
  // beforeAll instance so a failure here cannot strand the shared sandbox.
  describe('region and Drive mounts', () => {
    const region = process.env.VERCEL_SANDBOX_TEST_REGION ?? 'iad1';

    it('mounts one Drive into two sandboxes and reads what the first wrote', async () => {
      const driveName = `mastra-vercel-mount-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const drive = await Drive.getOrCreate({ name: driveName, region, ...credentialOptions() });

      let first: VercelSandbox | undefined;
      let second: VercelSandbox | undefined;
      try {
        const contents = `persisted-${driveName}`;

        first = new VercelSandbox({
          ...credentialOptions(),
          region,
          mounts: { '/data': drive },
          timeout: 300_000,
        });
        await first._start();
        // The getter reports the region the sandbox is configured for.
        expect(first.sandbox.region).toBe(region);

        const write = await first.executeCommand('sh', ['-c', `printf '%s' '${contents}' > /data/marker.txt`]);
        expect(write.success).toBe(true);
        // Destroy to detach the Drive before remounting it in a second sandbox.
        // Stopping would snapshot the sandbox and drop this unnamed instance's
        // only handle (`stop()` sets `_sandbox = null`, and `attach()` returns
        // null without a name), so the later `_destroy()` could no longer delete
        // it and the run would leak a sandbox. Destroying also detaches the
        // Drive, so it does both in one step.
        await first._destroy();

        second = new VercelSandbox({
          ...credentialOptions(),
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

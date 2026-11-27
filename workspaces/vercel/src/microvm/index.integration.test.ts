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
});

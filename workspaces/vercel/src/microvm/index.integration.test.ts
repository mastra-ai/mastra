import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VercelMicroVMSandbox } from './index';

// The @vercel/sandbox SDK authenticates via VERCEL_OIDC_TOKEN or the
// VERCEL_TOKEN/VERCEL_TEAM_ID/VERCEL_PROJECT_ID triple. Run when either is set.
const HAS_CREDS = Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_TOKEN);

describe.skipIf(!HAS_CREDS)('VercelMicroVMSandbox Integration', () => {
  let sandbox: VercelMicroVMSandbox;

  beforeAll(async () => {
    sandbox = new VercelMicroVMSandbox({
      token: process.env.VERCEL_TOKEN,
      teamId: process.env.VERCEL_TEAM_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
      timeout: 300_000,
    });
    await sandbox._start();
  }, 180_000);

  afterAll(async () => {
    await sandbox._destroy();
  }, 30_000);

  it('executes an echo command', async () => {
    const result = await sandbox.executeCommand('echo', ['hello world']);
    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toBe('hello world');
    expect(result.exitCode).toBe(0);
  });

  it('reports a non-zero exit code for a failing command', async () => {
    const result = await sandbox.executeCommand('ls', ['/nonexistent-path']);
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
  });

  it('persists files within the session filesystem', async () => {
    const write = await sandbox.executeCommand('sh', ['-c', 'echo "persisted" > /tmp/note.txt']);
    expect(write.success).toBe(true);
    const read = await sandbox.executeCommand('cat', ['/tmp/note.txt']);
    expect(read.stdout.trim()).toBe('persisted');
  });

  it('spawns and waits on a background process', async () => {
    const handle = await sandbox.processes.spawn('echo background');
    const result = await handle.wait();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('background');
  });
});

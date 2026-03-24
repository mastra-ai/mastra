import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VercelSandbox } from './index';

/**
 * Integration tests for Vercel Sandbox.
 *
 * Requires authentication. Either:
 * - VERCEL_OIDC_TOKEN (via `vercel link && vercel env pull`)
 * - VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID
 */
const hasAuth = !!(process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_TOKEN);

describe.skipIf(!hasAuth)('VercelSandbox Integration', () => {
  let sandbox: VercelSandbox;

  beforeAll(async () => {
    sandbox = new VercelSandbox({
      runtime: 'node24',
      timeout: 120_000,
    });
    await sandbox._start();
  }, 60_000);

  afterAll(async () => {
    await sandbox._destroy();
  }, 30_000);

  it('should execute echo command', async () => {
    const result = await sandbox.vercel.runCommand('echo', ['hello world']);
    expect(result.exitCode).toBe(0);
    expect((await result.stdout()).trim()).toBe('hello world');
  });

  it('should handle failed commands', async () => {
    const result = await sandbox.vercel.runCommand('ls', ['/nonexistent-path']);
    expect(result.exitCode).not.toBe(0);
  });

  it('should write and read files', async () => {
    await sandbox.vercel.writeFiles([
      { path: 'test.txt', content: Buffer.from('test content') },
    ]);
    const buffer = await sandbox.vercel.readFileToBuffer({ path: 'test.txt' });
    expect(buffer?.toString()).toBe('test content');
  });

  it('should execute via process manager', async () => {
    const handle = await sandbox.processes!.spawn('echo "from process manager"');
    const result = await handle.wait();
    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toBe('from process manager');
  });

  it('should report correct sandbox info', async () => {
    const info = await sandbox.getInfo();
    expect(info.provider).toBe('vercel');
    expect(info.status).toBe('running');
    expect(info.metadata?.sandboxId).toBeTruthy();
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VercelSandbox } from './index';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

describe.skipIf(!VERCEL_TOKEN)('VercelSandbox Integration', () => {
  let sandbox: VercelSandbox;

  beforeAll(async () => {
    sandbox = new VercelSandbox({
      token: VERCEL_TOKEN!,
      teamId: process.env.VERCEL_TEAM_ID,
    });
    await sandbox._start();
  }, 180_000);

  afterAll(async () => {
    await sandbox._destroy();
  }, 30_000);

  it('should execute echo command', async () => {
    const result = await sandbox.executeCommand('echo', ['hello world']);
    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toBe('hello world');
    expect(result.exitCode).toBe(0);
  });

  it('should handle failed commands', async () => {
    const result = await sandbox.executeCommand('ls', ['/nonexistent-path']);
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
  });

  it('should write and read from /tmp', async () => {
    const writeResult = await sandbox.executeCommand('sh', [
      '-c',
      'echo "test content" > /tmp/test.txt && cat /tmp/test.txt',
    ]);
    expect(writeResult.success).toBe(true);
    expect(writeResult.stdout.trim()).toBe('test content');
  });

  it('should report correct sandbox info', async () => {
    const info = await sandbox.getInfo!();
    expect(info.provider).toBe('vercel');
    expect(info.status).toBe('running');
    expect(info.metadata?.deploymentUrl).toBeTruthy();
  });
});

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CloudflareSandbox } from '../sandbox';

/**
 * Runs against a deployed Cloudflare Sandbox Bridge Worker.
 *
 * CLOUDFLARE_SANDBOX_BRIDGE_URL=https://<worker>.workers.dev \
 * CLOUDFLARE_SANDBOX_API_KEY=<SANDBOX_API_KEY secret> \
 *   pnpm --filter @mastra/cloudflare-sandbox test
 */
const baseUrl = process.env.CLOUDFLARE_SANDBOX_BRIDGE_URL;
const apiToken = process.env.CLOUDFLARE_SANDBOX_API_KEY;
const describeCloudflare = baseUrl ? describe : describe.skip;

function createSandbox(options: { sandboxId?: string } = {}) {
  return new CloudflareSandbox({
    id: `mastra-integration-${randomUUID()}`,
    baseUrl: baseUrl!,
    apiToken,
    ...options,
  });
}

describeCloudflare('CloudflareSandbox integration', () => {
  it('creates a sandbox, writes a file, and streams command output', async () => {
    const sandbox = createSandbox();

    try {
      await sandbox._start();
      await sandbox.writeFiles([{ path: 'message.txt', content: 'mastra-cloudflare-ok' }]);

      const stdoutChunks: string[] = [];
      const result = await sandbox.executeCommand('cat', ['/workspace/message.txt'], {
        onStdout: chunk => stdoutChunks.push(chunk),
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('mastra-cloudflare-ok');
      expect(stdoutChunks.join('')).toContain('mastra-cloudflare-ok');
    } finally {
      await sandbox._destroy();
    }
  }, 120_000);

  it('applies env and cwd, and reports non-zero exits without throwing', async () => {
    const sandbox = createSandbox();

    try {
      await sandbox._start();

      const env = await sandbox.executeCommand('sh', ['-c', 'echo "$GREETING from $PWD"'], {
        env: { GREETING: 'hello' },
        cwd: '/workspace',
      });
      expect(env.stdout).toContain('hello from /workspace');

      const failure = await sandbox.executeCommand('sh', ['-c', 'exit 7']);
      expect(failure.exitCode).toBe(7);
      expect(failure.success).toBe(false);
    } finally {
      await sandbox._destroy();
    }
  }, 120_000);

  it('reconnects to an existing sandbox and keeps workspace files', async () => {
    const first = createSandbox();
    let remoteId: string | undefined;

    try {
      await first._start();
      remoteId = first.getInfo().metadata?.sandboxId as string;
      await first.writeFiles([{ path: 'persisted.txt', content: 'still here' }]);

      const reconnected = createSandbox({ sandboxId: remoteId });
      await reconnected._start();

      const result = await reconnected.executeCommand('cat', ['/workspace/persisted.txt']);
      expect(result.stdout).toContain('still here');
    } finally {
      await first._destroy();
    }
  }, 180_000);
});

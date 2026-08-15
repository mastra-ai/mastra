import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CloudflareSandbox } from '../sandbox';

const baseUrl = process.env.CLOUDFLARE_SANDBOX_BRIDGE_URL;
const apiToken = process.env.CLOUDFLARE_SANDBOX_API_TOKEN;
const describeCloudflare = baseUrl ? describe : describe.skip;

describeCloudflare('CloudflareSandbox integration', () => {
  it('creates a sandbox, executes a command, and writes files', async () => {
    const sandbox = new CloudflareSandbox({
      id: `mastra-integration-${randomUUID()}`,
      baseUrl: baseUrl!,
      apiToken,
    });

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
  });
});

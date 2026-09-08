import { describe, expect, it } from 'vitest';
import { CloudflareSandbox } from './sandbox';
import { createFakeBridge } from './testing/fake-bridge';

describe('CloudflareSandbox command forms', () => {
  it.each([undefined, []])('passes a complete command through a non-login shell with args %j', async args => {
    const bridge = createFakeBridge();
    const sandbox = new CloudflareSandbox({ baseUrl: 'https://bridge.example.com', fetch: bridge.fetch });
    await sandbox.start();
    const command = "printf '%s\\n' first | tr a-z A-Z && printf '%s' second";

    await sandbox.executeCommand(command, args, { cwd: '/workspace/project', timeout: 5000 });

    expect(bridge.execs).toEqual([{ argv: ['bash', '-c', command], cwd: '/workspace/project', timeout_ms: 5000 }]);
  });

  it('preserves explicit arguments as literal argv elements', async () => {
    const bridge = createFakeBridge();
    const sandbox = new CloudflareSandbox({ baseUrl: 'https://bridge.example.com', fetch: bridge.fetch });
    await sandbox.start();
    const args = ['%s', 'one;two', 'a b', '$(printf unexpected)', ''];

    await sandbox.executeCommand('printf', args);

    expect(bridge.execs[0]?.argv).toEqual(['printf', ...args]);
  });

  it('keeps environment overrides ahead of the shell without loading a login profile', async () => {
    const bridge = createFakeBridge();
    const sandbox = new CloudflareSandbox({
      baseUrl: 'https://bridge.example.com', fetch: bridge.fetch,
      env: { PATH: '/workspace/venv/bin:/usr/bin:/bin', BASE: 'original' },
    });
    await sandbox.start();

    await sandbox.executeCommand('python3 --version', undefined, { env: { BASE: 'replacement value' } });

    expect(bridge.execs[0]?.argv).toEqual([
      'env', 'PATH=/workspace/venv/bin:/usr/bin:/bin', 'BASE=replacement value',
      'bash', '-c', 'python3 --version',
    ]);
  });
});

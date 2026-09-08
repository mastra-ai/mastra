import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';

import { InternalMastraMCPClient } from './client.js';

// Real subprocess, no module mocks: `connectStdio` really spawns, and the
// client checks `this.transport instanceof StdioClientTransport`, which a
// module mock would break. The committed env-reporter fixture echoes
// `Object.keys(process.env)` back through a tool call.
describe('MastraMCPClient - Stdio inheritDefaultEnv', () => {
  // Resolve the tsx CLI binary from the workspace instead of using npx -y,
  // which can be flaky in CI when tsx needs to be downloaded on-the-fly.
  const tsxCli = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');
  const fixturePath = path.join(__dirname, '..', '__fixtures__/env-reporter.ts');

  let client: InternalMastraMCPClient | undefined;

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    client = undefined;
  });

  async function getChildEnvKeys(serverOptions: { env?: Record<string, string>; inheritDefaultEnv?: boolean }) {
    client = new InternalMastraMCPClient({
      name: 'env-reporter',
      server: {
        command: process.execPath,
        args: [tsxCli, fixturePath],
        ...serverOptions,
      },
    });
    await client.connect();
    const tools = await client.tools();
    const result = (await tools['getEnvKeys']!.execute({})) as { content: Array<{ type: string; text: string }> };
    return JSON.parse(result.content[0]!.text) as string[];
  }

  it('inherits the SDK default environment plus configured entries by default', async () => {
    const keys = await getChildEnvKeys({ env: { MARKER: 'configured' } });
    // PATH is on the SDK's curated inherit list on every platform.
    expect(keys).toContain('PATH');
    expect(keys).toContain('MARKER');
  }, 30000);

  it('passes only configured entries when inheritDefaultEnv is false', async () => {
    const keys = await getChildEnvKeys({ inheritDefaultEnv: false, env: { MARKER: 'configured' } });
    expect(keys).toContain('MARKER');
    // Curated defaults must NOT be inherited. Assert absence of specific
    // curated keys rather than exact set equality — the runtime may inject
    // its own variables into the child.
    expect(keys).not.toContain('HOME');
    expect(keys).not.toContain('LOGNAME');
    expect(keys).not.toContain('USER');
    expect(keys).not.toContain('APPDATA');
    expect(keys).not.toContain('USERPROFILE');
  }, 30000);

  it('behaves identically to unset when inheritDefaultEnv is explicitly true', async () => {
    const keys = await getChildEnvKeys({ inheritDefaultEnv: true, env: { MARKER: 'configured' } });
    expect(keys).toContain('PATH');
    expect(keys).toContain('MARKER');
  }, 30000);
});

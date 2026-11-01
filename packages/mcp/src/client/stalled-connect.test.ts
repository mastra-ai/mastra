/**
 * Teardown of connects that never finish, against a real stdio server that
 * keeps stdin open and never answers the MCP handshake. Each spawned child
 * records its pid so the tests can check that nothing outlives the client.
 */
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MCPClient } from './configuration';

const STALLED_SERVER = `
import { appendFileSync } from 'node:fs';
appendFileSync(process.argv[2], process.pid + '\\n');
process.stdin.resume();
`;

// Mirrors hosts that allow long tool calls: the connect itself never times out on its own.
const LONG_TIMEOUT_MS = 600_000;

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('MCPClient teardown of stalled connects', () => {
  let dir: string;
  let pidFile: string;
  let client: MCPClient | undefined;

  const pids = async () =>
    (await fs.readFile(pidFile, 'utf8').catch(() => ''))
      .split('\n')
      .filter(Boolean)
      .map(Number);

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'mcp-stalled-'));
    pidFile = join(dir, 'pids');
    await fs.writeFile(join(dir, 'stalled.mjs'), STALLED_SERVER);
    client = new MCPClient({
      id: `stalled-${Date.now()}-${Math.random()}`,
      timeout: LONG_TIMEOUT_MS,
      servers: {
        stalled: { command: process.execPath, args: [join(dir, 'stalled.mjs'), pidFile] },
      },
    });
  });

  afterEach(async () => {
    for (const pid of await pids()) {
      if (isAlive(pid)) process.kill(pid, 'SIGKILL');
    }
    client = undefined;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('kills the stalled child of a timed-out discovery on disconnect', async () => {
    const result = await client!.listToolsetsWithErrors({ perServerTimeoutMs: 500 });
    expect(result.errors.stalled).toBe('Discovery timed out after 500ms');
    await vi.waitFor(async () => expect(await pids()).toHaveLength(1));

    await client!.disconnect();

    await vi.waitFor(async () => expect((await pids()).filter(isAlive)).toEqual([]), { timeout: 3_000 });
  }, 20_000);

  it('resolves disconnect promptly while a reconnect to a stalled server is pending', async () => {
    await client!.listToolsetsWithErrors({ perServerTimeoutMs: 500 });
    const reconnect = client!.reconnectServer('stalled');
    reconnect.catch(() => {});
    await vi.waitFor(async () => expect(await pids()).toHaveLength(2));

    const started = Date.now();
    await client!.disconnect();
    expect(Date.now() - started).toBeLessThan(3_000);

    await expect(reconnect).rejects.toThrow();
    await vi.waitFor(async () => expect((await pids()).filter(isAlive)).toEqual([]), { timeout: 3_000 });
  }, 20_000);

  it('lets a new connection start after a disconnect that cut a reconnect short', async () => {
    await client!.listToolsetsWithErrors({ perServerTimeoutMs: 500 });
    const reconnect = client!.reconnectServer('stalled');
    reconnect.catch(() => {});
    await vi.waitFor(async () => expect(await pids()).toHaveLength(2));
    await client!.disconnect();

    const again = await client!.listToolsetsWithErrors({ perServerTimeoutMs: 500 });
    expect(again.errors.stalled).toBe('Discovery timed out after 500ms');
    await vi.waitFor(async () => expect(await pids()).toHaveLength(3));

    await client!.disconnect();
    await vi.waitFor(async () => expect((await pids()).filter(isAlive)).toEqual([]), { timeout: 3_000 });
  }, 20_000);
});

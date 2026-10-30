/**
 * Regression coverage for one stalled MCP server blocking every other server
 * (#29004). Uses the real `@mastra/mcp` client against real stdio processes:
 * a healthy server that answers the MCP handshake, and a stalled server that
 * reads requests but never replies.
 */
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMcpManager } from '../manager.js';
import type { McpManager } from '../manager.js';
import type { McpServerStatus } from '../types.js';

// Answers the handshake; an optional argv[2] delays the initialize reply by that many ms.
const HEALTHY_SERVER = `
import { createInterface } from 'node:readline';
const initDelayMs = Number(process.argv[2] ?? 0);
const send = msg => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\\n');
createInterface({ input: process.stdin }).on('line', line => {
  const req = JSON.parse(line);
  if (req.id === undefined) return;
  if (req.method === 'initialize') {
    setTimeout(() => send({
      id: req.id,
      result: {
        protocolVersion: req.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: 'healthy', version: '1.0.0' },
      },
    }), initDelayMs);
  } else if (req.method === 'tools/list') {
    send({
      id: req.id,
      result: { tools: [{ name: 'ping', description: 'Ping', inputSchema: { type: 'object', properties: {} } }] },
    });
  } else {
    send({ id: req.id, error: { code: -32601, message: 'Method not found' } });
  }
});
`;

// Keeps stdin open and swallows every request, like a server stuck in setup.
const STALLED_SERVER = `process.stdin.resume();`;

describe('MCP manager with a stalled server', () => {
  let dir: string;
  let manager: McpManager | undefined;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'mastracode-mcp-stall-'));
    // Keep the user's real global MCP config and state out of the test.
    vi.stubEnv('HOME', dir);
    vi.stubEnv('MASTRA_APP_DATA_DIR', join(dir, 'app-data'));
    vi.stubEnv('CODEX_HOME', join(dir, '.codex'));
    await fs.writeFile(join(dir, 'healthy.mjs'), HEALTHY_SERVER);
    await fs.writeFile(join(dir, 'stalled.mjs'), STALLED_SERVER);
  });

  afterEach(async () => {
    await manager?.disconnect();
    manager = undefined;
    vi.unstubAllEnvs();
    await fs.rm(dir, { recursive: true, force: true });
  });

  function createManager(
    discoveryTimeoutMs: number,
    servers: Record<string, { command: string; args: string[] }> = {
      healthy: { command: process.execPath, args: [join(dir, 'healthy.mjs')] },
      stalled: { command: process.execPath, args: [join(dir, 'stalled.mjs')] },
    },
  ): McpManager {
    return createMcpManager(join(dir, 'project'), undefined, servers, undefined, { discoveryTimeoutMs });
  }

  const statusOf = (m: McpManager, name: string): McpServerStatus | undefined =>
    m.getServerStatuses().find(s => s.name === name);

  it('reports a healthy server as connected while another server is still stalled', async () => {
    manager = createManager(60_000);
    // The stalled server keeps init() pending until the discovery timeout; don't wait on it.
    void manager.init();

    await vi.waitFor(() => expect(statusOf(manager!, 'healthy')?.connected).toBe(true), { timeout: 15_000 });

    expect(statusOf(manager, 'healthy')).toMatchObject({ connected: true, toolCount: 1, toolNames: ['healthy_ping'] });
    expect(manager.getTools()).toHaveProperty('healthy_ping');
    expect(statusOf(manager, 'stalled')).toMatchObject({ connected: false, connecting: true });
  }, 30_000);

  it('fails a stalled server with a timeout error instead of leaving it connecting forever', async () => {
    manager = createManager(2_000);

    const result = await manager.initInBackground();

    expect(result.connected.map(s => s.name)).toEqual(['healthy']);
    expect(result.failed).toHaveLength(1);
    const stalled = result.failed[0]!;
    expect(stalled.name).toBe('stalled');
    expect(stalled.connecting).toBeFalsy();
    expect(stalled.error).toMatch(/Timed out after 2s/);
  }, 30_000);

  it('connects a slow server that finishes after the discovery timeout', async () => {
    manager = createManager(1_000, {
      slow: { command: process.execPath, args: [join(dir, 'healthy.mjs'), '4000'] },
    });

    const result = await manager.initInBackground();
    expect(result.failed.map(s => s.name)).toEqual(['slow']);
    expect(result.failed[0]!.error).toMatch(/Timed out after 1s/);

    await vi.waitFor(() => expect(statusOf(manager!, 'slow')?.connected).toBe(true), { timeout: 15_000 });
    expect(statusOf(manager, 'slow')).toMatchObject({ toolCount: 1, toolNames: ['slow_ping'] });
    expect(statusOf(manager, 'slow')?.error).toBeUndefined();
    expect(manager.getTools()).toHaveProperty('slow_ping');
  }, 30_000);
});

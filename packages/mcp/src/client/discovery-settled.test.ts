/**
 * Per-server discovery callbacks against real stdio processes: a healthy server
 * that answers the MCP handshake, and a stalled server that reads requests but
 * never replies.
 */
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MCP_DISCOVERY_TIMEOUT_CODE, MCPClient } from './configuration';
import type { MCPServerSettledResult } from './configuration';

const HEALTHY_SERVER = `
import { createInterface } from 'node:readline';
const send = msg => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\\n');
createInterface({ input: process.stdin }).on('line', line => {
  const req = JSON.parse(line);
  if (req.id === undefined) return;
  if (req.method === 'initialize') {
    send({
      id: req.id,
      result: {
        protocolVersion: req.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: 'healthy', version: '1.0.0' },
      },
    });
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

describe('MCPClient discovery onServerSettled', () => {
  let dir: string;
  let client: MCPClient | undefined;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'mcp-settled-'));
    await fs.writeFile(join(dir, 'healthy.mjs'), HEALTHY_SERVER);
    await fs.writeFile(join(dir, 'stalled.mjs'), STALLED_SERVER);
    client = new MCPClient({
      id: `settled-${Date.now()}-${Math.random()}`,
      servers: {
        healthy: { command: process.execPath, args: [join(dir, 'healthy.mjs')] },
        stalled: { command: process.execPath, args: [join(dir, 'stalled.mjs')] },
      },
    });
  });

  afterEach(async () => {
    await client?.disconnect();
    client = undefined;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('reports a healthy server while another server is still pending', async () => {
    const settled: Array<[string, MCPServerSettledResult<Record<string, unknown>>]> = [];
    let aggregateDone = false;

    const pending = client!
      .listToolsetsWithErrors({
        perServerTimeoutMs: 3_000,
        onServerSettled: (serverName, result) => settled.push([serverName, result]),
      })
      .finally(() => {
        aggregateDone = true;
      });

    await vi.waitFor(() => expect(settled.map(([name]) => name)).toContain('healthy'), { timeout: 10_000 });
    expect(aggregateDone).toBe(false);
    const [, healthy] = settled.find(([name]) => name === 'healthy')!;
    expect(healthy.error).toBeUndefined();
    expect(Object.keys(healthy.value!)).toEqual(['ping']);
    expect(healthy.duration).toBeGreaterThan(0);

    const result = await pending;
    expect(Object.keys(result.toolsets)).toEqual(['healthy']);
    expect(result.errors.stalled).toBe('Discovery timed out after 3000ms');

    expect(settled.map(([name]) => name)).toEqual(['healthy', 'stalled']);
    const [, stalled] = settled[1]!;
    expect(stalled.value).toBeUndefined();
    expect(stalled.error).toEqual({ message: 'Discovery timed out after 3000ms', code: MCP_DISCOVERY_TIMEOUT_CODE });
  }, 20_000);

  it('reports per-server results from listToolsWithErrors and survives a throwing callback', async () => {
    const names: string[] = [];

    const result = await client!.listToolsWithErrors({
      perServerTimeoutMs: 2_000,
      onServerSettled: serverName => {
        names.push(serverName);
        throw new Error('callback failure');
      },
    });

    expect(names).toEqual(['healthy', 'stalled']);
    expect(Object.keys(result.tools)).toEqual(['healthy_ping']);
    expect(result.errors).toEqual({ stalled: 'Discovery timed out after 2000ms' });
  }, 20_000);

  it('does not leave an async callback rejection unhandled', async () => {
    const rejections: unknown[] = [];
    const onUnhandled = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', onUnhandled);

    try {
      const result = await client!.listToolsetsWithErrors({
        perServerTimeoutMs: 2_000,
        onServerSettled: async () => {
          throw new Error('async callback failure');
        },
      });

      expect(Object.keys(result.toolsets)).toEqual(['healthy']);
      expect(result.errors).toEqual({ stalled: 'Discovery timed out after 2000ms' });

      // Give the microtask queue and the rejection tracker a turn to report.
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(rejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  }, 20_000);

  it('discovers only the servers named in serverNames', async () => {
    const settled: string[] = [];
    const started = Date.now();
    const result = await client!.listToolsetsWithErrors({
      serverNames: ['healthy'],
      onServerSettled: name => settled.push(name),
    });

    expect(Date.now() - started).toBeLessThan(10_000);
    expect(settled).toEqual(['healthy']);
    expect(Object.keys(result.toolsets)).toEqual(['healthy']);
    expect(result.errors).toEqual({});
  }, 20_000);
});

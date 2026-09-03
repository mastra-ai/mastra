import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterEach, describe, expect, it } from 'vitest';

describe('MCPServer with protocolVersion 2026-07-28 over stdio', () => {
  const tsxCli = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');
  const fixturePath = path.join(__dirname, '..', '__fixtures__/modern-era-notification-server.ts');

  let client: Client | undefined;

  afterEach(async () => {
    await client?.close().catch(() => {});
    client = undefined;
  });

  it('preserves distinct W3C trace metadata on consecutive stdio requests', async () => {
    client = new Client(
      { name: 'modern-era-stdio-trace-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [tsxCli, fixturePath],
      stderr: 'pipe',
    });
    transport.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));
    await client.connect(transport);

    const call = async (_meta?: Record<string, unknown>) => {
      const result = (await client!.callTool({ name: 'traceContextTool', arguments: {}, _meta })) as {
        content: Array<{ text?: string }>;
      };
      return JSON.parse(result.content[0]?.text ?? '{}');
    };
    await expect(
      call({
        traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-aaaaaaaaaaaaaaaa-01',
        tracestate: 'vendor=stdio',
        baggage: 'tenant=first',
      }),
    ).resolves.toEqual({
      traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-aaaaaaaaaaaaaaaa-01',
      tracestate: 'vendor=stdio',
      baggage: 'tenant=first',
    });
    await expect(call({ traceparent: '00-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-bbbbbbbbbbbbbbbb-01' })).resolves.toEqual({
      traceparent: '00-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-bbbbbbbbbbbbbbbb-01',
    });
    await expect(call()).resolves.toEqual({});
  }, 30000);

  it('delivers tool-list-changed notifications through a modern-era subscription', async () => {
    client = new Client(
      { name: 'modern-era-stdio-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [tsxCli, fixturePath],
      stderr: 'pipe',
    });
    transport.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));
    await client.connect(transport);

    const changed = new Promise<void>(resolve => {
      client!.setNotificationHandler('notifications/tools/list_changed', async () => resolve());
    });
    const subscription = await client.listen({ toolsListChanged: true });

    try {
      expect(subscription.honoredFilter.toolsListChanged).toBe(true);
      await client.callTool({ name: 'triggerToolListChanged', arguments: {} });
      await expect(changed).resolves.toBeUndefined();
    } finally {
      await subscription.close();
    }
  }, 30000);
});

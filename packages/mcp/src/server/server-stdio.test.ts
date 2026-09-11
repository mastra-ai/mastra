import path from 'node:path';
import { Client, LOG_LEVEL_META_KEY, ProtocolError } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

describe('MCPServer over stdio (2026-07-28)', () => {
  const tsxCli = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');
  const fixturePath = path.join(__dirname, '..', '__fixtures__/notification-server.ts');

  let client: Client | undefined;

  const transport = () => {
    const t = new StdioClientTransport({ command: process.execPath, args: [tsxCli, fixturePath], stderr: 'pipe' });
    t.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));
    return t;
  };

  afterEach(async () => {
    await client?.close().catch(() => {});
    client = undefined;
  });

  it('serves discovery, subscriptions, per-request logs and native input rounds to a client', async () => {
    client = new Client(
      { name: 'stdio-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } }, capabilities: { elicitation: { form: {} } } },
    );
    client.setRequestHandler('elicitation/create', async () => ({ action: 'accept', content: { name: 'Ada' } }));
    const logs: unknown[] = [];
    client.setNotificationHandler('notifications/message', async n => {
      logs.push(n.params.data);
    });
    await client.connect(transport());
    expect(client.getDiscoverResult()?.supportedVersions).toEqual(['2026-07-28']);
    expect(client.getServerCapabilities()).not.toHaveProperty('roots');

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

    const greeted = await client.callTool({ name: 'askName', arguments: {}, _meta: { [LOG_LEVEL_META_KEY]: 'info' } });
    expect(greeted.structuredContent).toBe('hello Ada');
    expect(logs).toEqual([{ message: 'greeting' }]);
  });

  it('preserves distinct W3C trace metadata on consecutive stdio requests', async () => {
    client = new Client(
      { name: 'stdio-trace-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await client.connect(transport());

    const call = async (_meta?: Record<string, unknown>) => {
      const result = await client!.callTool({ name: 'traceContextTool', arguments: {}, _meta });
      return JSON.parse((result.content as Array<{ text?: string }>)[0]?.text ?? '{}');
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
  });

  it('rejects a legacy client instead of serving the 2025 handshake', async () => {
    client = new Client({ name: 'legacy-stdio-client', version: '1.0.0' }, { versionNegotiation: { mode: 'legacy' } });
    const error = await client.connect(transport()).then(
      () => undefined,
      e => e,
    );
    expect(error).toBeInstanceOf(ProtocolError);
    expect(error.message).toContain('Unsupported protocol version: 2025-11-25');
    expect(client.getServerCapabilities()).toBeUndefined();
  });
});

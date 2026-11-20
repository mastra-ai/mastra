import path from 'node:path';
import { Client, LOG_LEVEL_META_KEY, ProtocolError } from '@modelcontextprotocol/client';
import type { JSONRPCMessage } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskRequester } from '../client/tasks/requester';
import { TASKS_EXTENSION_ID, tasksCapabilityEntry } from '../shared/tasks';

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

  it('serves discovery, subscriptions, per-request logs and native input rounds to a 2026-07-28 client', async () => {
    client = new Client(
      { name: 'v2-stdio-client', version: '1.0.0' },
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

  it('answers tools/call with a task and serves tasks/get when tools run as tasks', async () => {
    const t = new StdioClientTransport({
      command: process.execPath,
      args: [tsxCli, path.join(__dirname, '__tests__', 'tasks-stdio-server.fixture.ts')],
      stderr: 'pipe',
    });
    t.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));
    client = new Client(
      { name: 'tasks-stdio-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } }, capabilities: { extensions: tasksCapabilityEntry() } },
    );
    await client.connect(t);
    expect(client.getServerCapabilities()?.extensions?.[TASKS_EXTENSION_ID]).toEqual({});

    // A plain SDK client can't decode a task result yet, so read it off the wire.
    const inbound: JSONRPCMessage[] = [];
    const onmessage = t.onmessage!;
    t.onmessage = (message, extra) => {
      inbound.push(message);
      onmessage(message, extra);
    };
    await client.callTool({ name: 'greet', arguments: { name: 'Ada' } }).catch(() => {});
    const created = inbound.find(message => 'result' in message)?.result as { resultType?: string; taskId?: string };
    expect(created).toMatchObject({ resultType: 'task', status: 'working' });

    const tasks = new TaskRequester(client);
    await vi.waitFor(async () => {
      expect(await tasks.get(created.taskId!)).toMatchObject({
        status: 'completed',
        result: { content: [{ type: 'text', text: 'hello Ada' }] },
      });
    });
  });
});

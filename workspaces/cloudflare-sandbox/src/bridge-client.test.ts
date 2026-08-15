import { describe, expect, it, vi } from 'vitest';
import { CloudflareSandboxBridgeClient, CloudflareSandboxBridgeError } from './bridge-client';

function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
}

describe('CloudflareSandboxBridgeClient', () => {
  it('creates a sandbox with bearer authentication', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: 'sandbox-1', status: 'running' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new CloudflareSandboxBridgeClient({ baseUrl: 'https://bridge.example/', apiToken: 'token', fetch });

    await expect(client.createSandbox()).resolves.toMatchObject({ id: 'sandbox-1' });
    expect(fetch).toHaveBeenCalledWith('https://bridge.example/sandboxes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
    });
  });

  it('writes files in one request', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new CloudflareSandboxBridgeClient({ baseUrl: 'https://bridge.example', fetch });

    await client.writeFiles('sandbox/1', [{ path: 'workspace/file.txt', content: 'hello' }]);

    expect(fetch).toHaveBeenCalledWith('https://bridge.example/sandboxes/sandbox%2F1/files', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ files: [{ path: 'workspace/file.txt', content: 'hello' }] }),
    });
  });

  it('parses command events split across stream chunks', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        streamResponse(['data: {"type":"std', 'out","data":"hello"}\n\ndata: {"type":"complete","exitCode":0}\n\n']),
      );
    const client = new CloudflareSandboxBridgeClient({ baseUrl: 'https://bridge.example', fetch });
    const events: unknown[] = [];

    await client.executeCommand(
      'sandbox-1',
      { command: 'echo hello', timeout: 30 },
      { onEvent: event => events.push(event) },
    );

    expect(events).toEqual([
      { type: 'stdout', data: 'hello' },
      { type: 'complete', exitCode: 0 },
    ]);
  });

  it('throws a descriptive error for unsuccessful responses', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('missing', { status: 404 }));
    const client = new CloudflareSandboxBridgeClient({ baseUrl: 'https://bridge.example', fetch });

    await expect(client.getSandbox('missing')).rejects.toEqual(
      expect.objectContaining<Partial<CloudflareSandboxBridgeError>>({ status: 404, body: 'missing' }),
    );
  });
});

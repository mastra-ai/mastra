import { Render } from '@renderinc/sdk';
import { afterEach, expect, it, vi } from 'vitest';
import { RenderSandbox } from './sandbox.js';

const remote = { id: 'sbx-contract', status: 'running', createdAt: '2026-10-09T00:00:00Z' };
afterEach(() => vi.unstubAllGlobals());

function publicApi(streamBody: string, status = 200) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push({ url, init });
      const path = new URL(url).pathname;
      if (path.endsWith('/terminate')) return new Response(null, { status: 204 });
      if (path.endsWith('/runs/stream/token'))
        return Response.json({
          uri: 'https://execution.example/runs/stream',
          method: 'POST',
          token: 'scoped-token',
        });
      if (url.startsWith('https://execution.example/'))
        return new Response(streamBody, { status, headers: { 'Content-Type': 'text/event-stream' } });
      return Response.json(remote);
    }),
  );
  const sandbox = new RenderSandbox({
    cancellationMode: 'terminate',
    client: new Render({ token: 'host-token', ownerId: 'tea-test' }),
  });
  return { calls, sandbox };
}

it('uses public SDK SSE parsing for stdout, stderr and nonzero final exit', async () => {
  const h = publicApi(
    'event: output\ndata: {"stream":"stdout","data":"hello"}\n\nevent: output\ndata: {"stream":"stderr","data":"warning"}\n\nevent: exit\ndata: {"exit_code":9}\n\n',
  );
  expect(await h.sandbox.executeCommand('example')).toMatchObject({
    stdout: 'hello',
    stderr: 'warning',
    exitCode: 9,
    success: false,
  });
  const connection = h.calls.find(call => call.url.startsWith('https://execution.example'))!;
  expect(connection.init?.headers).toMatchObject({ Authorization: 'Bearer scoped-token' });
  expect(JSON.stringify(connection.init?.body)).not.toContain('host-token');
  await h.sandbox.destroy();
});

it('preserves actual SDK stream errors and retained output', async () => {
  const h = publicApi(
    'event: output\ndata: {"stream":"stdout","data":"partial"}\n\nevent: error\ndata: {"status":502,"message":"relay failed"}\n\n',
  );
  await expect(h.sandbox.executeCommand('example')).rejects.toMatchObject({
    code: 'STREAM',
    details: { stdout: 'partial' },
    cause: { name: 'SandboxExecStreamError', status: 502 },
  });
  expect(h.calls.filter(call => call.url.startsWith('https://execution.example'))).toHaveLength(1);
  expect(h.calls.filter(call => new URL(call.url).pathname.endsWith('/terminate'))).toHaveLength(1);
});

it('does not mistake truncated SDK SSE for successful completion', async () => {
  const h = publicApi('event: output\ndata: {"stream":"stdout","data":"partial"}\n\n');
  await expect(h.sandbox.executeCommand('example')).rejects.toMatchObject({
    code: 'STREAM',
    details: { stdout: 'partial' },
  });
  expect(h.calls.filter(call => new URL(call.url).pathname.endsWith('/terminate'))).toHaveLength(1);
});

it('preserves public SDK HTTP authentication failure without dispatch retry', async () => {
  const h = publicApi('{"message":"unauthorized"}', 401);
  await expect(h.sandbox.executeCommand('example')).rejects.toMatchObject({
    code: 'AUTHENTICATION',
    cause: { statusCode: 401 },
  });
  expect(h.calls.filter(call => call.url.startsWith('https://execution.example'))).toHaveLength(1);
});

it('serializes current HTTPS rules through the public SDK, including the legacy domain-list bridge', async () => {
  const bodies: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      if (request.method === 'POST' && new URL(request.url).pathname.endsWith('/sandboxes'))
        bodies.push(await request.json());
      if (request.url.endsWith('/terminate')) return new Response(null, { status: 204 });
      return Response.json(remote);
    }),
  );
  const policies = [
    { type: 'allow-list' as const, rules: [{ domain: 'example.com', protocol: 'https' as const }] },
    { default: 'allow-list' as const, allowedDomains: ['example.com'] },
  ];
  for (const networkPolicy of policies) {
    const sandbox = new RenderSandbox({
      clientOptions: { token: 'test', ownerId: 'tea-test' },
      create: { networkPolicy },
    });
    await sandbox.start();
    await sandbox.destroy();
  }
  expect(bodies).toHaveLength(2);
  for (const body of bodies)
    expect(body).toMatchObject({
      networkPolicy: { default: 'allow-list', rules: [{ domain: 'example.com', protocol: 'https' }] },
    });
  expect(JSON.stringify(bodies)).not.toContain('allowedDomains');
});

it('rejects ambiguous or unsupported network rules before provisioning', () => {
  for (const networkPolicy of [
    { type: 'allow-all', default: 'deny-all' },
    { type: 'deny-all', rules: [] },
    { type: 'allow-list', rules: [] },
    { default: 'allow-list' },
    { type: 'allow-list', rules: [{ domain: 'example.com', protocol: 'http' }] },
    {
      type: 'allow-list',
      rules: [
        { domain: 'example.com', protocol: 'https' },
        { domain: 'EXAMPLE.com', protocol: 'https' },
      ],
    },
    {
      type: 'allow-list',
      rules: [{ domain: 'example.com', protocol: 'https' }],
      allowedDomains: ['example.org'],
    },
  ])
    expect(() => new RenderSandbox({ create: { networkPolicy: networkPolicy as never } })).toThrowError();
});

import type { Mastra } from '@mastra/core/mastra';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { report, startServerlessModelUsageTelemetry } = vi.hoisted(() => {
  const report = vi.fn<() => Promise<void>>();
  const startServerlessModelUsageTelemetry = vi.fn<(...args: unknown[]) => { report: typeof report } | undefined>();
  return { report, startServerlessModelUsageTelemetry };
});

vi.mock('@mastra/core/telemetry', () => ({ startServerlessModelUsageTelemetry }));

import { withModelUsageTelemetry } from '../model-usage-telemetry';

const mastra = {} as Mastra;

function streamingResponse() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const response = new Response(body, { status: 201, statusText: 'Created', headers: { 'x-test': 'yes' } });
  return { response, controller };
}

/** Lets the wrapper's post-body macrotask run, then whatever the report chains. */
async function settle() {
  await new Promise(resolve => setTimeout(resolve, 5));
}

describe('withModelUsageTelemetry', () => {
  beforeEach(() => {
    report.mockReset().mockResolvedValue(undefined);
    startServerlessModelUsageTelemetry.mockReset().mockReturnValue({ report });
  });

  it('reports after a streamed body ends, keeping the function alive with waitUntil', async () => {
    const { response, controller } = streamingResponse();
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
    const handler = await withModelUsageTelemetry(mastra, async () => response, {
      runtime: 'vercel',
      projectKey: 'prj_1',
      getWaitUntil: () => waitUntil,
    });

    const wrapped = await handler(new Request('http://localhost/api/agents/a/stream'));
    expect(startServerlessModelUsageTelemetry).toHaveBeenCalledWith(mastra, { runtime: 'vercel', projectKey: 'prj_1' });
    expect(waitUntil).toHaveBeenCalledOnce();
    expect(wrapped.status).toBe(201);
    expect(wrapped.statusText).toBe('Created');
    expect(wrapped.headers.get('x-test')).toBe('yes');

    const text = wrapped.text();
    controller.enqueue(new TextEncoder().encode('data: one\n\n'));
    await settle();
    expect(report).not.toHaveBeenCalled();

    controller.enqueue(new TextEncoder().encode('data: two\n\n'));
    controller.close();
    expect(await text).toBe('data: one\n\ndata: two\n\n');
    await waitUntil.mock.calls[0]![0];
    expect(report).toHaveBeenCalledOnce();
  });

  it('reports when the client cancels the stream', async () => {
    const { response } = streamingResponse();
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
    const handler = await withModelUsageTelemetry(mastra, () => response, {
      runtime: 'cloudflare',
      getWaitUntil: () => waitUntil,
    });

    const wrapped = await handler(new Request('http://localhost/'));
    await wrapped.body!.cancel('client went away');
    await waitUntil.mock.calls[0]![0];
    expect(report).toHaveBeenCalledOnce();
  });

  it('reports when the stream errors', async () => {
    const { response, controller } = streamingResponse();
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
    const handler = await withModelUsageTelemetry(mastra, () => response, {
      runtime: 'netlify',
      getWaitUntil: () => waitUntil,
    });

    const wrapped = await handler(new Request('http://localhost/'));
    const text = wrapped.text();
    controller.error(new Error('model failed'));
    await expect(text).rejects.toThrow('model failed');
    await waitUntil.mock.calls[0]![0];
    expect(report).toHaveBeenCalledOnce();
  });

  it('reports right away for responses without a body, and when the handler throws', async () => {
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
    const empty = new Response(null, { status: 204 });
    const handler = await withModelUsageTelemetry(
      mastra,
      (request: Request) => {
        if (request.method === 'DELETE') throw new Error('boom');
        return empty;
      },
      {
        runtime: 'vercel',
        getWaitUntil: () => waitUntil,
      },
    );

    expect(await handler(new Request('http://localhost/', { method: 'HEAD' }))).toBe(empty);
    await waitUntil.mock.calls[0]![0];
    expect(report).toHaveBeenCalledOnce();

    await expect(handler(new Request('http://localhost/', { method: 'DELETE' }))).rejects.toThrow('boom');
    await waitUntil.mock.calls[1]![0];
    expect(report).toHaveBeenCalledTimes(2);
  });

  it('passes platform arguments through and still reports without waitUntil', async () => {
    const fetch = vi.fn((_request: Request, env: { context: string }) => new Response(env.context));
    const getWaitUntil = vi.fn((_request: Request, _env: { context: string }) => undefined);
    const handler = await withModelUsageTelemetry(mastra, fetch, { runtime: 'netlify', getWaitUntil });

    const request = new Request('http://localhost/');
    expect(await (await handler(request, { context: 'ctx' })).text()).toBe('ctx');
    expect(fetch).toHaveBeenCalledWith(request, { context: 'ctx' });
    expect(getWaitUntil).toHaveBeenCalledWith(request, { context: 'ctx' });
    await settle();
    expect(report).toHaveBeenCalledOnce();
  });

  it('serves the request when reading waitUntil throws', async () => {
    const handler = await withModelUsageTelemetry(mastra, () => new Response('ok'), {
      runtime: 'cloudflare',
      getWaitUntil: () => () => {
        throw new Error('waitUntil called outside a request');
      },
    });

    expect(await (await handler(new Request('http://localhost/'))).text()).toBe('ok');
    await settle();
    expect(report).toHaveBeenCalledOnce();
  });

  it('returns the handler unchanged when usage is not counted', async () => {
    const fetch = () => new Response('ok');
    startServerlessModelUsageTelemetry.mockReturnValue(undefined);
    await expect(
      withModelUsageTelemetry(mastra, fetch, { runtime: 'vercel', getWaitUntil: () => undefined }),
    ).resolves.toBe(fetch);

    // An older @mastra/core without the export.
    startServerlessModelUsageTelemetry.mockImplementation(() => {
      throw new TypeError('startServerlessModelUsageTelemetry is not a function');
    });
    await expect(
      withModelUsageTelemetry(mastra, fetch, { runtime: 'vercel', getWaitUntil: () => undefined }),
    ).resolves.toBe(fetch);
  });
});

import { RequestContext } from '@mastra/core/request-context';
import type { ContextWithMastra } from '@mastra/core/server';
import { describe, expect, it, vi } from 'vitest';
import { liveKitRecordingRoute } from './recording-route';

function setup(
  spans: Array<Record<string, unknown>> = [
    {
      name: 'voice call',
      parentSpanId: null,
      metadata: { roomName: 'call-42', agentId: 'support' },
    },
  ],
  tenantId = 'tenant-a',
) {
  const getTrace = vi.fn(async () => ({ spans }));
  const getStorage = vi.fn(() => ({ getStore: async () => ({ getTrace }) }));
  const requestContext = new RequestContext([['tenantId', tenantId]]);
  const context = {
    req: { param: () => 'trace-42' },
    header: vi.fn(),
    json: vi.fn((body: unknown, status = 200) => ({ body, status })),
    get: (key: string) => (key === 'requestContext' ? requestContext : { getStorage }),
  } as unknown as ContextWithMastra;
  return { context, getTrace, getStorage };
}

async function call(
  options: Omit<Parameters<typeof liveKitRecordingRoute>[0], 'authorize'> &
    Partial<Pick<Parameters<typeof liveKitRecordingRoute>[0], 'authorize'>>,
  context: ContextWithMastra,
) {
  const route = liveKitRecordingRoute({ authorize: () => true, ...options });
  const handler = route.handler as (context: ContextWithMastra) => Promise<unknown>;
  return handler(context);
}

describe('liveKitRecordingRoute', () => {
  it('requires authentication by default', () => {
    expect(liveKitRecordingRoute({ authorize: () => true, resolveRecording: async () => undefined })).toMatchObject({
      path: '/voice/livekit/recordings/:traceId',
      method: 'GET',
      requiresAuth: true,
    });
  });

  it('resolves the room from the stored trace and returns only playback fields', async () => {
    const { context } = setup();
    const resolveRecording = vi.fn(async () => ({
      url: 'https://recordings.example/call-42.ogg?signature=short-lived',
      expiresAt: '2026-09-21T20:00:00.000Z',
      secret: 'must-not-leak',
    }));
    expect(await call({ resolveRecording }, context)).toEqual({
      status: 200,
      body: {
        status: 'ready',
        url: 'https://recordings.example/call-42.ogg?signature=short-lived',
        expiresAt: '2026-09-21T20:00:00.000Z',
      },
    });
    expect(resolveRecording).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: 'trace-42', roomName: 'call-42', context }),
    );
    expect(context.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it.each([true, false])('rejects missing authorization even when requiresAuth is %s', requiresAuth => {
    expect(() =>
      // @ts-expect-error JavaScript callers must also provide an authorization policy.
      liveKitRecordingRoute({ requiresAuth, resolveRecording: vi.fn() }),
    ).toThrow('liveKitRecordingRoute requires an authorize callback.');
  });

  it.each([
    ['tenant-a', 403],
    ['tenant-b', 200],
  ] as const)('checks recording ownership for authenticated %s before resolving the URL', async (tenantId, status) => {
    const { context, getTrace, getStorage } = setup(undefined, tenantId);
    const traceOwners = new Map([['trace-42', 'tenant-b']]);
    const authorize = vi.fn(
      async ({ traceId, context }: { traceId: string; context: ContextWithMastra }) =>
        traceOwners.get(traceId) === context.get('requestContext').get('tenantId'),
    );
    const resolveRecording = vi.fn(async () => ({ url: 'https://recordings.example/call.ogg' }));
    expect(await call({ authorize, resolveRecording }, context)).toMatchObject({ status });
    expect(authorize).toHaveBeenCalledWith({ traceId: 'trace-42', context });
    if (status === 403) {
      expect(getStorage).not.toHaveBeenCalled();
      expect(getTrace).not.toHaveBeenCalled();
      expect(resolveRecording).not.toHaveBeenCalled();
    } else {
      expect(getTrace).toHaveBeenCalledOnce();
      expect(resolveRecording).toHaveBeenCalledOnce();
    }
  });

  it.each([undefined, null, 'true'])('denies non-boolean authorization result %s', async value => {
    const { context, getStorage } = setup();
    const resolveRecording = vi.fn();
    expect(await call({ authorize: () => value as unknown as boolean, resolveRecording }, context)).toMatchObject({
      status: 403,
    });
    expect(getStorage).not.toHaveBeenCalled();
    expect(resolveRecording).not.toHaveBeenCalled();
  });

  it('does not read storage when authorization throws', async () => {
    const { context, getTrace, getStorage } = setup();
    const resolveRecording = vi.fn();
    const result = await call(
      {
        authorize: async () => {
          throw new Error('private-policy-error');
        },
        resolveRecording,
      },
      context,
    );
    expect(result).toEqual({ status: 502, body: { error: 'Unable to load the call recording.' } });
    expect(getStorage).not.toHaveBeenCalled();
    expect(getTrace).not.toHaveBeenCalled();
    expect(resolveRecording).not.toHaveBeenCalled();
  });

  it('checks application authorization before looking up the trace or signing a URL', async () => {
    const { context, getTrace } = setup();
    const resolveRecording = vi.fn();
    expect(await call({ authorize: () => false, resolveRecording }, context)).toMatchObject({ status: 403 });
    expect(getTrace).not.toHaveBeenCalled();
    expect(resolveRecording).not.toHaveBeenCalled();
  });

  it('does not resolve recordings for unrelated traces', async () => {
    const { context } = setup([{ name: 'agent run', metadata: { roomName: 'another-call' } }]);
    const resolveRecording = vi.fn();
    expect(await call({ resolveRecording }, context)).toMatchObject({ status: 404 });
    expect(resolveRecording).not.toHaveBeenCalled();
  });

  it('rejects ambiguous traces rather than playing another call', async () => {
    const { context } = setup([
      { name: 'voice call', metadata: { roomName: 'call-one' } },
      { name: 'voice call', metadata: { roomName: 'call-two' } },
    ]);
    const resolveRecording = vi.fn();
    expect(await call({ resolveRecording }, context)).toMatchObject({ status: 409 });
    expect(resolveRecording).not.toHaveBeenCalled();
  });

  it('reports that the recording is unavailable while storage has no file', async () => {
    const { context } = setup();
    expect(await call({ resolveRecording: async () => undefined }, context)).toEqual({
      status: 200,
      body: { status: 'unavailable' },
    });
  });

  it.each(['javascript:alert(1)', 'data:audio/ogg;base64,secret', 'not-a-url'])(
    'rejects unsafe playback URL %s',
    async url => {
      const { context } = setup();
      expect(await call({ resolveRecording: async () => ({ url }) }, context)).toMatchObject({ status: 502 });
    },
  );

  it('does not expose storage errors or credentials to the browser', async () => {
    const { context } = setup();
    const result = await call(
      {
        resolveRecording: async () => {
          throw new Error('secret-storage-credential');
        },
      },
      context,
    );
    expect(result).toEqual({ status: 502, body: { error: 'Unable to load the call recording.' } });
  });
});

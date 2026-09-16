import type { ContextWithMastra } from '@mastra/core/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveKitConnectionRoute } from './routes';

type RouteHandler = (c: ContextWithMastra) => Promise<unknown>;

function fakeContext(body: unknown = {}) {
  const json = vi.fn((payload: unknown, status?: number) => ({ payload, status: status ?? 200 }));
  const context = {
    req: { json: async () => body },
    json,
  } as unknown as ContextWithMastra;
  return { context, json };
}

function getHandler(route: ReturnType<typeof liveKitConnectionRoute>): RouteHandler {
  return (route as { handler: RouteHandler }).handler;
}

interface TokenClaims {
  video: Record<string, unknown>;
  roomConfig: { agents: Array<{ agentName: string; metadata: string }> };
  sub: string;
}

function decodeJwtPayload(token: string): TokenClaims {
  const segment = token.split('.')[1]!;
  return JSON.parse(Buffer.from(segment, 'base64url').toString());
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('liveKitConnectionRoute', () => {
  it('uses sensible route defaults', () => {
    const route = liveKitConnectionRoute();
    expect(route.path).toBe('/voice/livekit/connection-details');
    expect(route.method).toBe('POST');
  });

  it('returns 500 with guidance when LiveKit is not configured', async () => {
    vi.stubEnv('LIVEKIT_URL', '');
    vi.stubEnv('LIVEKIT_API_KEY', '');
    vi.stubEnv('LIVEKIT_API_SECRET', '');
    const { context, json } = fakeContext();
    await getHandler(liveKitConnectionRoute())(context);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('LIVEKIT_URL') }), 500);
  });

  it('mints connection details with agent dispatch metadata', async () => {
    vi.stubEnv('LIVEKIT_URL', 'wss://example.livekit.cloud');
    vi.stubEnv('LIVEKIT_API_KEY', 'devkey');
    vi.stubEnv('LIVEKIT_API_SECRET', 'secret-secret-secret-secret-secret');
    const { context, json } = fakeContext({ agentId: 'support', resourceId: 'user-9' });

    await getHandler(liveKitConnectionRoute())(context);

    const [details, status] = json.mock.calls[0]! as [Record<string, string>, number | undefined];
    expect(status).toBeUndefined();
    expect(details.serverUrl).toBe('wss://example.livekit.cloud');
    expect(details.roomName).toMatch(/^mastra-voice-/);
    expect(details.participantName).toBe('user-9');

    const claims = decodeJwtPayload(details.participantToken!);
    expect(claims.video).toMatchObject({ room: details.roomName, roomJoin: true });
    const dispatch = claims.roomConfig.agents[0]!;
    expect(dispatch.agentName).toBe('mastra-voice');
    expect(JSON.parse(dispatch.metadata)).toEqual({
      agentId: 'support',
      // The thread defaults to the room so voice sessions land in one memory thread per room.
      threadId: details.roomName,
      resourceId: 'user-9',
    });
  });

  it('uses the custom metadata builder and agent name', async () => {
    vi.stubEnv('LIVEKIT_URL', 'wss://example.livekit.cloud');
    vi.stubEnv('LIVEKIT_API_KEY', 'devkey');
    vi.stubEnv('LIVEKIT_API_SECRET', 'secret-secret-secret-secret-secret');
    const { context, json } = fakeContext({});

    await getHandler(
      liveKitConnectionRoute({
        agentName: 'custom-agent',
        roomName: 'fixed-room',
        metadata: () => ({ agentId: 'sales', threadId: 'thread-42' }),
      }),
    )(context);

    const [details] = json.mock.calls[0]! as [Record<string, string>];
    expect(details.roomName).toBe('fixed-room');
    const dispatch = decodeJwtPayload(details.participantToken!).roomConfig.agents[0]!;
    expect(dispatch.agentName).toBe('custom-agent');
    expect(JSON.parse(dispatch.metadata)).toEqual({ agentId: 'sales', threadId: 'thread-42' });
  });
});

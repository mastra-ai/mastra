import type { ContextWithMastra } from '@mastra/core/server';
import { AgentDispatch, AgentDispatchClient, Room, RoomEgress, RoomServiceClient } from 'livekit-server-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveKitRecordingOptions } from './recording';
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('liveKitConnectionRoute recording', () => {
  const credentials = {
    serverUrl: 'wss://example.livekit.cloud',
    apiKey: 'devkey',
    apiSecret: 'secret-secret-secret-secret-secret',
  };
  const recording: LiveKitRecordingOptions = {
    room: {
      audioOnly: true,
      fileOutputs: [
        {
          filepath: 'calls/{room_name}.ogg',
          output: { case: 's3', value: { bucket: 'recordings', accessKey: 'storage-key', secret: 'storage-secret' } },
        },
      ],
    },
  };

  beforeEach(() => {
    vi.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([]);
    vi.spyOn(RoomServiceClient.prototype, 'createRoom').mockResolvedValue(new Room());
    vi.spyOn(AgentDispatchClient.prototype, 'createDispatch').mockResolvedValue(new AgentDispatch());
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('Unexpected network request');
      }),
    );
  });

  it('creates the room and explicitly dispatches with server metadata, keeping storage credentials out of the token', async () => {
    const { context, json } = fakeContext({ agentId: 'support', resourceId: 'user-9' });
    const { promise, resolve } = Promise.withResolvers<AgentDispatch>();
    vi.mocked(AgentDispatchClient.prototype.createDispatch).mockReturnValue(promise);
    const result = getHandler(liveKitConnectionRoute({ ...credentials, recording, agentName: 'recorded-agent' }))(
      context,
    );

    await vi.waitFor(() => expect(AgentDispatchClient.prototype.createDispatch).toHaveBeenCalledOnce());
    expect(json).not.toHaveBeenCalled();
    resolve(new AgentDispatch());
    await result;

    const [details] = json.mock.calls[0]! as [Record<string, string>];
    expect(Object.keys(details).sort()).toEqual(['participantName', 'participantToken', 'roomName', 'serverUrl']);
    expect(RoomServiceClient.prototype.createRoom).toHaveBeenCalledExactlyOnceWith({
      name: details.roomName,
      egress: new RoomEgress(recording),
    });
    expect(AgentDispatchClient.prototype.createDispatch).toHaveBeenCalledExactlyOnceWith(
      details.roomName,
      'recorded-agent',
      {
        metadata: JSON.stringify({ agentId: 'support', threadId: details.roomName, resourceId: 'user-9' }),
      },
    );
    const claims = decodeJwtPayload(details.participantToken!);
    expect(claims.video).toMatchObject({ room: details.roomName, roomJoin: true, canPublish: true });
    expect(claims.sub).toBe('user-9');
    expect(claims.roomConfig).toBeUndefined();
    expect(JSON.stringify(claims)).not.toContain('storage-secret');
    expect(JSON.stringify(details)).not.toContain('storage-secret');
  });

  it('resolves recording per request with the body, context, and final room name', async () => {
    const body = { callId: '42' };
    const { context } = fakeContext(body);
    const builder = vi.fn(async ({ roomName }: { roomName: string }) => ({
      room: { audioOnly: true, fileOutputs: [{ filepath: `${roomName}.ogg` }] },
    }));
    await getHandler(
      liveKitConnectionRoute({
        ...credentials,
        roomName: ({ body }) => `call-${body.callId}`,
        recording: builder,
        metadata: () => ({ agentId: 'custom', threadId: 'pinned-thread', requestContext: { tenant: 'acme' } }),
      }),
    )(context);

    expect(builder).toHaveBeenCalledExactlyOnceWith({ body, context, roomName: 'call-42' });
    expect(RoomServiceClient.prototype.createRoom).toHaveBeenCalledWith({
      name: 'call-42',
      egress: new RoomEgress({ room: { audioOnly: true, fileOutputs: [{ filepath: 'call-42.ogg' }] } }),
    });
    expect(AgentDispatchClient.prototype.createDispatch).toHaveBeenCalledWith('call-42', 'mastra-voice', {
      metadata: JSON.stringify({ agentId: 'custom', threadId: 'pinned-thread', requestContext: { tenant: 'acme' } }),
    });
  });

  it.each([undefined, () => undefined, async () => undefined])(
    'preserves token-based dispatch when recording is skipped (%s)',
    async recording => {
      const { context, json } = fakeContext({ recording: { room: { audioOnly: true } } });
      await getHandler(liveKitConnectionRoute({ ...credentials, recording }))(context);
      expect(RoomServiceClient.prototype.listRooms).not.toHaveBeenCalled();
      expect(RoomServiceClient.prototype.createRoom).not.toHaveBeenCalled();
      expect(AgentDispatchClient.prototype.createDispatch).not.toHaveBeenCalled();
      const [details] = json.mock.calls[0]! as [Record<string, string>];
      expect(decodeJwtPayload(details.participantToken!).roomConfig.agents[0]!.agentName).toBe('mastra-voice');
    },
  );

  it('rejects an existing room without issuing connection details', async () => {
    vi.mocked(RoomServiceClient.prototype.listRooms).mockResolvedValue([new Room({ name: 'existing' })]);
    const { context, json } = fakeContext();
    await expect(
      getHandler(liveKitConnectionRoute({ ...credentials, roomName: 'existing', recording }))(context),
    ).rejects.toThrow('room "existing" already exists');
    expect(RoomServiceClient.prototype.createRoom).not.toHaveBeenCalled();
    expect(AgentDispatchClient.prototype.createDispatch).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it.each(['configuration', 'room', 'dispatch'])('does not issue connection details when %s fails', async stage => {
    const error = new Error('Recording setup failed');
    if (stage === 'room') vi.mocked(RoomServiceClient.prototype.createRoom).mockRejectedValue(error);
    if (stage === 'dispatch') vi.mocked(AgentDispatchClient.prototype.createDispatch).mockRejectedValue(error);
    const { context, json } = fakeContext();
    await expect(
      getHandler(
        liveKitConnectionRoute({
          ...credentials,
          recording:
            stage === 'configuration'
              ? async () => {
                  throw error;
                }
              : recording,
        }),
      )(context),
    ).rejects.toBe(error);
    expect(json).not.toHaveBeenCalled();
  });
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

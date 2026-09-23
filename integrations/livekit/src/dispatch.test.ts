import {
  AgentDispatch,
  AgentDispatchClient,
  EncodedFileType,
  Room,
  RoomEgress,
  RoomServiceClient,
} from 'livekit-server-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchVoiceSession } from './dispatch';
import type { LiveKitRecordingOptions } from './recording';

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
        fileType: EncodedFileType.OGG,
        filepath: 'calls/{room_name}-{time}.ogg',
        output: {
          case: 's3',
          value: { bucket: 'recordings', region: 'us-east-1', accessKey: 'storage-key', secret: 'storage-secret' },
        },
      },
    ],
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('dispatchVoiceSession', () => {
  const dispatch = new AgentDispatch({ id: 'AD_test', room: 'call-42', agentName: 'mastra-voice' });
  const options = { ...credentials, roomName: 'call-42' };

  beforeEach(() => {
    vi.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([]);
    vi.spyOn(RoomServiceClient.prototype, 'createRoom').mockResolvedValue(new Room({ name: options.roomName }));
    vi.spyOn(AgentDispatchClient.prototype, 'createDispatch').mockResolvedValue(dispatch);
  });

  it('preserves dispatch-only behavior and its return value without recording', async () => {
    await expect(dispatchVoiceSession(options)).resolves.toBe(dispatch);

    expect(RoomServiceClient.prototype.listRooms).not.toHaveBeenCalled();
    expect(RoomServiceClient.prototype.createRoom).not.toHaveBeenCalled();
    expect(AgentDispatchClient.prototype.createDispatch).toHaveBeenCalledExactlyOnceWith('call-42', 'mastra-voice', {
      metadata: '{}',
    });
  });

  it('waits for the recording-enabled room before dispatching with the original metadata', async () => {
    const { promise, resolve } = Promise.withResolvers<Room>();
    vi.mocked(RoomServiceClient.prototype.createRoom).mockReturnValue(promise);
    const metadata = {
      agentId: 'support',
      threadId: 'thread-42',
      resourceId: 'caller-7',
      requestContext: { tenant: 'acme' },
    };
    const result = dispatchVoiceSession({ ...options, agentName: 'phone-agent', metadata, recording });

    await vi.waitFor(() => expect(RoomServiceClient.prototype.createRoom).toHaveBeenCalledOnce());
    expect(RoomServiceClient.prototype.listRooms).toHaveBeenCalledExactlyOnceWith(['call-42']);
    expect(RoomServiceClient.prototype.createRoom).toHaveBeenCalledWith({
      name: 'call-42',
      egress: new RoomEgress(recording),
    });
    expect(AgentDispatchClient.prototype.createDispatch).not.toHaveBeenCalled();

    resolve(new Room({ name: 'call-42' }));
    await expect(result).resolves.toBe(dispatch);
    expect(AgentDispatchClient.prototype.createDispatch).toHaveBeenCalledExactlyOnceWith('call-42', 'phone-agent', {
      metadata: JSON.stringify(metadata),
    });
  });

  it('accepts LiveKit RoomEgress instances and separate-track configuration', async () => {
    const config = new RoomEgress({ tracks: { filepath: 'calls/{room_name}/{track_id}' } });
    await dispatchVoiceSession({ ...options, recording: config });
    expect(RoomServiceClient.prototype.createRoom).toHaveBeenCalledWith({ name: 'call-42', egress: config });
  });

  it('rejects existing rooms before creating or dispatching', async () => {
    vi.mocked(RoomServiceClient.prototype.listRooms).mockResolvedValue([new Room({ name: 'call-42' })]);
    await expect(dispatchVoiceSession({ ...options, recording })).rejects.toThrow('room "call-42" already exists');
    expect(RoomServiceClient.prototype.createRoom).not.toHaveBeenCalled();
    expect(AgentDispatchClient.prototype.createDispatch).not.toHaveBeenCalled();
  });

  it('rejects empty recording configuration before contacting LiveKit', async () => {
    await expect(dispatchVoiceSession({ ...options, recording: {} })).rejects.toThrow(
      'recording must configure at least one of room, participant, or tracks',
    );
    expect(RoomServiceClient.prototype.listRooms).not.toHaveBeenCalled();
    expect(AgentDispatchClient.prototype.createDispatch).not.toHaveBeenCalled();
  });

  it.each(['listRooms', 'createRoom'] as const)('propagates %s failures without dispatching', async method => {
    const error = new Error('LiveKit unavailable');
    vi.mocked(RoomServiceClient.prototype[method]).mockRejectedValue(error);
    await expect(dispatchVoiceSession({ ...options, recording })).rejects.toBe(error);
    expect(AgentDispatchClient.prototype.createDispatch).not.toHaveBeenCalled();
  });

  it('propagates dispatch failures after room creation', async () => {
    const error = new Error('Dispatch unavailable');
    vi.mocked(AgentDispatchClient.prototype.createDispatch).mockRejectedValue(error);
    await expect(dispatchVoiceSession({ ...options, recording })).rejects.toBe(error);
    expect(RoomServiceClient.prototype.createRoom).toHaveBeenCalledOnce();
  });

  it('serializes metadata before creating a room', async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(
      dispatchVoiceSession({ ...options, recording, metadata: { requestContext: circular } }),
    ).rejects.toThrow();
    expect(RoomServiceClient.prototype.listRooms).not.toHaveBeenCalled();
  });
});

describe('recording through the LiveKit SDK', () => {
  it.each([
    ['wss://example.livekit.cloud', 'https://example.livekit.cloud'],
    ['ws://localhost:7880', 'http://localhost:7880'],
    ['https://example.livekit.cloud', 'https://example.livekit.cloud'],
  ])('sends recording only in the room request using %s', async (serverUrl, httpUrl) => {
    vi.stubEnv('LIVEKIT_URL', serverUrl);
    vi.stubEnv('LIVEKIT_API_KEY', credentials.apiKey);
    vi.stubEnv('LIVEKIT_API_SECRET', credentials.apiSecret);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ rooms: [] }))
      .mockResolvedValueOnce(Response.json({ name: 'call-42' }))
      .mockResolvedValueOnce(Response.json({ id: 'AD_test', room: 'call-42', agentName: 'mastra-voice' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await dispatchVoiceSession({ roomName: 'call-42', recording });

    expect(result.id).toBe('AD_test');
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      `${httpUrl}/twirp/livekit.RoomService/ListRooms`,
      `${httpUrl}/twirp/livekit.RoomService/CreateRoom`,
      `${httpUrl}/twirp/livekit.AgentDispatchService/CreateDispatch`,
    ]);
    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({
      name: 'call-42',
      egress: {
        room: {
          audioOnly: true,
          fileOutputs: [
            {
              fileType: 'OGG',
              filepath: 'calls/{room_name}-{time}.ogg',
              s3: { bucket: 'recordings', region: 'us-east-1', accessKey: 'storage-key', secret: 'storage-secret' },
            },
          ],
        },
      },
    });
    expect(JSON.parse(fetchMock.mock.calls[2]![1]!.body as string)).toEqual({
      room: 'call-42',
      agentName: 'mastra-voice',
      metadata: '{}',
    });
  });
});

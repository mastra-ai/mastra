import { RoomEgress, RoomServiceClient } from 'livekit-server-sdk';

/**
 * LiveKit auto-egress settings, accepted as a plain object or a RoomEgress instance.
 * Use `room.audioOnly` and `room.fileOutputs` for a single mixed audio recording.
 * Storage credentials belong here on the server, never in session metadata or tokens.
 */
export type LiveKitRecordingOptions = NonNullable<ConstructorParameters<typeof RoomEgress>[0]>;

/** Creates a fresh room with recording configured before any agent or caller joins. */
export async function createRecordingRoom(options: {
  roomName: string;
  serverUrl: string;
  apiKey: string;
  apiSecret: string;
  recording: LiveKitRecordingOptions;
}) {
  const { recording, roomName } = options;
  if (!recording.room && !recording.participant && !recording.tracks) {
    throw new Error('@mastra/livekit: recording must configure at least one of room, participant, or tracks.');
  }

  const client = new RoomServiceClient(options.serverUrl.replace(/^ws/, 'http'), options.apiKey, options.apiSecret);
  // CreateRoom reuses existing rooms without applying room-composite auto-egress.
  // This preflight is not atomic: callers must use a fresh name and serialize room creation.
  const rooms = await client.listRooms([roomName]);
  if (rooms.length > 0) {
    throw new Error(
      `@mastra/livekit: recording requires a new room, but room "${roomName}" already exists. Use a fresh room name.`,
    );
  }

  return client.createRoom({ name: roomName, egress: new RoomEgress(recording) });
}

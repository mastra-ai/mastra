import { describe, expect, it, vi } from 'vitest';
import * as entry from './index';

// The root entry is loaded by Mastra server code (and by shared agent/workflow
// definition files), so it must never pull in the `@livekit/agents` runtime.
// These mock factories are evaluated lazily, on the first runtime import of the
// mocked module — if the root entry (transitively) imports one of them, the
// import of ./index throws and the file fails to load. It is a static import so the
// module graph loads outside the test's timeout, which a cold import on a
// loaded runner can exceed.
vi.mock('@livekit/agents', () => {
  throw new Error('the root entry must not load @livekit/agents — worker code belongs in @mastra/livekit/worker');
});
vi.mock('@livekit/agents-plugin-livekit', () => {
  throw new Error('the root entry must not load @livekit/agents-plugin-livekit');
});
vi.mock('@livekit/agents-plugin-silero', () => {
  throw new Error('the root entry must not load @livekit/agents-plugin-silero');
});

describe('root entry (@mastra/livekit)', () => {
  it('exposes exactly the server-safe surface, without loading the LiveKit agents runtime', () => {
    expect(Object.keys(entry).sort()).toEqual([
      'DEFAULT_LIVEKIT_AGENT_NAME',
      'LiveKitRecordingRoomConflictError',
      'createConsentTool',
      'createEndCallTool',
      'dispatchVoiceSession',
      'liveKitConnectionRoute',
      'liveKitRecordingRoute',
      'pipeAgentReplyToWriter',
      'serializeSessionMetadata',
    ]);
  });
});

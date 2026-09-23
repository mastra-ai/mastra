import { randomUUID } from 'node:crypto';
import { dispatchVoiceSession } from '@mastra/livekit';
import { getRecordingOptions, liveKitAgentName } from '../src/mastra/livekit';

const recording = getRecordingOptions();
if (!recording) {
  throw new Error('Set LIVEKIT_RECORDING_ENABLED=true and configure recording storage in .env first.');
}

const roomName = `voice-agent-recorded-${randomUUID()}`;
const dispatch = await dispatchVoiceSession({
  roomName,
  agentName: liveKitAgentName,
  metadata: { agentId: 'callCenter', threadId: roomName, resourceId: `demo-${randomUUID()}` },
  recording,
});

// Await this step before adding a SIP participant to roomName in your application.
// This script creates the room and dispatches the agent; it does not dial a phone number.
console.info({ roomName, dispatchId: dispatch.id });

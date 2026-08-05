import { AgentDispatchClient } from 'livekit-server-sdk';
import { DEFAULT_LIVEKIT_AGENT_NAME } from './constants';
import { serializeSessionMetadata } from './metadata';
import type { LiveKitSessionMetadata } from './metadata';

export interface DispatchVoiceSessionOptions {
  /** Room to dispatch the agent into (created on demand). */
  roomName: string;
  /** Must match the worker's `agentName`. Defaults to `'mastra-voice'`. */
  agentName?: string;
  metadata?: LiveKitSessionMetadata;
  /** Defaults to `LIVEKIT_URL`. */
  serverUrl?: string;
  /** Defaults to `LIVEKIT_API_KEY`. */
  apiKey?: string;
  /** Defaults to `LIVEKIT_API_SECRET`. */
  apiSecret?: string;
}

function toHttpUrl(url: string): string {
  return url.replace(/^ws/, 'http');
}

/**
 * Programmatically dispatches a Mastra voice agent into a LiveKit room — for
 * server-initiated sessions such as outbound calls or joining an existing room.
 */
export async function dispatchVoiceSession(options: DispatchVoiceSessionOptions) {
  const serverUrl = options.serverUrl ?? process.env.LIVEKIT_URL;
  const apiKey = options.apiKey ?? process.env.LIVEKIT_API_KEY;
  const apiSecret = options.apiSecret ?? process.env.LIVEKIT_API_SECRET;
  if (!serverUrl) {
    throw new Error('@mastra/livekit: set LIVEKIT_URL or pass serverUrl to dispatchVoiceSession.');
  }
  if (!apiKey || !apiSecret) {
    throw new Error(
      '@mastra/livekit: set LIVEKIT_API_KEY and LIVEKIT_API_SECRET or pass apiKey/apiSecret to dispatchVoiceSession.',
    );
  }
  const client = new AgentDispatchClient(toHttpUrl(serverUrl), apiKey, apiSecret);
  return client.createDispatch(options.roomName, options.agentName ?? DEFAULT_LIVEKIT_AGENT_NAME, {
    metadata: serializeSessionMetadata(options.metadata ?? {}),
  });
}

// Browser-safe entry point. Keep server routes, credentials, and worker runtimes out of this module.
import { MastraClient } from '@mastra/client-js';
import type { LiveKitRecordingResponse } from './recording-types';

export type { LiveKitRecording, LiveKitRecordingResponse } from './recording-types';

/** Requests a fresh playback URL using the client's authentication and fetch configuration. */
export function getLiveKitRecording(
  client: Pick<MastraClient, 'options'>,
  traceId: string,
  options?: { signal?: AbortSignal },
): Promise<LiveKitRecordingResponse> {
  // Custom integration routes mount at the server root, independently of apiPrefix.
  // A separate client preserves the original client's routing and transport settings.
  const integration = new MastraClient({ ...client.options, apiPrefix: '' });
  return integration.request(`/voice/livekit/recordings/${encodeURIComponent(traceId)}`, {
    retries: 0,
    signal: options?.signal,
  });
}

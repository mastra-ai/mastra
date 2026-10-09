import type { LiveKitRecordingOptions } from '@mastra/livekit';
import { EncodedFileType } from 'livekit-server-sdk';
import { z } from 'zod';

// Use the same name in the server and the worker. Override it to isolate a local test worker.
export const liveKitAgentName = process.env.LIVEKIT_AGENT_NAME || 'mastra-voice';

const recordingEnabledSchema = z.enum(['true', 'false']).default('false');
const storageSchema = z.object({
  RECORDINGS_S3_BUCKET: z.string().trim().min(1),
  RECORDINGS_S3_REGION: z.string().trim().min(1),
  RECORDINGS_S3_ACCESS_KEY: z.string().trim().min(1),
  RECORDINGS_S3_SECRET: z.string().min(1),
  RECORDINGS_S3_ENDPOINT: z.string().url().optional(),
});

/** Server-only, opt-in recording. Missing storage settings fail before a room is created. */
export function getRecordingOptions(): LiveKitRecordingOptions | undefined {
  if (recordingEnabledSchema.parse(process.env.LIVEKIT_RECORDING_ENABLED) === 'false') return undefined;
  const storage = getRecordingStorage();

  return {
    room: {
      audioOnly: true,
      fileOutputs: [
        {
          fileType: EncodedFileType.OGG,
          // Unique room names let review resolve the exact object from a persisted trace.
          filepath: 'voice-agent/{room_name}.ogg',
          output: {
            case: 's3',
            value: {
              bucket: storage.RECORDINGS_S3_BUCKET,
              region: storage.RECORDINGS_S3_REGION,
              accessKey: storage.RECORDINGS_S3_ACCESS_KEY,
              secret: storage.RECORDINGS_S3_SECRET,
              ...(storage.RECORDINGS_S3_ENDPOINT
                ? { endpoint: storage.RECORDINGS_S3_ENDPOINT, forcePathStyle: true }
                : {}),
            },
          },
        },
      ],
    },
  };
}

/** Shared server-only storage settings for uploads and authorized playback. */
export function getRecordingStorage() {
  const result = storageSchema.safeParse(process.env);
  if (!result.success) {
    // List setting names only; never put storage credentials in an error or log.
    const missing = result.error.issues.map(issue => issue.path.join('.')).join(', ');
    throw new Error(`Recording storage is not configured. Set these non-empty values in .env: ${missing}`);
  }
  return result.data;
}

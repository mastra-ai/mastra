import type { ApiRoute, ContextWithMastra } from '@mastra/core/server';
import type { SpanRecord } from '@mastra/core/storage';
import { z } from 'zod/v4';

const traceIdSchema = z.string().min(1).max(256);
export const recordingSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
  expiresAt: z.string().datetime().optional(),
});

/** A playback URL, normally signed with a short expiry by your storage provider. */
export type LiveKitRecording = z.infer<typeof recordingSchema>;
export type LiveKitRecordingResponse = ({ status: 'ready' } & LiveKitRecording) | { status: 'unavailable' };

export interface LiveKitRecordingResolverArgs {
  traceId: string;
  /** Taken from the stored voice call span, never from the browser request. */
  roomName: string;
  span: SpanRecord;
  context: ContextWithMastra;
}

export interface LiveKitRecordingRouteOptions {
  /** Studio discovers this route at its default path: /voice/livekit/recordings/:traceId. */
  path?: string;
  /** Defaults to true. Only disable for a local demo. */
  requiresAuth?: boolean;
  /** Required trace-specific access policy. Only true permits trace lookup and URL resolution. */
  authorize: (args: { traceId: string; context: ContextWithMastra }) => boolean | Promise<boolean>;
  /** Return a playable URL, or undefined if the recording is not available yet. */
  resolveRecording: (args: LiveKitRecordingResolverArgs) => Promise<LiveKitRecording | undefined>;
}

/** Resolves a voice call trace to a recording without persisting signed URLs in traces. */
export function liveKitRecordingRoute(options: LiveKitRecordingRouteOptions): ApiRoute {
  if (typeof options.authorize !== 'function') {
    throw new Error('liveKitRecordingRoute requires an authorize callback.');
  }
  return {
    path: options.path ?? '/voice/livekit/recordings/:traceId',
    method: 'GET',
    requiresAuth: options.requiresAuth ?? true,
    handler: async (context: ContextWithMastra) => {
      context.header('Cache-Control', 'no-store');
      const input = traceIdSchema.safeParse(context.req.param('traceId'));
      if (!input.success) return context.json({ error: 'A valid trace ID is required.' }, 400);
      const traceId = input.data;
      try {
        if ((await options.authorize({ traceId, context })) !== true) {
          return context.json({ error: 'Access to this recording is denied.' }, 403);
        }
        const store = await context.get('mastra').getStorage()?.getStore('observability');
        if (!store) return context.json({ error: 'Trace storage is not configured.' }, 503);
        const trace = await store.getTrace({ traceId });
        const calls =
          trace?.spans.filter(
            span =>
              span.name === 'voice call' &&
              typeof span.metadata?.roomName === 'string' &&
              span.metadata.roomName.length > 0,
          ) ?? [];
        if (!calls.length) return context.json({ error: 'Voice call trace not found.' }, 404);
        if (calls.length !== 1) return context.json({ error: 'This trace contains multiple voice calls.' }, 409);
        const span = calls[0]!;
        const roomName = span.metadata?.roomName;
        if (typeof roomName !== 'string') return context.json({ error: 'Voice call trace not found.' }, 404);
        const recording = await options.resolveRecording({ traceId, roomName, span, context });
        if (!recording) return context.json({ status: 'unavailable' } satisfies LiveKitRecordingResponse);
        // Validate and strip extra fields so storage credentials cannot accidentally become response fields.
        const result = recordingSchema.safeParse(recording);
        if (!result.success) return context.json({ error: 'Unable to load the call recording.' }, 502);
        return context.json({ status: 'ready', ...result.data } satisfies LiveKitRecordingResponse);
      } catch {
        // Storage/provider errors can contain credentials or signed request details.
        return context.json({ error: 'Unable to load the call recording.' }, 502);
      }
    },
  };
}

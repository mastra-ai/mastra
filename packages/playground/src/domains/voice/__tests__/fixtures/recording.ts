import type { GetLiveKitRecordingResponse, GetSystemPackagesResponse, MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { defaultSystemPackages } from '@/test/msw-server';

export const recordingEnabledPackages: GetSystemPackagesResponse = {
  ...defaultSystemPackages,
  liveKitRecordingRouteEnabled: true,
};

export const recordedTrace: Awaited<ReturnType<MastraClient['getTraceLight']>> = {
  traceId: 'call-trace',
  spans: [
    {
      traceId: 'call-trace',
      spanId: 'call-span',
      name: 'voice call',
      spanType: SpanType.GENERIC,
      isEvent: false,
      startedAt: new Date('2026-09-21T12:00:00Z'),
      createdAt: new Date('2026-09-21T12:00:00Z'),
      metadata: { roomName: 'call-room' },
    },
  ],
};

export const readyRecording: GetLiveKitRecordingResponse = {
  status: 'ready',
  url: 'https://audio.example/call-room.ogg?signature=temporary',
  expiresAt: '2026-09-21T12:30:00Z',
};

export const unavailableRecording: GetLiveKitRecordingResponse = { status: 'unavailable' };

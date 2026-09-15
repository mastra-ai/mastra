import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Zoom Server-to-Server OAuth.
 *
 * Spec: https://developers.zoom.us/docs/internal-apps/s2s-oauth/
 *
 * S2S apps use the non-standard `account_credentials` grant. There is no
 * refresh token — tokens are valid for 1 hour, then re-fetch.
 */

interface ZoomTokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  scope: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getZoomAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) {
    throw new Error('Zoom S2S OAuth not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET.');
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'account_credentials',
    account_id: accountId,
  });

  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Zoom token request failed: ${res.status} ${res.statusText}`.trim());
  }

  const data = (await res.json()) as ZoomTokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return data.access_token;
}

async function zoomFetch<T>(path: string): Promise<T> {
  const token = await getZoomAccessToken();
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Zoom API ${path} failed: ${res.status} ${res.statusText}`.trim());
  }
  return res.json() as Promise<T>;
}

const recordingFileSchema = z.object({
  id: z.string().optional(),
  meeting_id: z.string().optional(),
  recording_start: z.string().optional(),
  recording_end: z.string().optional(),
  file_type: z.string().optional(),
  file_extension: z.string().optional(),
  file_size: z.number().optional(),
  download_url: z.string().optional(),
  recording_type: z.string().optional(),
  status: z.string().optional(),
});

export const listRecentMeetings = createTool({
  id: 'listRecentMeetings',
  description:
    'List cloud recordings for a Zoom user within a date range. Defaults to the configured user "me" and the last 7 days.',
  inputSchema: z.object({
    userId: z.string().default('me').describe('Zoom user id, email, or "me".'),
    from: z.string().optional().describe('ISO date (YYYY-MM-DD). Defaults to 7 days ago.'),
    to: z.string().optional().describe('ISO date (YYYY-MM-DD). Defaults to today.'),
  }),
  outputSchema: z.object({
    meetings: z.array(
      z.object({
        uuid: z.string(),
        id: z.union([z.string(), z.number()]),
        topic: z.string(),
        start_time: z.string(),
        duration: z.number(),
        recording_files: z.array(recordingFileSchema).optional(),
      }),
    ),
  }),
  execute: async input => {
    const to = input.to ?? new Date().toISOString().slice(0, 10);
    const from = input.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const userId = input.userId ?? 'me';
    const data = await zoomFetch<{ meetings: Array<Record<string, unknown>> }>(
      `/users/${encodeURIComponent(userId)}/recordings?from=${from}&to=${to}&page_size=30`,
    );
    return { meetings: data.meetings as any };
  },
});

export const getMeetingRecording = createTool({
  id: 'getMeetingRecording',
  description:
    'Fetch the recording files for a specific Zoom meeting. Returns download URLs for video, audio (M4A), and Zoom-generated transcript (VTT) when available.',
  inputSchema: z.object({
    meetingId: z.string().describe('Zoom meeting id (numeric) or UUID.'),
  }),
  outputSchema: z.object({
    topic: z.string().optional(),
    start_time: z.string().optional(),
    duration: z.number().optional(),
    recording_files: z.array(recordingFileSchema),
  }),
  execute: async input => {
    const data = await zoomFetch<{
      topic?: string;
      start_time?: string;
      duration?: number;
      recording_files: Array<Record<string, unknown>>;
    }>(`/meetings/${encodeURIComponent(input.meetingId)}/recordings`);
    return {
      topic: data.topic,
      start_time: data.start_time,
      duration: data.duration,
      recording_files: data.recording_files as any,
    };
  },
});

export const fetchZoomTranscript = createTool({
  id: 'fetchZoomTranscript',
  description:
    "Download the Zoom-generated VTT transcript for a meeting and return it as plain text. Throws if Zoom AI Companion didn't produce a transcript for this recording.",
  inputSchema: z.object({
    meetingId: z.string(),
  }),
  outputSchema: z.object({
    transcript: z.string(),
  }),
  execute: async input => {
    const data = await zoomFetch<{ recording_files: Array<Record<string, any>> }>(
      `/meetings/${encodeURIComponent(input.meetingId)}/recordings`,
    );
    const transcriptFile = (data.recording_files ?? []).find(
      (f: Record<string, any>) => f.file_type === 'TRANSCRIPT' || f.recording_type === 'audio_transcript',
    );
    if (!transcriptFile?.download_url) {
      throw new Error(
        `No Zoom transcript found for meeting ${input.meetingId}. Enable Zoom AI Companion or use a fallback transcription service.`,
      );
    }
    const token = await getZoomAccessToken();
    const res = await fetch(transcriptFile.download_url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to download transcript: ${res.status}`);
    }
    return { transcript: await res.text() };
  },
});

export const zoomTools = {
  listRecentMeetings,
  getMeetingRecording,
  fetchZoomTranscript,
};

import { classifyProviderError } from '@mastra/core/error';
import { z } from 'zod';

const CLIENT_SESSIONS_URL = 'https://api.mistral.ai/v1/client/sessions';
const REALTIME_URL = 'wss://api.mistral.ai/v1/audio/transcriptions/realtime';
const MINT_TIMEOUT_MS = 10_000;

export interface RealtimeSession {
  url: string;
  token: string;
  expiresAt: string;
}

const clientSessionSchema = z.object({
  client_secret: z.object({ value: z.string().min(1), expires_at: z.string().min(1) }),
});

export class RealtimeSessionError extends Error {
  readonly statusCode: number;
  readonly responseBody: string;

  constructor(statusCode: number, responseBody: string) {
    super(`Realtime session request failed (${statusCode})`);
    this.name = 'RealtimeSessionError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export function keyCannotTranscribe(error: unknown): boolean {
  return (
    (error instanceof RealtimeSessionError && error.statusCode === 401) || classifyProviderError(error) === 'quota'
  );
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function mintRealtimeSession(apiKey: string, model: string): Promise<RealtimeSession> {
  const response = await fetch(CLIENT_SESSIONS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ purpose: 'realtime', model }),
    signal: AbortSignal.timeout(MINT_TIMEOUT_MS),
  });
  const body = await response.text();
  if (!response.ok) throw new RealtimeSessionError(response.status, body);
  const session = clientSessionSchema.safeParse(parseJson(body));
  if (!session.success) throw new Error('Mistral returned a realtime session without a client secret.');
  return {
    url: `${REALTIME_URL}?model=${encodeURIComponent(model)}`,
    token: session.data.client_secret.value,
    expiresAt: session.data.client_secret.expires_at,
  };
}

import { z } from 'zod/v4';

import { createRoute } from '../server-adapter/routes/route-builder';
import { getPublicOrigin } from './auth';

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const gatewayModelSchema = z.object({
  id: z.string(),
  endpoints: z.array(z.string()),
  speech: z
    .object({
      formats: z.array(z.string()),
      voices: z.array(z.string()),
    })
    .optional(),
});
const gatewayModelsSchema = z.object({ data: z.array(gatewayModelSchema) });
const speechBodySchema = z.object({
  model: z.string().min(1),
  input: z.string().min(1).max(4096),
  voice: z.string().min(1),
});

function gatewayConfig() {
  const key = process.env.MASTRA_GATEWAY_API_KEY?.trim();
  if (
    process.env.MASTRA_GATEWAY_VERSION !== 'v2' ||
    !key ||
    (!key.startsWith('msk-gateway-') && !key.startsWith('mskv2_'))
  )
    return null;
  const base = (process.env.MASTRA_GATEWAY_URL || 'https://gateway-api.mastra.ai')
    .replace(/\/+$/, '')
    .replace(/\/v1$/, '');
  return { key, base };
}

function sessionCookies(request?: Request): string | undefined {
  const cookies = request?.headers
    .get('cookie')
    ?.split(';')
    .map(value => value.trim());
  const session = cookies?.filter(value => /^(?:__Host-wos-session|wos-session)=/.test(value));
  return session?.length ? session.join('; ') : undefined;
}

async function hasAudioAccess(request?: Request): Promise<boolean> {
  if (!gatewayConfig()) return false;
  const base = process.env.MASTRA_SHARED_API_URL?.replace(/\/+$/, '');
  const cookie = sessionCookies(request);
  if (!base || !cookie) return false;
  try {
    const response = await fetch(`${base}/gateway/audio/access`, {
      headers: { cookie },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const parsed = z.object({ enabled: z.boolean() }).safeParse(await response.json());
    return parsed.success && parsed.data.enabled;
  } catch {
    return false;
  }
}

function unavailable() {
  return Response.json({ error: 'Gateway audio is unavailable' }, { status: 403 });
}

/** Cookie-authenticated audio POSTs are only used by the same-origin Studio UI. */
function trustedBrowserRequest(request?: Request): boolean {
  if (!request) return false;
  const origin = request.headers.get('origin');
  if (origin && origin !== getPublicOrigin(request)) return false;
  const site = request.headers.get('sec-fetch-site');
  return !site || site === 'same-origin' || site === 'none';
}

async function upstreamFailure(response: Response) {
  if (
    response.status >= 400 &&
    response.status < 500 &&
    response.headers.get('content-type')?.split(';', 1)[0] === 'application/json'
  ) {
    try {
      const parsed = z
        .object({ error: z.object({ message: z.string().min(1).max(500) }) })
        .safeParse(await response.json());
      if (parsed.success) return Response.json({ error: parsed.data.error.message }, { status: response.status });
    } catch {
      // Keep a stable error when the Gateway response is not valid JSON.
    }
  }
  return Response.json({ error: `Gateway audio request failed (${response.status})` }, { status: response.status });
}

export const GET_GATEWAY_AUDIO_MODELS_ROUTE = createRoute({
  method: 'GET',
  path: '/system/gateway-audio/models',
  responseType: 'datastream-response',
  requiresAuth: true,
  summary: 'List Gateway audio models available to this deployment',
  description: 'Lists speech and transcription models for deployments with Gateway audio access.',
  tags: ['System', 'Voice'],
  handler: async ({ request }) => {
    const config = gatewayConfig();
    if (!config || !(await hasAudioAccess(request))) return unavailable();
    try {
      const response = await fetch(`${config.base}/v1/models`, {
        headers: { authorization: `Bearer ${config.key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return upstreamFailure(response);
      const parsed = gatewayModelsSchema.safeParse(await response.json());
      if (!parsed.success) return Response.json({ error: 'Invalid Gateway model list' }, { status: 502 });
      return Response.json({
        speech: parsed.data.data
          .filter(model => model.endpoints.includes('speech') && model.speech?.formats.includes('mp3'))
          .map(model => ({ id: model.id, voices: model.speech?.voices ?? [] })),
        transcription: parsed.data.data
          .filter(model => model.endpoints.includes('transcription'))
          .map(model => ({ id: model.id })),
      });
    } catch {
      return Response.json({ error: 'Gateway model list unavailable' }, { status: 502 });
    }
  },
});

export const POST_GATEWAY_AUDIO_SPEECH_ROUTE = createRoute({
  method: 'POST',
  path: '/system/gateway-audio/speech',
  responseType: 'datastream-response',
  requiresAuth: true,
  bodySchema: speechBodySchema,
  summary: 'Generate Gateway MP3 speech',
  description: 'Generates an MP3 recording from text using a Gateway speech model.',
  tags: ['System', 'Voice'],
  handler: async ({ request, model, input, voice }) => {
    if (!trustedBrowserRequest(request)) return unavailable();
    const config = gatewayConfig();
    if (!config || !(await hasAudioAccess(request))) return unavailable();
    try {
      const response = await fetch(`${config.base}/v1/audio/speech`, {
        method: 'POST',
        headers: { authorization: `Bearer ${config.key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, input, voice, response_format: 'mp3' }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) return upstreamFailure(response);
      return new Response(response.body, { headers: { 'content-type': 'audio/mpeg' } });
    } catch {
      return Response.json({ error: 'Gateway speech unavailable' }, { status: 502 });
    }
  },
});

export const POST_GATEWAY_AUDIO_TRANSCRIPTION_ROUTE = createRoute({
  method: 'POST',
  path: '/system/gateway-audio/transcriptions',
  responseType: 'datastream-response',
  requiresAuth: true,
  maxBodySize: MAX_AUDIO_BYTES + 64 * 1024,
  summary: 'Transcribe recorded audio through Gateway',
  description: 'Transcribes an uploaded audio recording using a Gateway transcription model.',
  tags: ['System', 'Voice'],
  handler: async ({ request }) => {
    if (!trustedBrowserRequest(request)) return unavailable();
    const config = gatewayConfig();
    if (!config || !(await hasAudioAccess(request))) return unavailable();
    if (!request) return Response.json({ error: 'Audio request is missing' }, { status: 400 });
    try {
      const form = await request.formData();
      const model = form.get('model');
      const file = form.get('file');
      if (typeof model !== 'string' || !model || !(file instanceof File) || !file.size || file.size > MAX_AUDIO_BYTES) {
        return Response.json({ error: 'A model and audio file up to 8 MiB are required' }, { status: 400 });
      }
      const upstreamForm = new FormData();
      upstreamForm.set('model', model);
      upstreamForm.set('file', file);
      upstreamForm.set('response_format', 'json');
      const response = await fetch(`${config.base}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${config.key}` },
        body: upstreamForm,
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) return upstreamFailure(response);
      const parsed = z.object({ text: z.string() }).safeParse(await response.json());
      return parsed.success
        ? Response.json(parsed.data)
        : Response.json({ error: 'Invalid Gateway transcription' }, { status: 502 });
    } catch {
      return Response.json({ error: 'Gateway transcription unavailable' }, { status: 502 });
    }
  },
});

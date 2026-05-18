import { z } from 'zod/v4';

export const voiceSpeakersResponseSchema = z.array(
  z
    .object({
      voiceId: z.string(),
    })
    .passthrough(),
);

export const generateSpeechBodySchema = z.object({
  text: z.string(),
  speakerId: z.string().optional(),
});

export const transcribeSpeechBodySchema = z.object({
  audio: z.any(),
  options: z.record(z.string(), z.any()).optional(),
});

export const transcribeSpeechResponseSchema = z.object({
  text: z.string(),
});

export const getListenerResponseSchema = z.any();
export const speakResponseSchema = z.any();

export type VoiceRouteObject = {
  method: 'GET' | 'POST';
  path: string;
  responseType: 'json' | 'stream';
  summary: string;
  description: string;
  tags: ['Agents', 'Voice'];
  requiresAuth: true;
  deprecated?: true;
};

export const GET_SPEAKERS_ROUTE = {
  method: 'GET',
  path: '/agents/:agentId/voice/speakers',
  responseType: 'json',
  summary: 'Get voice speakers',
  description: 'Returns available voice speakers for the specified agent',
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
} satisfies VoiceRouteObject;

export const GET_SPEAKERS_DEPRECATED_ROUTE = {
  method: 'GET',
  path: '/agents/:agentId/speakers',
  responseType: 'json',
  summary: 'Get available speakers for an agent',
  description: '[DEPRECATED] Use /agents/:agentId/voice/speakers instead. Get available speakers for an agent',
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
  deprecated: true,
} satisfies VoiceRouteObject;

export const GENERATE_SPEECH_ROUTE = {
  method: 'POST',
  path: '/agents/:agentId/voice/speak',
  responseType: 'stream',
  summary: 'Generate speech',
  description: 'Generates speech audio from text using the agent voice configuration',
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
} satisfies VoiceRouteObject;

export const GENERATE_SPEECH_DEPRECATED_ROUTE = {
  method: 'POST',
  path: '/agents/:agentId/speak',
  responseType: 'stream',
  summary: 'Convert text to speech',
  description:
    "[DEPRECATED] Use /agents/:agentId/voice/speak instead. Convert text to speech using the agent's voice provider",
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
  deprecated: true,
} satisfies VoiceRouteObject;

export const TRANSCRIBE_SPEECH_ROUTE = {
  method: 'POST',
  path: '/agents/:agentId/voice/listen',
  responseType: 'json',
  summary: 'Transcribe speech',
  description: 'Transcribes speech audio to text using the agent voice configuration',
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
} satisfies VoiceRouteObject;

export const TRANSCRIBE_SPEECH_DEPRECATED_ROUTE = {
  method: 'POST',
  path: '/agents/:agentId/listen',
  responseType: 'json',
  summary: 'Convert speech to text',
  description:
    "[DEPRECATED] Use /agents/:agentId/voice/listen instead. Convert speech to text using the agent's voice provider. Additional provider-specific options can be passed as query parameters.",
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
  deprecated: true,
} satisfies VoiceRouteObject;

export const GET_LISTENER_ROUTE = {
  method: 'GET',
  path: '/agents/:agentId/voice/listener',
  responseType: 'json',
  summary: 'Get voice listener',
  description: 'Returns the voice listener configuration for the agent',
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
} satisfies VoiceRouteObject;

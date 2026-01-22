import { Readable } from 'node:stream';
import { MastraError } from '@mastra/core/error';
import { HTTPException } from '../http-exception';
import {
  agentIdPathParams,
  voiceSpeakersResponseSchema,
  generateSpeechBodySchema,
  speakResponseSchema,
  transcribeSpeechBodySchema,
  transcribeSpeechResponseSchema,
  getListenerResponseSchema,
} from '../schemas/agents';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';
import { validateBody } from './utils';

// ============================================================================
// Route Objects
// ============================================================================

export const GET_SPEAKERS_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/:agentId/voice/speakers',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  responseSchema: voiceSpeakersResponseSchema,
  summary: 'Get voice speakers',
  description: 'Returns available voice speakers for the specified agent',
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, requestContext }) => {
    try {
      if (!agentId) {
        throw new HTTPException(400, { message: 'Agent ID is required' });
      }

      const agent = mastra.getAgentById(agentId);

      if (!agent) {
        throw new HTTPException(404, { message: 'Agent not found' });
      }

      const voice = await agent.getVoice({ requestContext });

      const speakers = await Promise.resolve()
        .then(() => voice.getSpeakers())
        .catch(err => {
          if (err instanceof MastraError) {
            // No voice provider configured, return empty array
            return [];
          }
          throw err;
        });

      return speakers;
    } catch (error) {
      return handleError(error, 'Error getting speakers');
    }
  },
});

export const GET_SPEAKERS_DEPRECATED_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/:agentId/speakers',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  responseSchema: voiceSpeakersResponseSchema,
  summary: 'Get available speakers for an agent',
  description: '[DEPRECATED] Use /api/agents/:agentId/voice/speakers instead. Get available speakers for an agent',
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
  handler: GET_SPEAKERS_ROUTE.handler,
});

export const GENERATE_SPEECH_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/voice/speak',
  responseType: 'stream',
  pathParamSchema: agentIdPathParams,
  bodySchema: generateSpeechBodySchema,
  responseSchema: speakResponseSchema,
  summary: 'Generate speech',
  description: 'Generates speech audio from text using the agent voice configuration',
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, text, speakerId, requestContext }) => {
    try {
      if (!agentId) {
        throw new HTTPException(400, { message: 'Agent ID is required' });
      }

      validateBody({ text });

      const agent = mastra.getAgentById(agentId);

      if (!agent) {
        throw new HTTPException(404, { message: 'Agent not found' });
      }

      const voice = await agent.getVoice({ requestContext });

      if (!voice) {
        throw new HTTPException(400, { message: 'Agent does not have voice capabilities' });
      }

      const audioStream = await Promise.resolve()
        .then(() => voice.speak(text!, { speaker: speakerId! }))
        .catch(err => {
          if (err instanceof MastraError) {
            throw new HTTPException(400, { message: err.message });
          }

          throw err;
        });

      if (!audioStream) {
        throw new HTTPException(500, { message: 'Failed to generate speech' });
      }

      return audioStream as unknown as ReadableStream<any>;
    } catch (error) {
      return handleError(error, 'Error generating speech');
    }
  },
});

export const GENERATE_SPEECH_DEPRECATED_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/speak',
  responseType: 'stream',
  pathParamSchema: agentIdPathParams,
  bodySchema: generateSpeechBodySchema,
  responseSchema: speakResponseSchema,
  summary: 'Convert text to speech',
  description:
    "[DEPRECATED] Use /api/agents/:agentId/voice/speak instead. Convert text to speech using the agent's voice provider",
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
  handler: GENERATE_SPEECH_ROUTE.handler,
});

export const TRANSCRIBE_SPEECH_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/voice/listen',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  bodySchema: transcribeSpeechBodySchema,
  responseSchema: transcribeSpeechResponseSchema,
  summary: 'Transcribe speech',
  description: 'Transcribes speech audio to text using the agent voice configuration',
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, audio, options, requestContext }) => {
    try {
      if (!agentId) {
        throw new HTTPException(400, { message: 'Agent ID is required' });
      }

      if (!audio) {
        throw new HTTPException(400, { message: 'Audio data is required' });
      }

      const agent = mastra.getAgentById(agentId);

      if (!agent) {
        throw new HTTPException(404, { message: 'Agent not found' });
      }

      const voice = await agent.getVoice({ requestContext });

      if (!voice) {
        throw new HTTPException(400, { message: 'Agent does not have voice capabilities' });
      }

      const audioStream = new Readable();
      audioStream.push(audio);
      audioStream.push(null);

      const text = await voice.listen(audioStream, options);
      return { text: text as string };
    } catch (error) {
      return handleError(error, 'Error transcribing speech');
    }
  },
});

export const TRANSCRIBE_SPEECH_DEPRECATED_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/listen',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  bodySchema: transcribeSpeechBodySchema,
  responseSchema: transcribeSpeechResponseSchema,
  summary: 'Convert speech to text',
  description:
    "[DEPRECATED] Use /api/agents/:agentId/voice/listen instead. Convert speech to text using the agent's voice provider. Additional provider-specific options can be passed as query parameters.",
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
  handler: TRANSCRIBE_SPEECH_ROUTE.handler,
});

export const GET_LISTENER_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/:agentId/voice/listener',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  responseSchema: getListenerResponseSchema,
  summary: 'Get voice listener',
  description: 'Returns the voice listener configuration for the agent',
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, requestContext }) => {
    try {
      if (!agentId) {
        throw new HTTPException(400, { message: 'Agent ID is required' });
      }

      const agent = mastra.getAgentById(agentId);

      if (!agent) {
        throw new HTTPException(404, { message: 'Agent not found' });
      }

      const voice = await agent.getVoice({ requestContext });

      const listeners = await Promise.resolve()
        .then(() => voice.getListener())
        .catch(err => {
          if (err instanceof MastraError) {
            // No voice provider configured
            return { enabled: false };
          }
          throw err;
        });

      return listeners;
    } catch (error) {
      return handleError(error, 'Error getting listeners');
    }
  },
});

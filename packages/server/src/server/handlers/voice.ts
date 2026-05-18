import { Readable } from 'node:stream';
import {
  GET_LISTENER_ROUTE as GET_LISTENER_ROUTE_OBJECT,
  GET_SPEAKERS_DEPRECATED_ROUTE as GET_SPEAKERS_DEPRECATED_ROUTE_OBJECT,
  GET_SPEAKERS_ROUTE as GET_SPEAKERS_ROUTE_OBJECT,
  GENERATE_SPEECH_DEPRECATED_ROUTE as GENERATE_SPEECH_DEPRECATED_ROUTE_OBJECT,
  GENERATE_SPEECH_ROUTE as GENERATE_SPEECH_ROUTE_OBJECT,
  TRANSCRIBE_SPEECH_DEPRECATED_ROUTE as TRANSCRIBE_SPEECH_DEPRECATED_ROUTE_OBJECT,
  TRANSCRIBE_SPEECH_ROUTE as TRANSCRIBE_SPEECH_ROUTE_OBJECT,
  generateSpeechBodySchema,
  getListenerResponseSchema,
  speakResponseSchema,
  transcribeSpeechBodySchema,
  transcribeSpeechResponseSchema,
  voiceSpeakersResponseSchema,
} from '@internal/voice/routes';
import { MastraError } from '@mastra/core/error';
import { HTTPException } from '../http-exception';
import { agentIdPathParams } from '../schemas/agents';
import { createRoute } from '../server-adapter/routes/route-builder';

import { getAgentFromSystem } from './agents';
import { handleError } from './error';
import { validateBody } from './utils';

// ============================================================================
// Route Objects
// ============================================================================

export const GET_SPEAKERS_ROUTE = createRoute({
  ...GET_SPEAKERS_ROUTE_OBJECT,
  pathParamSchema: agentIdPathParams,
  responseSchema: voiceSpeakersResponseSchema,
  handler: async ({ mastra, agentId, requestContext }) => {
    try {
      if (!agentId) {
        throw new HTTPException(400, { message: 'Agent ID is required' });
      }

      const agent = await getAgentFromSystem({ mastra, agentId });

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
  ...GET_SPEAKERS_DEPRECATED_ROUTE_OBJECT,
  pathParamSchema: agentIdPathParams,
  responseSchema: voiceSpeakersResponseSchema,
  handler: GET_SPEAKERS_ROUTE.handler,
});

export const GENERATE_SPEECH_ROUTE = createRoute({
  ...GENERATE_SPEECH_ROUTE_OBJECT,
  pathParamSchema: agentIdPathParams,
  bodySchema: generateSpeechBodySchema,
  responseSchema: speakResponseSchema,
  handler: async ({ mastra, agentId, text, speakerId, requestContext }) => {
    try {
      if (!agentId) {
        throw new HTTPException(400, { message: 'Agent ID is required' });
      }

      validateBody({ text });

      const agent = await getAgentFromSystem({ mastra, agentId });

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
  ...GENERATE_SPEECH_DEPRECATED_ROUTE_OBJECT,
  pathParamSchema: agentIdPathParams,
  bodySchema: generateSpeechBodySchema,
  responseSchema: speakResponseSchema,
  handler: GENERATE_SPEECH_ROUTE.handler,
});

export const TRANSCRIBE_SPEECH_ROUTE = createRoute({
  ...TRANSCRIBE_SPEECH_ROUTE_OBJECT,
  pathParamSchema: agentIdPathParams,
  bodySchema: transcribeSpeechBodySchema,
  responseSchema: transcribeSpeechResponseSchema,
  handler: async ({ mastra, agentId, audio, options, requestContext }) => {
    try {
      if (!agentId) {
        throw new HTTPException(400, { message: 'Agent ID is required' });
      }

      if (!audio) {
        throw new HTTPException(400, { message: 'Audio data is required' });
      }

      const agent = await getAgentFromSystem({ mastra, agentId });

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
  ...TRANSCRIBE_SPEECH_DEPRECATED_ROUTE_OBJECT,
  pathParamSchema: agentIdPathParams,
  bodySchema: transcribeSpeechBodySchema,
  responseSchema: transcribeSpeechResponseSchema,
  handler: TRANSCRIBE_SPEECH_ROUTE.handler,
});

export const GET_LISTENER_ROUTE = createRoute({
  ...GET_LISTENER_ROUTE_OBJECT,
  pathParamSchema: agentIdPathParams,
  responseSchema: getListenerResponseSchema,
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

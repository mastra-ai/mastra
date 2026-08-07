import { Readable } from 'node:stream';
import { ErrorDomain, MastraError } from '@internal/core/error';
import type { RequestContext } from '@internal/core/request-context';
import { createRoute } from '@internal/core/routes';
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
  audio: z.unknown(),
  options: z.record(z.string(), z.unknown()).optional(),
});

export const transcribeSpeechResponseSchema = z.object({
  text: z.string(),
});

export const getListenerResponseSchema = z.unknown();
export const speakResponseSchema = z.unknown();

const agentIdPathParams = z.object({
  agentId: z.string().describe('Agent ID'),
});

type StatusCode = 400 | 404 | 500;

class HTTPException extends Error {
  readonly status: StatusCode;

  constructor(status: StatusCode, options: { message?: string; cause?: unknown; stack?: string } = {}) {
    super(options.message, { cause: options.cause });
    this.status = status;
    this.stack = options.stack || this.stack;
  }
}

type ApiError = Error & {
  status?: number;
  details?: {
    status?: number;
  };
};

function isMastraVoiceError(error: unknown): error is MastraError {
  return (
    error instanceof MastraError ||
    (typeof error === 'object' && error !== null && 'domain' in error && error.domain === ErrorDomain.MASTRA_VOICE) ||
    (error instanceof Error && error.message === 'No voice provider configured')
  );
}

function handleError(error: unknown, defaultMessage: string): never {
  const apiError = error as ApiError;
  const status = apiError.status || apiError.details?.status || 500;

  throw new HTTPException(status as StatusCode, {
    message: apiError.message || defaultMessage,
    stack: apiError.stack,
    cause: apiError.cause,
  });
}

function validateBody(data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === '') {
      throw new HTTPException(400, { message: `${key} is required` });
    }
  }
}

async function getAgentFromSystem({
  mastra,
  agentId,
  requestContext,
}: {
  mastra: any;
  agentId: string;
  requestContext?: RequestContext;
}): Promise<any> {
  const logger = mastra.getLogger?.();

  if (!agentId) {
    throw new HTTPException(400, { message: 'Agent ID is required' });
  }

  let agent: any;

  try {
    agent = mastra.getAgentById(agentId);
  } catch (error) {
    logger?.debug?.('Error getting agent from mastra, searching agents for agent', error);
  }

  if (!agent) {
    logger?.debug?.('Agent not found, looking through sub-agents', { agentId });
    const agents = mastra.listAgents?.();
    if (Object.keys(agents || {}).length) {
      for (const ag of Object.values(agents)) {
        try {
          const subAgents = await (ag as any).listAgents();
          const subAgent = subAgents[agentId];
          if (subAgent) {
            agent = subAgent;
            break;
          }
        } catch (error) {
          logger?.debug?.('Error getting agent from agent', error);
        }
      }
    }
  }

  if (agent && mastra.getEditor) {
    try {
      const editorAgent = mastra.getEditor()?.agent;
      if (editorAgent) {
        agent = await editorAgent.applyStoredOverrides(agent, { status: 'published' }, requestContext);
      }
    } catch (error) {
      logger?.debug?.('Error applying stored overrides to code agent', error);
    }
  }

  if (!agent) {
    logger?.debug?.('Agent not found in code-defined agents, looking in stored agents', { agentId });
    try {
      agent = (await mastra.getEditor?.()?.agent.getById(agentId)) ?? null;
    } catch (error) {
      logger?.debug?.('Error getting stored agent', error);
    }
  }

  if (!agent) {
    throw new HTTPException(404, { message: `Agent with id ${agentId} not found` });
  }

  return agent;
}

export const GET_SPEAKERS_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/:agentId/voice/speakers',
  responseType: 'json',
  summary: 'Get voice speakers',
  description: 'Returns available voice speakers for the specified agent',
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
  pathParamSchema: agentIdPathParams,
  responseSchema: voiceSpeakersResponseSchema,
  handler: async ({ mastra, agentId, requestContext }) => {
    try {
      if (!agentId) {
        throw new HTTPException(400, { message: 'Agent ID is required' });
      }

      const agent = await getAgentFromSystem({ mastra, agentId, requestContext });
      const voice = await agent.getVoice({ requestContext });

      const speakers = await Promise.resolve()
        .then(() => voice.getSpeakers())
        .catch(err => {
          if (isMastraVoiceError(err)) {
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
  summary: 'Get available speakers for an agent',
  description: '[DEPRECATED] Use /agents/:agentId/voice/speakers instead. Get available speakers for an agent',
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
  deprecated: true,
  pathParamSchema: agentIdPathParams,
  responseSchema: voiceSpeakersResponseSchema,
  handler: GET_SPEAKERS_ROUTE.handler,
});

export const GENERATE_SPEECH_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/voice/speak',
  responseType: 'datastream-response',
  summary: 'Generate speech',
  description: 'Generates speech audio from text using the agent voice configuration',
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
  pathParamSchema: agentIdPathParams,
  bodySchema: generateSpeechBodySchema,
  responseSchema: speakResponseSchema,
  handler: async ({ mastra, agentId, text, speakerId, requestContext }) => {
    try {
      if (!agentId) {
        throw new HTTPException(400, { message: 'Agent ID is required' });
      }

      validateBody({ text });

      const agent = await getAgentFromSystem({ mastra, agentId, requestContext });
      const voice = await agent.getVoice({ requestContext });

      if (!voice) {
        throw new HTTPException(400, { message: 'Agent does not have voice capabilities' });
      }

      const audioStream = await Promise.resolve()
        .then(() => voice.speak(text!, { speaker: speakerId! }))
        .catch(err => {
          if (isMastraVoiceError(err)) {
            throw new HTTPException(400, { message: err.message });
          }

          throw err;
        });

      if (!audioStream) {
        throw new HTTPException(500, { message: 'Failed to generate speech' });
      }

      const webStream =
        audioStream instanceof ReadableStream
          ? audioStream
          : audioStream instanceof Readable
            ? (Readable.toWeb(audioStream) as unknown as ReadableStream<any>)
            : (audioStream as unknown as ReadableStream<any>);

      return new Response(webStream, {
        headers: { 'Content-Type': 'audio/mpeg' },
      });
    } catch (error) {
      return handleError(error, 'Error generating speech');
    }
  },
});

export const GENERATE_SPEECH_DEPRECATED_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/speak',
  responseType: 'datastream-response',
  summary: 'Convert text to speech',
  description:
    "[DEPRECATED] Use /agents/:agentId/voice/speak instead. Convert text to speech using the agent's voice provider",
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
  deprecated: true,
  pathParamSchema: agentIdPathParams,
  bodySchema: generateSpeechBodySchema,
  responseSchema: speakResponseSchema,
  handler: GENERATE_SPEECH_ROUTE.handler,
});

export const TRANSCRIBE_SPEECH_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/voice/listen',
  responseType: 'json',
  summary: 'Transcribe speech',
  description: 'Transcribes speech audio to text using the agent voice configuration',
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
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

      const agent = await getAgentFromSystem({ mastra, agentId, requestContext });
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
  summary: 'Convert speech to text',
  description:
    "[DEPRECATED] Use /agents/:agentId/voice/listen instead. Convert speech to text using the agent's voice provider. Additional provider-specific options can be passed as query parameters.",
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
  deprecated: true,
  pathParamSchema: agentIdPathParams,
  bodySchema: transcribeSpeechBodySchema,
  responseSchema: transcribeSpeechResponseSchema,
  handler: TRANSCRIBE_SPEECH_ROUTE.handler,
});

export const GET_LISTENER_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/:agentId/voice/listener',
  responseType: 'json',
  summary: 'Get voice listener',
  description: 'Returns the voice listener configuration for the agent',
  tags: ['Agents', 'Voice'],
  requiresAuth: true,
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
          if (isMastraVoiceError(err)) {
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

import { Readable } from 'stream';
import type { Agent } from '@mastra/core/agent';
import { MastraError } from '@mastra/core/error';
import type { RequestContext } from '@mastra/core/request-context';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';

import { handleError } from './error';
import { validateBody } from './utils';

interface VoiceContext extends Context {
  agentId?: string;
  requestContext?: RequestContext;
}

/**
 * Get available speakers for an agent
 */
export async function getSpeakersHandler({ mastra, agentId, requestContext }: VoiceContext) {
  try {
    if (!agentId) {
      throw new HTTPException(400, { message: 'Agent ID is required' });
    }

    const agent = mastra.getAgentById(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const voice = await agent.getVoice({ requestContext });

    if (!voice) {
      throw new HTTPException(400, { message: 'Agent does not have voice capabilities' });
    }

    const speakers = await voice.getSpeakers();
    return speakers;
  } catch (error) {
    return handleError(error, 'Error getting speakers');
  }
}

/**
 * Generate speech from text
 */
export async function generateSpeechHandler({
  mastra,
  agentId,
  body,
  requestContext,
}: VoiceContext & {
  body?: {
    text?: string;
    speakerId?: string;
  };
}) {
  try {
    if (!agentId) {
      throw new HTTPException(400, { message: 'Agent ID is required' });
    }

    validateBody({
      text: body?.text,
    });

    const agent = mastra.getAgentById(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const voice = await agent.getVoice({ requestContext });

    if (!voice) {
      throw new HTTPException(400, { message: 'Agent does not have voice capabilities' });
    }

    const audioStream = await Promise.resolve()
      .then(() => voice.speak(body!.text!, { speaker: body!.speakerId! }))
      .catch(err => {
        if (err instanceof MastraError) {
          throw new HTTPException(400, { message: err.message });
        }

        throw err;
      });

    if (!audioStream) {
      throw new HTTPException(500, { message: 'Failed to generate speech' });
    }

    return audioStream;
  } catch (error) {
    return handleError(error, 'Error generating speech');
  }
}

/**
 * Transcribe speech to text
 */
export async function transcribeSpeechHandler({
  mastra,
  agentId,
  body,
  requestContext,
}: VoiceContext & {
  body?: {
    audioData?: Buffer;
    options?: Parameters<NonNullable<Agent['voice']>['listen']>[1];
  };
}) {
  try {
    if (!agentId) {
      throw new HTTPException(400, { message: 'Agent ID is required' });
    }

    if (!body?.audioData) {
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
    audioStream.push(body.audioData);
    audioStream.push(null);

    const text = await voice.listen(audioStream, body.options);
    return { text };
  } catch (error) {
    return handleError(error, 'Error transcribing speech');
  }
}

/**
 * Get available listeners for an agent
 */
export async function getListenerHandler({ mastra, agentId, requestContext }: VoiceContext) {
  try {
    if (!agentId) {
      throw new HTTPException(400, { message: 'Agent ID is required' });
    }

    const agent = mastra.getAgentById(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const voice = await agent.getVoice({ requestContext });

    if (!voice) {
      throw new HTTPException(400, { message: 'Agent does not have voice capabilities' });
    }

    const listeners = await voice.getListener();
    return listeners;
  } catch (error) {
    return handleError(error, 'Error getting listeners');
  }
}

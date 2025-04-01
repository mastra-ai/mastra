import { Readable } from 'stream';
import type { Agent } from '@mastra/core/agent';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';

import { handleError } from './error';
import { validateBody } from './utils';

interface VoiceContext extends Context {
  agentId?: string;
}

/**
 * Get available speakers for an agent
 */
export async function getSpeakersHandler({ mastra, agentId }: VoiceContext) {
  try {
    if (!agentId) {
      throw new HTTPException(400, { message: 'Agent ID is required' });
    }

    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    if (!agent.voice) {
      throw new HTTPException(400, { message: 'Agent does not have voice capabilities' });
    }

    const speakers = await agent.voice.getSpeakers();
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
      text: undefined,
      speakerId: undefined,
      ...body,
    });

    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    if (!agent.voice) {
      throw new HTTPException(400, { message: 'Agent does not have voice capabilities' });
    }

    const audioStream = await agent.voice.speak(body!.text!, { speaker: body!.speakerId! });

    if (!audioStream) {
      throw new HTTPException(500, { message: 'Failed to generate speech' });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const audioData = Buffer.concat(chunks);

    return { audioData };
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

    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    if (!agent.voice) {
      throw new HTTPException(400, { message: 'Agent does not have voice capabilities' });
    }

    const audioStream = new Readable();
    audioStream.push(body.audioData);
    audioStream.push(null);

    const text = await agent.voice.listen(audioStream, body.options);
    return { text };
  } catch (error) {
    return handleError(error, 'Error transcribing speech');
  }
}

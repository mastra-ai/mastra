import type { Mastra } from '@mastra/core/mastra';
import {
  getSpeakersHandler as getOriginalSpeakersHandler,
  generateSpeechHandler as getOriginalGenerateSpeechHandler,
  getListenerHandler as getOriginalListenerHandler,
  transcribeSpeechHandler as getOriginalTranscribeSpeechHandler,
} from '@mastra/server/handlers/voice';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { handleError } from '../../error.js';

/**
 * Get available speakers for an agent
 */
export async function getSpeakersHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const requestContext = c.get('requestContext');

    const speakers = await getOriginalSpeakersHandler({
      mastra,
      agentId,
      requestContext,
    });

    return c.json(speakers);
  } catch (error) {
    return handleError(error, 'Error getting speakers');
  }
}

/**
 * Convert text to speech using the agent's voice provider
 */
export async function generateSpeechHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const requestContext = c.get('requestContext');
    const { input, options } = await c.req.json();

    const audioStream = await getOriginalGenerateSpeechHandler({
      mastra,
      agentId,
      requestContext,
      body: { text: input, speakerId: options?.speakerId },
    });

    c.header('Content-Type', `audio/${options?.filetype ?? 'mp3'}`);
    c.header('Transfer-Encoding', 'chunked');

    return c.body(audioStream as any);
  } catch (error) {
    return handleError(error, 'Error generating speech');
  }
}

/**
 * Get available speakers for an agent
 */
export async function getListenerHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const requestContext = c.get('requestContext');
    const listeners = await getOriginalListenerHandler({
      mastra,
      agentId,
      requestContext,
    });

    return c.json(listeners);
  } catch (error) {
    return handleError(error, 'Error getting listener');
  }
}

/**
 * Convert speech to text using the agent's voice provider
 */
export async function transcribeSpeechHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const requestContext = c.get('requestContext');
    const formData = await c.req.formData();
    const audioFile = formData.get('audio');
    const options = formData.get('options');

    if (!audioFile || !(audioFile instanceof File)) {
      throw new HTTPException(400, { message: 'Audio file is required' });
    }

    const audioData = await audioFile.arrayBuffer();
    let parsedOptions = {};

    try {
      parsedOptions = options ? JSON.parse(options as string) : {};
    } catch {
      // Ignore parsing errors and use empty options
    }

    const transcription = await getOriginalTranscribeSpeechHandler({
      mastra,
      agentId,
      requestContext,
      body: {
        audioData: Buffer.from(audioData),
        options: parsedOptions,
      },
    });

    return c.json({ text: transcription?.text });
  } catch (error) {
    return handleError(error, 'Error transcribing speech');
  }
}

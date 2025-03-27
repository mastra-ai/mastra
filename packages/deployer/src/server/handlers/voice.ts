import type { Mastra } from '@mastra/core';
import {
  getSpeakersHandler as getOriginalSpeakersHandler,
  speakHandler as getOriginalSpeakHandler,
  listenHandler as getOriginalListenHandler,
} from '@mastra/server/handlers/voice';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { handleError } from './error.js';

/**
 * Get available speakers for an agent
 */
export async function getSpeakersHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');

    const speakers = await getOriginalSpeakersHandler({
      mastra,
      agentId,
    });

    return c.json(speakers);
  } catch (error) {
    return handleError(error, 'Error getting speakers');
  }
}

/**
 * Convert text to speech using the agent's voice provider
 */
export async function speakHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const { input, options } = await c.req.json();

    const audioStream = await getOriginalSpeakHandler({
      mastra,
      agentId,
      body: { input, options },
    });

    c.header('Content-Type', `audio/${options?.filetype ?? 'mp3'}`);
    c.header('Transfer-Encoding', 'chunked');

    return c.body(audioStream as any);
  } catch (error) {
    return handleError(error, 'Error generating speech');
  }
}

/**
 * Convert speech to text using the agent's voice provider
 */
export async function listenHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');

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
    } catch (error) {
      // Ignore parsing errors and use empty options
    }

    const transcription = await getOriginalListenHandler({
      mastra,
      agentId,
      audioBuffer: Buffer.from(audioData),
      options: parsedOptions,
    });

    return c.json({ text: transcription });
  } catch (error) {
    return handleError(error, 'Error transcribing speech');
  }
}

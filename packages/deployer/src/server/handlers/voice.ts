import { Readable } from 'stream';
import type { Mastra } from '@mastra/core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { handleError } from './error.js';
import { validateBody } from './utils.js';

/**
 * Get available speakers for an agent
 */
export async function getSpeakersHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    if (!agent.voice) {
      throw new HTTPException(400, { message: 'Agent does not have voice capabilities' });
    }

    const speakers = await agent.getSpeakers();
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
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    if (!agent.voice) {
      throw new HTTPException(400, { message: 'Agent does not have voice capabilities' });
    }

    const { input, options } = await c.req.json();
    await validateBody({ input });

    const audioStream = await agent.voice.speak(input, options);

    c.header('Content-Type', `audio/${options.filetype ?? 'mp3'}`);
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
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    if (!agent.voice) {
      throw new HTTPException(400, { message: 'Agent does not have voice capabilities' });
    }

    const formData = await c.req.formData();
    const audioFile = formData.get('audio');
    const options = formData.get('options');

    if (!audioFile || !(audioFile instanceof File)) {
      throw new HTTPException(400, { message: 'Audio file is required' });
    }

    const audioData = await audioFile.arrayBuffer();
    const audioStream = new Readable();
    audioStream.push(Buffer.from(audioData));
    audioStream.push(null);

    let parsedOptions;
    try {
      parsedOptions = options ? JSON.parse(options as string) : {};
    } catch (error) {
      parsedOptions = {};
    }

    const transcription = await agent.voice.listen(audioStream, parsedOptions);
    return c.json({ text: transcription });
  } catch (error) {
    return handleError(error, 'Error transcribing speech');
  }
}

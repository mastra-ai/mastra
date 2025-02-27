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

    const audioStream = await agent.speak(input, options);

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

    const audioData = await c.req.arrayBuffer();
    const audioStream = new Readable();
    audioStream.push(Buffer.from(audioData));
    audioStream.push(null);

    const options = c.req.query();
    const transcription = await agent.listen(audioStream, options);
    return c.json({ text: transcription });
  } catch (error) {
    return handleError(error, 'Error transcribing speech');
  }
}

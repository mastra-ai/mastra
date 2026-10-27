import { createOpenAI as createOpenAIV4 } from '@ai-sdk/openai';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, it, expect } from 'vitest';
import type { LLMock } from '@copilotkit/aimock';
import { Agent } from '../../../../agent';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * An image given as a plain https string with a mimeType, sent with generate()
 * (moved from agent/__tests__/image-prompt.e2e, which replayed a hash-matched
 * recording and only checked the reply mentioned "google"; its durable leg
 * could not replay at all).
 *
 * The string must be recognised as a URL and passed to the model by reference
 * next to the text, and must survive durable serialization. The legacy v1
 * path (generateLegacy with an AI SDK v4 model) is covered separately. Uses the Chat
 * Completions provider because its request body journals image_url parts.
 */

const LOGO_URL = 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png';

function chatModel(llm: LLMock) {
  return () => createOpenAI({ apiKey: 'test-key', baseURL: `${llm.url}/v1` }).chat(SCENARIO_MODEL_ID);
}

describeForAllEngines('AIMock loop scenario: image URL string prompt', engine => {
  const getMock = useLoopScenarioAimock();

  it('generate() sends a string https image with mimeType to the model as an image_url', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat', userMessage: 'What is the photo?' }, { content: 'It is the Google logo.' });
    const { agent } = await createSharedAgent(llm, { engine, model: chatModel(llm), instructions: 'test agent' });

    const result: any = await agent.generate([
      {
        role: 'user',
        content: [
          { type: 'image', image: LOGO_URL, mimeType: 'image/png' },
          { type: 'text', text: 'What is the photo?' },
        ],
      },
    ]);

    expect(result.text).toBe('It is the Google logo.');
    const requests = llm.getRequests();
    expect(requests).toHaveLength(1);
    const userContent = (requests[0]!.body as any).messages
      .filter((m: any) => m.role === 'user')
      .map((m: any) => m.content);
    expect(userContent).toEqual([
      [
        { type: 'image_url', image_url: { url: LOGO_URL } },
        { type: 'text', text: 'What is the photo?' },
      ],
    ]);
  });
});

function userContent(llm: LLMock) {
  const requests = llm.getRequests();
  expect(requests).toHaveLength(1);
  return (requests[0]!.body as any).messages.filter((m: any) => m.role === 'user').map((m: any) => m.content);
}

describe('AIMock loop scenario: image URL string prompt (legacy v1)', () => {
  const getMock = useLoopScenarioAimock();

  it('generateLegacy() sends a string https image with mimeType to a v4 model as an image_url', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat', userMessage: 'What is the photo?' }, { content: 'It is the Google logo.' });
    const agent = new Agent({
      id: 'image-url-string-prompt-v1',
      name: 'Image URL string prompt (v1)',
      instructions: 'test agent',
      model: createOpenAIV4({ apiKey: 'test-key', baseURL: `${llm.url}/v1` }).chat(SCENARIO_MODEL_ID),
    });

    const result = await agent.generateLegacy([
      {
        role: 'user',
        content: [
          { type: 'image', image: LOGO_URL, mimeType: 'image/png' },
          { type: 'text', text: 'What is the photo?' },
        ],
      },
    ]);

    expect(result.text).toBe('It is the Google logo.');
    expect(userContent(llm)).toEqual([
      [
        { type: 'text', text: 'What is the photo?' },
        { type: 'image_url', image_url: { url: LOGO_URL } },
      ],
    ]);
  });
});

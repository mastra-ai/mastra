import { createOpenAI } from '@ai-sdk/openai-v5';
import { it, expect } from 'vitest';
import type { LLMock } from '@copilotkit/aimock';
import { MockMemory } from '../../../../memory/mock';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Image inputs across engines (moved from durable-agent-images, which only
 * asserted prepare() returned a runId, and base64-images-with-threads #10480).
 *
 * The scenario's default Responses provider journals user content as text
 * only, so these use the Chat Completions provider of the same OpenAI SDK:
 * its request body is journaled verbatim, image_url parts included. OpenAI
 * declares http(s) image URLs as supported, so they are passed by reference
 * (never fetched); base64 inputs become data URLs.
 */

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG_DATA_URL = `data:image/png;base64,${PNG_BASE64}`;
const JPEG_DATA_URL = `data:image/jpeg;base64,${PNG_BASE64}`;
const HTTPS_URL = 'https://example.com/path/to/image%20with%20spaces.png?query=value&other=123';

function chatModel(llm: LLMock) {
  return () => createOpenAI({ apiKey: 'test-key', baseURL: `${llm.url}/v1` }).chat(SCENARIO_MODEL_ID);
}

function userContent(request: { body: any }) {
  return request.body.messages.filter((m: any) => m.role === 'user').map((m: any) => m.content);
}

const image = (url: string) => ({ type: 'image_url', image_url: { url } });

describeForAllEngines('AIMock loop scenario: image inputs', engine => {
  const getMock = useLoopScenarioAimock();

  async function send(messages: any[], memory: MockMemory, thread: string) {
    const llm = getMock();
    const { agent } = await createSharedAgent(llm, { engine, memory, model: chatModel(llm) });
    const result: any = await agent.stream(messages, { memory: { thread, resource: 'image-user' } });
    const output = isDurableEngineVariant(engine) ? result.output : result;
    const text = await output.text;
    result.cleanup?.();
    return text;
  }

  it('sends raw base64, data URL and https images to the model in order with the text', async () => {
    getMock().on({ endpoint: 'chat' }, { content: 'I see three images.' });

    const text = await send(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Compare these:' },
            { type: 'image', image: PNG_BASE64, mimeType: 'image/png' },
            { type: 'text', text: 'and' },
            { type: 'image', image: JPEG_DATA_URL },
            { type: 'image', image: new URL(HTTPS_URL) },
          ],
        },
      ],
      new MockMemory(),
      'mixed-images-thread',
    );

    expect(text).toBe('I see three images.');
    expect(userContent(getMock().getRequests()[0]!)).toEqual([
      [
        { type: 'text', text: 'Compare these:' },
        image(PNG_DATA_URL),
        { type: 'text', text: 'and' },
        image(JPEG_DATA_URL),
        image(HTTPS_URL),
      ],
    ]);
  });

  it('sends an image-only message', async () => {
    getMock().on({ endpoint: 'chat' }, { content: 'Just an image.' });

    const text = await send(
      [{ role: 'user', content: [{ type: 'image', image: PNG_BASE64, mimeType: 'image/png' }] }],
      new MockMemory(),
      'image-only-thread',
    );

    expect(text).toBe('Just an image.');
    expect(userContent(getMock().getRequests()[0]!)).toEqual([[image(PNG_DATA_URL)]]);
  });

  // #10480: raw base64 with a memory thread used to throw "Invalid URL" in the
  // memory step. The image must also come back from memory on the next turn.
  it('stores a raw base64 image in the thread and replays it on the next turn', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat', userMessage: 'What is this?' }, { content: 'A pixel.' });
    llm.on({ endpoint: 'chat', userMessage: 'What colour?' }, { content: 'Grey.' });
    const memory = new MockMemory();

    const first = await send(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image', image: PNG_BASE64, mimeType: 'image/png' },
          ],
        },
      ],
      memory,
      'image-memory-thread',
    );
    const second = await send([{ role: 'user', content: 'What colour?' }], memory, 'image-memory-thread');

    expect([first, second]).toEqual(['A pixel.', 'Grey.']);
    const requests = llm.getRequests();
    expect(userContent(requests[1]!)).toEqual([
      [{ type: 'text', text: 'What is this?' }, image(PNG_DATA_URL)],
      'What colour?',
    ]);
  });

  // experimental_attachments is an AI SDK v4 UIMessage field, so the message needs `parts` to be
  // detected as one; on a bare core-message shape the field is silently ignored.
  it('sends experimental_attachments (raw base64 and https) as images', async () => {
    getMock().on({ endpoint: 'chat' }, { content: 'Two attachments.' });

    const text = await send(
      [
        {
          id: 'attachments-message',
          role: 'user',
          content: 'Describe the attachments',
          parts: [{ type: 'text', text: 'Describe the attachments' }],
          experimental_attachments: [
            { url: PNG_BASE64, contentType: 'image/png', name: 'raw.png' },
            { url: HTTPS_URL, contentType: 'image/png', name: 'product.png' },
          ],
        },
      ],
      new MockMemory(),
      'attachments-thread',
    );

    expect(text).toBe('Two attachments.');
    expect(userContent(getMock().getRequests()[0]!)).toEqual([
      // AIV5Adapter emits experimental_attachments file parts ahead of content parts.
      [image(PNG_DATA_URL), image(HTTPS_URL), { type: 'text', text: 'Describe the attachments' }],
    ]);
  });
});

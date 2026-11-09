/**
 * Observer request rejected because of an attachment
 *
 * The Observer forwards images from the thread (pasted images, browser screenshots,
 * read_file media) as they are. Providers reject some of them, e.g. Anthropic
 * refuses any image over 8000px per side, which a full-page screenshot easily
 * exceeds. The Observer downscales oversized images before sending them. When a
 * provider still rejects an attachment (e.g. a format the downscaler can't decode),
 * observation must not stop for the rest of the session: the Observer retries once
 * with attachments replaced by their text placeholders.
 *
 * Runs a real Agent + Memory turn with a real OpenAI provider pointed at AIMock
 * for both the actor and the Observer. The actor takes a screenshot, and the
 * Observer endpoint rejects images over 8000px (or every image, to force the fallback).
 */

import { deflateSync } from 'node:zlib';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';
import { RETRY_CONFIG } from '../retry';

const ACTOR = 'actor-model';
const OBSERVER = 'observer-model';
const THREAD = 'attachment-rejection-thread';
const RESOURCE = 'attachment-rejection-resource';
const USER_REQUEST = `USER_REQUEST_MARKER: take a full-page screenshot of the pricing page. ${'Check the layout. '.repeat(10)}`;
const ACTOR_REPLY = 'The pricing page layout looks correct.';
const REQUEST_OBSERVATION = '* 🔴 User asked to check the pricing page layout';
const SCREENSHOT_OBSERVATION = '* 🟡 Agent captured a full-page screenshot of the pricing page';
const IMAGE_TOO_LARGE = 'At least one of the image dimensions exceed max allowed size: 8000 pixels';

function crc32(bytes: Buffer): number {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Grayscale full-page-screenshot stand-in: tall enough to exceed the 8000px limit. */
function tallPng(width: number, height: number): string {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  const raw = Buffer.alloc((width + 1) * height, 0x80);
  for (let y = 0; y < height; y++) raw[y * (width + 1)] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64');
}

const SCREENSHOT_BASE64 = tallPng(40, 9000);

function imageSizes(req: ChatCompletionRequest): Array<{ width: number; height: number }> {
  const urls = JSON.stringify(req.messages).match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g) ?? [];
  return urls.map(url => {
    const png = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  });
}
const hasOversizedImage = (req: ChatCompletionRequest) =>
  imageSizes(req).some(({ width, height }) => Math.max(width, height) > 8000);

const observerReply = (scope: 'thread' | 'resource', observation: string) =>
  scope === 'thread'
    ? `<observations>\n${observation}\n</observations>`
    : `<observations>\n<thread id="${THREAD}">\n${observation}\n</thread>\n</observations>`;

const hasImage = (req: ChatCompletionRequest) => JSON.stringify(req.messages).includes('image_url');
const includesScreenshot = (req: ChatCompletionRequest) =>
  JSON.stringify(req.messages).includes('Tool Result browser_screenshot');
const hasToolResult = (req: ChatCompletionRequest) => req.messages.some(message => message.role === 'tool');

let mock: LLMock;
const originalRetryConfig = { ...RETRY_CONFIG };

beforeAll(async () => {
  RETRY_CONFIG.initialDelayMs = 1;
  RETRY_CONFIG.maxDelayMs = 4;
  RETRY_CONFIG.jitter = 0;
  mock = new LLMock({ port: 0 });
  await mock.start();
});

afterEach(() => {
  mock.clearFixtures();
  mock.clearRequests();
  mock.resetMatchCounts();
});

afterAll(async () => {
  Object.assign(RETRY_CONFIG, originalRetryConfig);
  await mock.stop();
});

type Rejects = 'oversized-images' | 'any-image' | 'every-request';

async function runTurn({ scope, rejects }: { scope: 'thread' | 'resource'; rejects: Rejects }) {
  const rejection = { error: { message: IMAGE_TOO_LARGE, type: 'invalid_request_error' }, status: 400 };
  mock.on(
    {
      endpoint: 'chat',
      model: OBSERVER,
      predicate: req =>
        rejects === 'every-request' || (rejects === 'any-image' && hasImage(req)) || hasOversizedImage(req),
    },
    rejection,
  );
  mock.on(
    { endpoint: 'chat', model: OBSERVER, predicate: includesScreenshot },
    { content: observerReply(scope, SCREENSHOT_OBSERVATION) },
  );
  mock.on({ endpoint: 'chat', model: OBSERVER }, { content: observerReply(scope, REQUEST_OBSERVATION) });
  mock.on({ endpoint: 'chat', model: ACTOR, predicate: hasToolResult }, { content: ACTOR_REPLY });
  mock.on(
    { endpoint: 'chat', model: ACTOR },
    { toolCalls: [{ name: 'browser_screenshot', arguments: '{"fullPage":true}' }] },
  );

  const openai = createOpenAI({ apiKey: 'test-key', baseURL: `${mock.url}/v1` });
  const store = new InMemoryStore();
  const agent = new Agent({
    id: 'attachment-rejection-agent',
    name: 'Attachment Rejection Agent',
    instructions: 'You are a helpful assistant.',
    model: openai.chat(ACTOR),
    tools: {
      browser_screenshot: createTool({
        id: 'browser_screenshot',
        description: 'Take a screenshot of the current page',
        inputSchema: z.object({ fullPage: z.boolean().optional() }),
        execute: async () => ({ base64: SCREENSHOT_BASE64 }),
        toModelOutput: (output: { base64: string }) => ({
          type: 'content',
          value: [{ type: 'media', mediaType: 'image/png', data: output.base64 }],
        }),
      }),
    },
    memory: new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          scope,
          observation: {
            model: openai.chat(OBSERVER),
            messageTokens: 20,
            bufferTokens: false,
            maxRetries: 0,
            failurePolicy: 'continue',
          },
          reflection: { model: openai.chat(OBSERVER), observationTokens: 100_000 },
        },
      },
    }),
  });

  const result = await agent.generate(USER_REQUEST, { memory: { thread: THREAD, resource: RESOURCE } });

  const memoryStore = (await store.getStore('memory'))!;
  const record = await memoryStore.getObservationalMemory(scope === 'resource' ? null : THREAD, RESOURCE);
  // The first observation runs before the screenshot is taken; only calls that include it matter here.
  const observerCalls = mock
    .getRequests()
    .filter(request => request.body?.model === OBSERVER)
    .map(request => request.body as ChatCompletionRequest)
    .filter(includesScreenshot);
  return { result, record, observerCalls };
}

describe('Observer request rejected because of an attachment', { timeout: 30_000 }, () => {
  describe.each(['thread', 'resource'] as const)('%s scope', scope => {
    it('downscales an oversized screenshot so the Observer accepts it', async () => {
      const { result, record, observerCalls } = await runTurn({ scope, rejects: 'oversized-images' });

      expect(result.text).toBe(ACTOR_REPLY);
      expect(observerCalls).toHaveLength(1);
      const [size] = imageSizes(observerCalls[0]!);
      expect(size!.height).toBe(2000);
      expect(record?.activeObservations).toContain(SCREENSHOT_OBSERVATION.slice(2));
    });

    it('retries once without attachments when the provider still rejects an image', async () => {
      const { result, record, observerCalls } = await runTurn({ scope, rejects: 'any-image' });

      expect(result.tripwire).toBeUndefined();
      expect(result.text).toBe(ACTOR_REPLY);

      const [rejected, retried] = observerCalls;
      expect(observerCalls).toHaveLength(2);
      expect(hasImage(rejected!)).toBe(true);
      expect(hasImage(retried!)).toBe(false);
      // The model still learns an image was there.
      expect(JSON.stringify(retried!.messages)).toContain('[Image #1: image/png]');

      expect(record?.lastObservedAt).toBeInstanceOf(Date);
      expect(record?.activeObservations).toContain(SCREENSHOT_OBSERVATION.slice(2));
    });

    it('does not retry again when the request without attachments is rejected too', async () => {
      const { result, record, observerCalls } = await runTurn({ scope, rejects: 'every-request' });

      expect(observerCalls).toHaveLength(2);
      expect(hasImage(observerCalls[0]!)).toBe(true);
      expect(hasImage(observerCalls[1]!)).toBe(false);
      expect(result.text).toBe(ACTOR_REPLY);
      expect(record?.activeObservations ?? '').not.toContain(SCREENSHOT_OBSERVATION.slice(2));
    });
  });
});

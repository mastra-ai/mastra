/**
 * Observer request rejected because of an attachment
 *
 * The Observer forwards images from the thread (pasted images, browser screenshots,
 * read_file media) as they are. Providers reject some of them, e.g. Anthropic
 * refuses any image over 8000px per side, which a full-page screenshot easily
 * exceeds. A rejected attachment must not stop observation for the rest of the
 * session: the Observer retries once with attachments replaced by their text
 * placeholders.
 *
 * Runs a real Agent + Memory turn with a real OpenAI provider pointed at AIMock
 * for both the actor and the Observer. The actor takes a screenshot, and the
 * Observer endpoint rejects any request that contains an image.
 */

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
// A 1x1 PNG stands in for the oversized screenshot; the mock rejects any image.
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

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

async function runTurn({ scope, rejectEveryRequest }: { scope: 'thread' | 'resource'; rejectEveryRequest: boolean }) {
  const rejection = { error: { message: IMAGE_TOO_LARGE, type: 'invalid_request_error' }, status: 400 };
  mock.on({ endpoint: 'chat', model: OBSERVER, predicate: req => rejectEveryRequest || hasImage(req) }, rejection);
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
        execute: async () => ({ base64: PNG_BASE64 }),
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
    it('retries once without attachments and keeps observing', async () => {
      const { result, record, observerCalls } = await runTurn({ scope, rejectEveryRequest: false });

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
      const { result, record, observerCalls } = await runTurn({ scope, rejectEveryRequest: true });

      expect(observerCalls).toHaveLength(2);
      expect(hasImage(observerCalls[0]!)).toBe(true);
      expect(hasImage(observerCalls[1]!)).toBe(false);
      expect(result.text).toBe(ACTOR_REPLY);
      expect(record?.activeObservations ?? '').not.toContain(SCREENSHOT_OBSERVATION.slice(2));
    });
  });
});

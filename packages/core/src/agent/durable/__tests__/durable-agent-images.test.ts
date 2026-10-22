/**
 * DurableAgent cloud-storage image references.
 *
 * Other image inputs (base64, data URL, https, image-only, memory replay) are
 * covered across engines by loop/test-utils/aimock/scenarios/images-input.scenario.test.ts.
 * This stays a MockLanguageModel test: it needs a model that declares gs:// in
 * supportedUrls, which the OpenAI provider used by aimock scenarios does not.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

describe('DurableAgent image handling', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('cloud-storage URL references (gs://, s3://)', () => {
    // Regression: durable execution must forward the model's `supportedUrls` so a
    // natively-supported scheme (e.g. `gs://`) passes through instead of being
    // downloaded or base64-wrapped.
    const GS_URI = 'gs://devtest-petcircle-assets/add-pet-details/dog.png';

    function createCapturingModel(prompts: unknown[], supportedUrls?: Record<string, RegExp[]>) {
      return new MockLanguageModelV2({
        supportedUrls,
        doStream: async (options: any) => {
          prompts.push(options.prompt);
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'I can see the image.' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
      });
    }

    function findFilePart(prompt: any) {
      const userMessage = (prompt as any[]).find(m => m.role === 'user');
      return userMessage?.content?.find((part: any) => part.type === 'file' || part.type === 'image');
    }

    it('passes a gs:// reference through to the model when it declares support', async () => {
      const prompts: unknown[] = [];
      const mockModel = createCapturingModel(prompts, { '*': [/^https?:\/\/.*$/, /^gs:\/\/.*$/] });

      const baseAgent = new Agent({
        id: 'gs-image-agent',
        name: 'GS Image Agent',
        instructions: 'Describe images.',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const { output, cleanup } = await durableAgent.stream([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Which breed is this dog?' },
            { type: 'image', image: GS_URI, mimeType: 'image/png' },
          ],
        },
      ]);
      await output.consumeStream();

      // The model was actually invoked (prompt building did not throw on gs://).
      expect(prompts.length).toBeGreaterThan(0);

      const filePart = findFilePart(prompts[0]);
      expect(filePart).toBeDefined();

      // The gs:// reference is preserved verbatim and NOT base64-wrapped.
      // `findFilePart` may return a file part (`.data`) or an image part (`.image`).
      const rawValue = filePart.type === 'image' ? filePart.image : filePart.data;
      const dataValue = rawValue instanceof URL ? rawValue.toString() : String(rawValue);
      expect(dataValue).toBe(GS_URI);
      expect(dataValue.startsWith('data:')).toBe(false);

      cleanup();
    });
  });
});

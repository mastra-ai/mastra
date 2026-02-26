/**
 * DurableAgent Image Handling Tests
 *
 * Tests for image handling in messages including base64, data URIs,
 * HTTP URLs, and attachments in durable execution.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a simple text model
 */
function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

// Sample base64 image data (tiny 1x1 red PNG)
const SAMPLE_BASE64_IMAGE =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const SAMPLE_DATA_URI = `data:image/png;base64,${SAMPLE_BASE64_IMAGE}`;

// ============================================================================
// DurableAgent Image Handling Tests
// ============================================================================

describe('DurableAgent image handling', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('base64 image handling', () => {
    it('should accept raw base64 image in message content', async () => {
      const mockModel = createTextModel('I see a red pixel.');

      const baseAgent = new Agent({
        id: 'base64-image-agent',
        name: 'Base64 Image Agent',
        instructions: 'Describe images.',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What do you see in this image?' },
            { type: 'image', image: SAMPLE_BASE64_IMAGE },
          ],
        },
      ]);

      expect(result.runId).toBeDefined();
      expect(result.workflowInput.messageListState).toBeDefined();
    });

    it('should handle data URI format images', async () => {
      const mockModel = createTextModel('I see a red pixel.');

      const baseAgent = new Agent({
        id: 'data-uri-image-agent',
        name: 'Data URI Image Agent',
        instructions: 'Describe images.',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image:' },
            { type: 'image', image: SAMPLE_DATA_URI },
          ],
        },
      ]);

      expect(result.runId).toBeDefined();
    });
  });

  describe('HTTP URL images', () => {
    it('should accept HTTP URL images in message content', async () => {
      const mockModel = createTextModel('I see an image from the URL.');

      const baseAgent = new Agent({
        id: 'url-image-agent',
        name: 'URL Image Agent',
        instructions: 'Describe images.',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            { type: 'image', image: new URL('https://example.com/image.png') },
          ],
        },
      ]);

      expect(result.runId).toBeDefined();
    });

    it('should handle HTTPS URL images', async () => {
      const mockModel = createTextModel('I see an image.');

      const baseAgent = new Agent({
        id: 'https-image-agent',
        name: 'HTTPS Image Agent',
        instructions: 'Describe images.',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe:' },
            { type: 'image', image: new URL('https://secure.example.com/photo.jpg') },
          ],
        },
      ]);

      expect(result.runId).toBeDefined();
    });
  });

  describe('mixed image formats', () => {
    it('should handle multiple images in different formats', async () => {
      const mockModel = createTextModel('I see multiple images.');

      const baseAgent = new Agent({
        id: 'mixed-images-agent',
        name: 'Mixed Images Agent',
        instructions: 'Describe images.',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Compare these images:' },
            { type: 'image', image: SAMPLE_BASE64_IMAGE },
            { type: 'image', image: SAMPLE_DATA_URI },
            { type: 'image', image: new URL('https://example.com/image.png') },
          ],
        },
      ]);

      expect(result.runId).toBeDefined();
    });

    it('should handle text and image interleaved', async () => {
      const mockModel = createTextModel('Comparing the images...');

      const baseAgent = new Agent({
        id: 'interleaved-images-agent',
        name: 'Interleaved Images Agent',
        instructions: 'Describe images.',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'First image:' },
            { type: 'image', image: SAMPLE_BASE64_IMAGE },
            { type: 'text', text: 'Second image:' },
            { type: 'image', image: SAMPLE_DATA_URI },
            { type: 'text', text: 'What are the differences?' },
          ],
        },
      ]);

      expect(result.runId).toBeDefined();
    });
  });

  describe('image serialization in workflow', () => {
    it('should serialize image content in workflow input', async () => {
      const mockModel = createTextModel('Image processed.');

      const baseAgent = new Agent({
        id: 'serialize-image-agent',
        name: 'Serialize Image Agent',
        instructions: 'Process images.',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Process this:' },
            { type: 'image', image: SAMPLE_BASE64_IMAGE },
          ],
        },
      ]);

      // Verify workflow input is JSON-serializable
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();

      const parsed = JSON.parse(serialized);
      expect(parsed.messageListState).toBeDefined();
    });

    it('should handle large base64 images', async () => {
      const mockModel = createTextModel('Large image received.');
      // Create a large payload (repeated base64 is not a valid image — tests serialization of large payloads)
      const largeBase64 = SAMPLE_BASE64_IMAGE.repeat(100);

      const baseAgent = new Agent({
        id: 'large-image-agent',
        name: 'Large Image Agent',
        instructions: 'Process images.',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Process this large image:' },
            { type: 'image', image: largeBase64 },
          ],
        },
      ]);

      expect(result.runId).toBeDefined();

      // Should still serialize
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();
    });
  });

  describe('image with memory', () => {
    it('should handle images with memory configuration', async () => {
      const mockModel = createTextModel('I remember this image.');

      const baseAgent = new Agent({
        id: 'image-memory-agent',
        name: 'Image Memory Agent',
        instructions: 'Remember and describe images.',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare(
        [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Remember this image:' },
              { type: 'image', image: SAMPLE_BASE64_IMAGE },
            ],
          },
        ],
        {
          memory: {
            thread: 'image-thread',
            resource: 'image-user',
          },
        },
      );

      expect(result.runId).toBeDefined();
      expect(result.threadId).toBe('image-thread');
    });
  });
});

describe('DurableAgent image edge cases', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should handle empty image content gracefully', async () => {
    const mockModel = createTextModel('No image data.');

    const baseAgent = new Agent({
      id: 'empty-image-agent',
      name: 'Empty Image Agent',
      instructions: 'Process images.',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Here is an empty image:' },
          { type: 'image', image: '' },
        ],
      },
    ]);

    expect(result.runId).toBeDefined();
  });

  it('should handle message with only image (no text)', async () => {
    const mockModel = createTextModel('I see an image.');

    const baseAgent = new Agent({
      id: 'only-image-agent',
      name: 'Only Image Agent',
      instructions: 'Describe images.',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare([
      {
        role: 'user',
        content: [{ type: 'image', image: SAMPLE_BASE64_IMAGE }],
      },
    ]);

    expect(result.runId).toBeDefined();
  });

  it('should handle special characters in image URLs', async () => {
    const mockModel = createTextModel('Processing URL image.');

    const baseAgent = new Agent({
      id: 'special-url-agent',
      name: 'Special URL Agent',
      instructions: 'Process images.',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Image from special URL:' },
          {
            type: 'image',
            image: new URL('https://example.com/path/to/image%20with%20spaces.png?query=value&other=123'),
          },
        ],
      },
    ]);

    expect(result.runId).toBeDefined();
  });
});

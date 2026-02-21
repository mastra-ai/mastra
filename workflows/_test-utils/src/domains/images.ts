/**
 * Image handling tests for DurableAgent
 *
 * Tests for image handling in messages including base64, data URIs,
 * HTTP URLs, and attachments in durable execution.
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

// Sample base64 image data (tiny 1x1 red PNG)
const SAMPLE_BASE64_IMAGE =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const SAMPLE_DATA_URI = `data:image/png;base64,${SAMPLE_BASE64_IMAGE}`;

export function createImagesTests({ createAgent }: DurableAgentTestContext) {
  describe('image handling', () => {
    describe('base64 image handling', () => {
      it('should accept raw base64 image in message content', async () => {
        const mockModel = createTextStreamModel('I see a red pixel.');

        const agent = await createAgent({
          id: 'base64-image-agent',
          name: 'Base64 Image Agent',
          instructions: 'Describe images.',
          model: mockModel,
        });

        const result = await agent.prepare([
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
        const mockModel = createTextStreamModel('I see a red pixel.');

        const agent = await createAgent({
          id: 'data-uri-image-agent',
          name: 'Data URI Image Agent',
          instructions: 'Describe images.',
          model: mockModel,
        });

        const result = await agent.prepare([
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
        const mockModel = createTextStreamModel('I see an image from the URL.');

        const agent = await createAgent({
          id: 'url-image-agent',
          name: 'URL Image Agent',
          instructions: 'Describe images.',
          model: mockModel,
        });

        const result = await agent.prepare([
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
        const mockModel = createTextStreamModel('I see an image.');

        const agent = await createAgent({
          id: 'https-image-agent',
          name: 'HTTPS Image Agent',
          instructions: 'Describe images.',
          model: mockModel,
        });

        const result = await agent.prepare([
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
        const mockModel = createTextStreamModel('I see multiple images.');

        const agent = await createAgent({
          id: 'mixed-images-agent',
          name: 'Mixed Images Agent',
          instructions: 'Describe images.',
          model: mockModel,
        });

        const result = await agent.prepare([
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
        const mockModel = createTextStreamModel('Comparing the images...');

        const agent = await createAgent({
          id: 'interleaved-images-agent',
          name: 'Interleaved Images Agent',
          instructions: 'Describe images.',
          model: mockModel,
        });

        const result = await agent.prepare([
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
        const mockModel = createTextStreamModel('Image processed.');

        const agent = await createAgent({
          id: 'serialize-image-agent',
          name: 'Serialize Image Agent',
          instructions: 'Process images.',
          model: mockModel,
        });

        const result = await agent.prepare([
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Process this:' },
              { type: 'image', image: SAMPLE_BASE64_IMAGE },
            ],
          },
        ]);

        const serialized = JSON.stringify(result.workflowInput);
        expect(serialized).toBeDefined();

        const parsed = JSON.parse(serialized);
        expect(parsed.messageListState).toBeDefined();
      });

      it('should handle large base64 images', async () => {
        const mockModel = createTextStreamModel('Large image received.');
        const largeBase64 = SAMPLE_BASE64_IMAGE.repeat(100);

        const agent = await createAgent({
          id: 'large-image-agent',
          name: 'Large Image Agent',
          instructions: 'Process images.',
          model: mockModel,
        });

        const result = await agent.prepare([
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Process this large image:' },
              { type: 'image', image: largeBase64 },
            ],
          },
        ]);

        expect(result.runId).toBeDefined();

        const serialized = JSON.stringify(result.workflowInput);
        expect(serialized).toBeDefined();
      });
    });

    describe('image with memory', () => {
      it('should handle images with memory configuration', async () => {
        const mockModel = createTextStreamModel('I remember this image.');

        const agent = await createAgent({
          id: 'image-memory-agent',
          name: 'Image Memory Agent',
          instructions: 'Remember and describe images.',
          model: mockModel,
        });

        const result = await agent.prepare(
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

  describe('image edge cases', () => {
    it('should handle empty image content gracefully', async () => {
      const mockModel = createTextStreamModel('No image data.');

      const agent = await createAgent({
        id: 'empty-image-agent',
        name: 'Empty Image Agent',
        instructions: 'Process images.',
        model: mockModel,
      });

      const result = await agent.prepare([
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
      const mockModel = createTextStreamModel('I see an image.');

      const agent = await createAgent({
        id: 'only-image-agent',
        name: 'Only Image Agent',
        instructions: 'Describe images.',
        model: mockModel,
      });

      const result = await agent.prepare([
        {
          role: 'user',
          content: [{ type: 'image', image: SAMPLE_BASE64_IMAGE }],
        },
      ]);

      expect(result.runId).toBeDefined();
    });

    it('should handle special characters in image URLs', async () => {
      const mockModel = createTextStreamModel('Processing URL image.');

      const agent = await createAgent({
        id: 'special-url-agent',
        name: 'Special URL Agent',
        instructions: 'Process images.',
        model: mockModel,
      });

      const result = await agent.prepare([
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
}

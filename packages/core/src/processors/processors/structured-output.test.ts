import { MockLanguageModelV1 } from 'ai/test';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import z from 'zod';
import type { MastraMessageV2 } from '../../agent/message-list';
import { StructuredOutputProcessor } from './structured-output';

describe('StructuredOutputProcessor', () => {
  const testSchema = z.object({
    color: z.string(),
    intensity: z.string(),
    count: z.number().optional(),
  });

  let processor: StructuredOutputProcessor<typeof testSchema>;
  let mockAbort: ReturnType<typeof vi.fn>;
  let mockModel: MockLanguageModelV1;

  beforeEach(() => {
    mockModel = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        text: '{"color": "blue", "intensity": "bright"}',
        finishReason: 'stop',
        usage: { completionTokens: 10, promptTokens: 5 },
      }),
      defaultObjectGenerationMode: 'json',
    });

    processor = new StructuredOutputProcessor({
      schema: testSchema,
      model: mockModel,
      errorStrategy: 'strict',
    });
    mockAbort = vi.fn();
  });

  describe('processOutputResult', () => {
    const createMessage = (text: string): MastraMessageV2 => ({
      id: 'test-id',
      role: 'assistant',
      content: {
        format: 2,
        parts: [{ type: 'text', text }],
      },
      createdAt: new Date(),
    });

    it('should process unstructured text and return formatted JSON', async () => {
      const message = createMessage('The color is blue and it has bright intensity');

      // Mock the structuring agent's generate method
      vi.spyOn(processor['structuringAgent'], 'generate').mockResolvedValueOnce({
        text: JSON.stringify({ color: 'blue', intensity: 'bright' }),
        object: { color: 'blue', intensity: 'bright' },
        finishReason: 'stop',
        usage: { completionTokens: 10, promptTokens: 5 },
      } as any);

      const result = await processor.processOutputResult({
        messages: [message],
        abort: mockAbort as any,
      });

      expect(result).toHaveLength(1);
      // Should preserve original text
      expect(result[0].content.parts[0]).toEqual({
        type: 'text',
        text: 'The color is blue and it has bright intensity',
      });
      // Should add structured data to content.metadata
      expect(result[0].content.metadata).toEqual({
        structuredOutput: { color: 'blue', intensity: 'bright' },
      });
      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should abort when structuring agent fails with strict strategy', async () => {
      const message = createMessage('some text that cannot be structured');

      // Mock the structuring agent to fail
      vi.spyOn(mockModel, 'doGenerate').mockRejectedValueOnce(new Error('Structuring failed'));

      await processor.processOutputResult({
        messages: [message],
        abort: mockAbort as any,
      });

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('[StructuredOutputProcessor] Processing failed'));
    });

    it('should use fallback value with fallback strategy', async () => {
      const fallbackProcessor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'fallback',
        fallbackValue: { color: 'default', intensity: 'medium' },
      });

      const message = createMessage('some text');

      // Mock the structuring agent to fail
      vi.spyOn(mockModel, 'doGenerate').mockRejectedValueOnce(new Error('Structuring failed'));

      const result = await fallbackProcessor.processOutputResult({
        messages: [message],
        abort: mockAbort as any,
      });

      expect(result[0].content.metadata).toEqual({
        structuredOutput: { color: 'default', intensity: 'medium' },
      });
      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should warn and continue with warn strategy', async () => {
      const warnProcessor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'warn',
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const message = createMessage('some text');

      // Mock the structuring agent to fail
      vi.spyOn(mockModel, 'doGenerate').mockRejectedValueOnce(new Error('Structuring failed'));

      const result = await warnProcessor.processOutputResult({
        messages: [message],
        abort: mockAbort as any,
      });

      expect(result[0]).toEqual(message); // unchanged
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[StructuredOutputProcessor] Processing failed'));
      expect(mockAbort).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should skip non-assistant messages', async () => {
      const userMessage: MastraMessageV2 = {
        id: 'user-id',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date(),
      };

      const result = await processor.processOutputResult({
        messages: [userMessage],
        abort: mockAbort as any,
      });

      expect(result[0]).toEqual(userMessage); // unchanged
    });

    it('should handle messages with empty content', async () => {
      const message = createMessage('   '); // just whitespace
      const result = await processor.processOutputResult({
        messages: [message],
        abort: mockAbort as any,
      });

      expect(result[0]).toEqual(message); // unchanged
    });
  });

  describe('instruction generation', () => {
    it('should generate instructions based on schema', () => {
      const instructions = (processor as any).generateInstructions();

      expect(instructions).toContain('data structuring specialist');
      expect(instructions).toContain('JSON format');
      expect(typeof instructions).toBe('string');
      expect(instructions.length).toBeGreaterThan(0);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex nested schema', async () => {
      const complexSchema = z.object({
        user: z.object({
          name: z.string(),
          preferences: z.object({
            theme: z.enum(['light', 'dark']),
            notifications: z.boolean(),
          }),
        }),
        metadata: z.record(z.string()),
      });

      const complexProcessor = new StructuredOutputProcessor({
        schema: complexSchema,
        model: mockModel,
      });

      const expectedObject = {
        user: {
          name: 'John',
          preferences: {
            theme: 'dark' as const,
            notifications: true,
          },
        },
        metadata: { source: 'test' },
      };

      const message: MastraMessageV2 = {
        id: 'test-id',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Some unstructured text about John who prefers dark theme and wants notifications' },
          ],
        },
        createdAt: new Date(),
      };

      // Mock the structuring agent's generate method to return the expected structured data
      vi.spyOn(complexProcessor['structuringAgent'], 'generate').mockResolvedValueOnce({
        text: JSON.stringify(expectedObject),
        object: expectedObject,
        finishReason: 'stop',
        usage: { completionTokens: 10, promptTokens: 5 },
      } as any);

      const result = await complexProcessor.processOutputResult({
        messages: [message],
        abort: mockAbort as any,
      });

      expect(result[0].content.metadata).toEqual({
        structuredOutput: expectedObject,
      });
      expect(mockAbort).not.toHaveBeenCalled();
    });
  });
});

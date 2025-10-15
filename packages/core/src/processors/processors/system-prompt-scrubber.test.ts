import type { TextPart } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraMessageV2 } from '../../agent/message-list';
import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream/types';
import { SystemPromptScrubber } from './system-prompt-scrubber';

// Helper function to create test messages
function createTestMessage(text: string, role: 'user' | 'assistant' = 'assistant'): MastraMessageV2 {
  return {
    id: 'test-id',
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
    createdAt: new Date(),
  };
}

describe('SystemPromptScrubber', () => {
  let mockModel: MockLanguageModelV1;
  let processor: SystemPromptScrubber;

  beforeEach(() => {
    mockModel = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        text: '{"detections": [], "redacted_content": ""}',
        finishReason: 'stop',
        usage: { completionTokens: 10, promptTokens: 5 },
      }),
      defaultObjectGenerationMode: 'json',
    });
  });

  describe('basic functionality', () => {
    it('should not modify messages without system prompts', async () => {
      processor = new SystemPromptScrubber({ model: mockModel });

      const messages = [createTestMessage('Hello, how are you?'), createTestMessage('I am doing well, thank you.')];

      const result = await processor.processOutputResult({ messages, abort: vi.fn() as any });
      expect(result).toEqual(messages);
    });

    it('should return empty array when no messages provided', async () => {
      processor = new SystemPromptScrubber({ model: mockModel });
      const result = await processor.processOutputResult({ messages: [], abort: vi.fn() as any });
      expect(result).toEqual([]);
    });

    it('should not process messages without text content', async () => {
      processor = new SystemPromptScrubber({ model: mockModel });
      const message: MastraMessageV2 = {
        id: 'test-id',
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: '' }],
        },
        createdAt: new Date(),
      };

      const result = await processor.processOutputResult({ messages: [message], abort: vi.fn() as any });
      expect(result).toEqual([message]);
    });
  });

  describe('system prompt detection with default strategy (redact)', () => {
    it('should redact system prompts from messages', async () => {
      processor = new SystemPromptScrubber({ model: mockModel });

      // Mock the model to return detection results
      vi.spyOn(mockModel, 'doGenerate').mockResolvedValueOnce({
        rawCall: { rawPrompt: null, rawSettings: {} },
        text: JSON.stringify({
          detections: [
            {
              type: 'system_prompt',
              value: 'You are a helpful assistant',
              confidence: 0.9,
              start: 0,
              end: 25,
            },
          ],
          redacted_content: '*** [SYSTEM_PROMPT] ***. Hello there!',
        }),
        finishReason: 'stop',
        usage: { completionTokens: 10, promptTokens: 5 },
      });

      const messages = [createTestMessage('You are a helpful assistant. Hello there!')];

      const result = await processor.processOutputResult({ messages, abort: vi.fn() as any });
      expect(result[0].content.parts[0]).toEqual({
        type: 'text',
        text: '*** [SYSTEM_PROMPT] ***. Hello there!',
      });
    });
  });

  describe('strategy: block', () => {
    it('should abort when system prompts are detected', async () => {
      processor = new SystemPromptScrubber({
        model: mockModel,
        strategy: 'block',
      });

      // Mock the model to return detection results
      vi.spyOn(mockModel, 'doGenerate').mockResolvedValueOnce({
        rawCall: { rawPrompt: null, rawSettings: {} },
        text: JSON.stringify({
          detections: [
            {
              type: 'system_prompt',
              value: 'You are a helpful assistant',
              confidence: 0.9,
              start: 0,
              end: 25,
            },
          ],
        }),
        finishReason: 'stop',
        usage: { completionTokens: 10, promptTokens: 5 },
      });

      const mockAbort = vi.fn().mockImplementation((reason: string) => {
        throw new Error(reason);
      });
      const messages = [createTestMessage('You are a helpful assistant. Hello there!')];

      await expect(processor.processOutputResult({ messages, abort: mockAbort as any })).rejects.toThrow(
        'System prompt detected: system_prompt',
      );

      expect(mockAbort).toHaveBeenCalledWith('System prompt detected: system_prompt');
    });

    it('should not abort when no system prompts detected', async () => {
      processor = new SystemPromptScrubber({
        model: mockModel,
        strategy: 'block',
      });

      const mockAbort = vi.fn() as any;
      const messages = [createTestMessage('Hello, how are you?')];

      const result = await processor.processOutputResult({ messages, abort: mockAbort });
      expect(result).toEqual(messages);
      expect(mockAbort).not.toHaveBeenCalled();
    });
  });

  describe('strategy: filter', () => {
    it('should remove messages with system prompts', async () => {
      processor = new SystemPromptScrubber({
        model: mockModel,
        strategy: 'filter',
      });

      // Mock the model to return detection results
      vi.spyOn(mockModel, 'doGenerate').mockResolvedValueOnce({
        rawCall: { rawPrompt: null, rawSettings: {} },
        text: JSON.stringify({
          detections: [
            {
              type: 'system_prompt',
              value: 'You are a helpful assistant',
              confidence: 0.9,
              start: 0,
              end: 25,
            },
          ],
        }),
        finishReason: 'stop',
        usage: { completionTokens: 10, promptTokens: 5 },
      });

      const messages = [
        createTestMessage('You are a helpful assistant. Hello there!'),
        createTestMessage('This message should remain.'),
      ];

      const result = await processor.processOutputResult({ messages, abort: vi.fn() as any });
      expect(result).toHaveLength(1);
      expect((result[0].content.parts[0] as TextPart).text).toBe('This message should remain.');
    });
  });

  describe('strategy: warn', () => {
    it('should log warning but allow content through', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      processor = new SystemPromptScrubber({
        model: mockModel,
        strategy: 'warn',
      });

      // Mock the model to return detection results
      vi.spyOn(mockModel, 'doGenerate').mockResolvedValueOnce({
        rawCall: { rawPrompt: null, rawSettings: {} },
        text: JSON.stringify({
          detections: [
            {
              type: 'system_prompt',
              value: 'You are a helpful assistant',
              confidence: 0.9,
              start: 0,
              end: 25,
            },
          ],
        }),
        finishReason: 'stop',
        usage: { completionTokens: 10, promptTokens: 5 },
      });

      const messages = [createTestMessage('You are a helpful assistant. Hello there!')];

      const result = await processor.processOutputResult({ messages, abort: vi.fn() as any });
      expect(result).toEqual(messages);
      expect(consoleSpy).toHaveBeenCalledWith('[SystemPromptScrubber] System prompt detected: system_prompt');

      consoleSpy.mockRestore();
    });
  });

  describe('processOutputStream', () => {
    it('should return non-text chunks unchanged', async () => {
      processor = new SystemPromptScrubber({ model: mockModel });

      const part: ChunkType = {
        type: 'object',
        object: { key: 'value' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      const result = await processor.processOutputStream({
        part,
        streamParts: [part],
        state: {},
        abort: vi.fn() as any,
      });

      expect(result).toEqual(part);
    });

    it('should return empty text chunks unchanged', async () => {
      processor = new SystemPromptScrubber({ model: mockModel });

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: '', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      const result = await processor.processOutputStream({
        part,
        streamParts: [part],
        state: {},
        abort: vi.fn() as any,
      });

      expect(result).toEqual(part);
    });

    it('should redact system prompts in streaming chunks', async () => {
      processor = new SystemPromptScrubber({ model: mockModel });

      // Mock the model to return detection results
      vi.spyOn(mockModel, 'doGenerate').mockResolvedValueOnce({
        rawCall: { rawPrompt: null, rawSettings: {} },
        text: JSON.stringify({
          detections: [
            {
              type: 'system_prompt',
              value: 'You are an AI',
              confidence: 0.9,
              start: 0,
              end: 12,
            },
          ],
          redacted_content: '*** [SYSTEM] ***. Hello there!',
        }),
        finishReason: 'stop',
        usage: { completionTokens: 10, promptTokens: 5 },
      });

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'You are an AI. Hello there!', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      const result = await processor.processOutputStream({
        part,
        streamParts: [part],
        state: {},
        abort: vi.fn() as any,
      });

      expect(result).toEqual({
        type: 'text-delta',
        payload: { text: '*** [SYSTEM] ***. Hello there!', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      });
    });
  });

  describe('error handling', () => {
    it('should fail open when detection agent fails', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      processor = new SystemPromptScrubber({ model: mockModel });
      vi.spyOn(mockModel, 'doGenerate').mockRejectedValueOnce(new Error('Detection failed'));

      const messages = [createTestMessage('You are an AI. Hello there!')];

      const result = await processor.processOutputResult({ messages, abort: vi.fn() as any });
      expect(result).toEqual(messages);
      expect(consoleSpy).toHaveBeenCalledWith('[SystemPromptScrubber] Detection agent failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('configuration options', () => {
    it('should use custom placeholder text', async () => {
      processor = new SystemPromptScrubber({
        model: mockModel,
        placeholderText: '[CUSTOM_PLACEHOLDER]',
      });

      expect(processor['placeholderText']).toBe('[CUSTOM_PLACEHOLDER]');
    });

    it('should use custom instructions', async () => {
      const customInstructions = 'Custom detection instructions';
      processor = new SystemPromptScrubber({
        model: mockModel,
        instructions: customInstructions,
      });

      expect(processor['instructions']).toBe(customInstructions);
    });

    it('should require model in constructor', () => {
      expect(() => {
        new SystemPromptScrubber({} as any);
      }).toThrow('SystemPromptScrubber requires a model for detection');
    });
  });
});

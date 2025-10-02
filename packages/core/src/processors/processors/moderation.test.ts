import { MockLanguageModelV1 } from 'ai/test';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraMessageV2 } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream/types';
import type { ModerationResult } from './moderation';
import { ModerationProcessor } from './moderation';

function createTestMessage(text: string, role: 'user' | 'assistant' = 'user', id = 'test-id'): MastraMessageV2 {
  return {
    id,
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
    createdAt: new Date(),
  };
}

function createTestMessageWithContent(
  text: string,
  content: string,
  role: 'user' | 'assistant' = 'user',
  id = 'test-id',
): MastraMessageV2 {
  return {
    id,
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
      content,
    },
    createdAt: new Date(),
  };
}

function createMockModerationResult(flagged: boolean, categories: string[] = []): ModerationResult {
  const allCategories = [
    'hate',
    'hate/threatening',
    'harassment',
    'harassment/threatening',
    'self-harm',
    'self-harm/intent',
    'self-harm/instructions',
    'sexual',
    'sexual/minors',
    'violence',
    'violence/graphic',
  ];

  const categoryScores = allCategories.reduce(
    (scores, category) => {
      scores[category] = categories.includes(category) ? 0.8 : 0.1;
      return scores;
    },
    {} as Record<string, number>,
  );

  return {
    category_scores: categoryScores,
    reason: flagged ? `Content flagged for: ${categories.join(', ')}` : undefined,
  };
}

function setupMockModel(result: { object: ModerationResult } | { object: ModerationResult }[]): MockLanguageModelV1 {
  const results = Array.isArray(result) ? result : [result];
  let callCount = 0;

  return new MockLanguageModelV1({
    defaultObjectGenerationMode: 'json',
    doGenerate: async () => {
      const currentResult = results[callCount % results.length];
      callCount++;

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: `${JSON.stringify(currentResult.object)}`,
      };
    },
  });
}

describe('ModerationProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor and configuration', () => {
    it('should initialize with required model configuration', () => {
      const model = setupMockModel({ object: createMockModerationResult(false) });
      const moderator = new ModerationProcessor({
        model,
      });

      expect(moderator.name).toBe('moderation');
    });

    it('should use default categories when none specified', () => {
      const model = setupMockModel({ object: createMockModerationResult(false) });
      const moderator = new ModerationProcessor({
        model,
      });

      expect(moderator.name).toBe('moderation');
    });

    it('should accept custom categories', () => {
      const model = setupMockModel({ object: createMockModerationResult(false) });
      const moderator = new ModerationProcessor({
        model,
        categories: ['custom-category', 'another-category'],
      });

      expect(moderator.name).toBe('moderation');
    });

    it('should accept custom threshold and strategy', () => {
      const model = setupMockModel({ object: createMockModerationResult(false) });
      const moderator = new ModerationProcessor({
        model,
        threshold: 0.7,
        strategy: 'warn',
      });

      expect(moderator.name).toBe('moderation');
    });
  });

  describe('message processing with block strategy', () => {
    it('should return all messages when content is not flagged', async () => {
      const model = setupMockModel({ object: createMockModerationResult(false) });
      const moderator = new ModerationProcessor({
        model,
        strategy: 'block',
      });

      const mockAbort = vi.fn();

      const messages = [
        createTestMessage('Hello, how are you?', 'user', 'msg1'),
        createTestMessage('I am doing well, thank you!', 'user', 'msg2'),
      ];

      const result = await moderator.processInput({ messages, abort: mockAbort as any });

      expect(result).toEqual(messages);
      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should abort when content is flagged with block strategy', async () => {
      const model = setupMockModel({ object: createMockModerationResult(true, ['hate', 'harassment']) });
      const moderator = new ModerationProcessor({
        model,
        strategy: 'block',
      });

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('Content blocked');
      });

      const messages = [createTestMessage('This is hateful content', 'user')];

      await expect(async () => {
        await moderator.processInput({ messages, abort: mockAbort as any });
      }).rejects.toThrow('Content blocked');

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('Content flagged for moderation'));
    });

    it('should handle mixed flagged and unflagged content', async () => {
      const model = setupMockModel([
        { object: createMockModerationResult(false) },
        { object: createMockModerationResult(true, ['violence']) },
      ]);
      const moderator = new ModerationProcessor({
        model,
        strategy: 'block',
      });

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('Content blocked');
      });

      const messages = [
        createTestMessage('Safe content', 'user', 'msg1'),
        createTestMessage('Violent content', 'user', 'msg2'),
      ];

      await expect(async () => {
        await moderator.processInput({ messages, abort: mockAbort as any });
      }).rejects.toThrow('Content blocked');

      expect(mockAbort).toHaveBeenCalled();
    });
  });

  describe('message processing with warn strategy', () => {
    it('should log warning but allow flagged content through', async () => {
      const model = setupMockModel({ object: createMockModerationResult(true, ['harassment']) });
      const moderator = new ModerationProcessor({
        model,
        strategy: 'warn',
      });

      const mockAbort = vi.fn();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages = [createTestMessage('Questionable content', 'user')];

      const result = await moderator.processInput({ messages, abort: mockAbort as any });

      expect(result).toEqual(messages);
      expect(mockAbort).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ModerationProcessor] Content flagged for moderation'),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('message processing with filter strategy', () => {
    it('should remove flagged messages but keep safe ones', async () => {
      const model = setupMockModel([
        { object: createMockModerationResult(false) },
        { object: createMockModerationResult(true, ['hate']) },
      ]);
      const moderator = new ModerationProcessor({
        model,
        strategy: 'filter',
      });

      const mockAbort = vi.fn();
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const messages = [
        createTestMessage('Safe message', 'user', 'msg1'),
        createTestMessage('Hateful message', 'user', 'msg2'),
      ];

      const result = await moderator.processInput({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg1');
      expect(mockAbort).not.toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('[ModerationProcessor] Filtered message'));

      consoleInfoSpy.mockRestore();
    });

    it('should return empty array if all messages are flagged', async () => {
      const model = setupMockModel({ object: createMockModerationResult(true, ['harassment']) });
      const moderator = new ModerationProcessor({
        model,
        strategy: 'filter',
      });

      const mockAbort = vi.fn();

      const messages = [
        createTestMessage('Bad message 1', 'user', 'msg1'),
        createTestMessage('Bad message 2', 'user', 'msg2'),
      ];

      const result = await moderator.processInput({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(0);
      expect(mockAbort).not.toHaveBeenCalled();
    });
  });

  describe('threshold handling', () => {
    it('should flag content when any score exceeds threshold', async () => {
      const mockResult = createMockModerationResult(false, []);
      // Override with high violence score to exceed threshold
      mockResult.category_scores!.violence = 0.7; // Above threshold (0.6)
      mockResult.reason = 'High violence score';
      const model = setupMockModel({ object: mockResult });
      const moderator = new ModerationProcessor({
        model,
        threshold: 0.6,
        strategy: 'block',
      });

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('Content blocked');
      });

      const messages = [createTestMessage('Borderline content', 'user')];

      await expect(async () => {
        await moderator.processInput({ messages, abort: mockAbort as any });
      }).rejects.toThrow('Content blocked');

      expect(mockAbort).toHaveBeenCalled();
    });

    it('should not flag content when scores are below threshold', async () => {
      const mockResult = createMockModerationResult(false, []);
      // Set violence score below threshold
      mockResult.category_scores!.violence = 0.7; // Below threshold (0.8)
      const model = setupMockModel({ object: mockResult });
      const moderator = new ModerationProcessor({
        model,
        threshold: 0.8,
        strategy: 'block',
      });

      const mockAbort = vi.fn();

      const messages = [createTestMessage('Borderline content', 'user')];
      const result = await moderator.processInput({ messages, abort: mockAbort as any });

      expect(result).toEqual(messages);
      expect(mockAbort).not.toHaveBeenCalled();
    });
  });

  describe('custom categories', () => {
    it('should work with custom moderation categories', async () => {
      const mockResult = {
        flagged: true,
        categories: { spam: true, advertising: false, 'off-topic': false },
        category_scores: { spam: 0.9, advertising: 0.1, 'off-topic': 0.2 },
        reason: 'Detected spam content',
      };
      const model = setupMockModel({ object: mockResult });
      const moderator = new ModerationProcessor({
        model,
        categories: ['spam', 'advertising', 'off-topic'],
        strategy: 'block',
      });

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('Content blocked');
      });

      const messages = [createTestMessage('Buy now! Limited offer!', 'user')];

      await expect(async () => {
        await moderator.processInput({ messages, abort: mockAbort as any });
      }).rejects.toThrow('Content blocked');

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('spam'));
    });
  });

  describe('content extraction', () => {
    it('should extract text from parts array', async () => {
      const model = setupMockModel({ object: createMockModerationResult(false) });
      const moderator = new ModerationProcessor({
        model,
      });

      const mockAbort = vi.fn();

      const message: MastraMessageV2 = {
        id: 'test',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'First part ' }, { type: 'step-start' }, { type: 'text', text: 'second part' }],
        },
        createdAt: new Date(),
      };

      await moderator.processInput({ messages: [message], abort: mockAbort as any });

      // The model should have been called with the concatenated text
      // We can't easily verify the exact call without exposing internals,
      // but we can verify the process completed successfully
      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should extract text from content field', async () => {
      const model = setupMockModel({ object: createMockModerationResult(false) });
      const moderator = new ModerationProcessor({
        model,
      });

      const mockAbort = vi.fn();

      const message = createTestMessageWithContent('part text', 'content text');
      await moderator.processInput({ messages: [message], abort: mockAbort as any });

      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should skip messages with no text content', async () => {
      const model = setupMockModel({ object: createMockModerationResult(false) });
      const moderator = new ModerationProcessor({
        model,
      });

      const mockAbort = vi.fn();

      const message: MastraMessageV2 = {
        id: 'test',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'step-start' }],
        },
        createdAt: new Date(),
      };

      const result = await moderator.processInput({ messages: [message], abort: mockAbort as any });

      expect(result).toEqual([message]);
      // Model should not have been called for empty text
    });
  });

  describe('error handling', () => {
    it('should fail open when moderation agent fails', async () => {
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => {
          throw new TripWire('Agent failed');
        },
      });
      const moderator = new ModerationProcessor({
        model,
        strategy: 'block',
      });

      const mockAbort = vi.fn();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages = [createTestMessage('Test content', 'user')];
      const result = await moderator.processInput({ messages, abort: mockAbort as any });

      expect(result).toEqual(messages); // Should allow content through
      expect(mockAbort).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ModerationProcessor] Agent moderation failed'),
        expect.anything(),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle empty message array', async () => {
      const model = setupMockModel({ object: createMockModerationResult(false) });
      const moderator = new ModerationProcessor({
        model,
      });

      const mockAbort = vi.fn();
      const result = await moderator.processInput({ messages: [], abort: mockAbort as any });

      expect(result).toEqual([]);
      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should abort on non-tripwire errors during processing', async () => {
      const model = setupMockModel({ object: createMockModerationResult(false) });
      const moderator = new ModerationProcessor({
        model,
      });

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('Processing failed');
      });

      // Force an error during processing by passing invalid data
      const invalidMessage = null as any;

      await expect(async () => {
        await moderator.processInput({ messages: [invalidMessage], abort: mockAbort as any });
      }).rejects.toThrow();

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('Moderation failed'));
    });
  });

  describe('configuration options', () => {
    it('should include scores in logs when includeScores is enabled', async () => {
      const model = setupMockModel({ object: createMockModerationResult(true, ['hate']) });
      const moderator = new ModerationProcessor({
        model,
        strategy: 'warn',
        includeScores: true,
      });

      const mockAbort = vi.fn();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages = [createTestMessage('Flagged content', 'user')];
      await moderator.processInput({ messages, abort: mockAbort as any });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Scores:'));

      consoleSpy.mockRestore();
    });

    it('should use custom instructions when provided', () => {
      const customInstructions = 'Custom moderation instructions for testing';
      const model = setupMockModel({ object: createMockModerationResult(false) });

      const moderator = new ModerationProcessor({
        model,
        instructions: customInstructions,
      });

      expect(moderator.name).toBe('moderation');
      // The custom instructions are used in the Agent constructor
      // which is mocked, but we can verify the processor was created successfully
    });
  });

  describe('edge cases', () => {
    it('should handle malformed moderation results gracefully', async () => {
      const model = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: 'invalid json',
        }),
      });
      const moderator = new ModerationProcessor({
        model,
        strategy: 'warn',
      });

      const mockAbort = vi.fn();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages = [createTestMessage('Test content', 'user')];
      const result = await moderator.processInput({ messages, abort: mockAbort as any });

      // Should fail open and allow content
      expect(result).toEqual(messages);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle very long content', async () => {
      const model = setupMockModel({ object: createMockModerationResult(false) });
      const moderator = new ModerationProcessor({
        model,
      });

      const mockAbort = vi.fn();

      const longText = 'A'.repeat(10000);
      const messages = [createTestMessage(longText, 'user')];

      const result = await moderator.processInput({ messages, abort: mockAbort as any });

      expect(result).toEqual(messages);
    });
  });

  describe('processOutputStream', () => {
    it('should always moderate current part even when chunkWindow is 0', async () => {
      const model = setupMockModel({ object: createMockModerationResult(true, ['hate']) });
      const moderator = new ModerationProcessor({
        model,
        chunkWindow: 0, // No context window
        strategy: 'block',
      });

      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('Content flagged');
      });

      const part: ChunkType = {
        type: 'text-delta' as const,
        payload: { text: 'Flagged content', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const streamParts: any[] = []; // Empty context

      // Should attempt to moderate the current part and abort
      await expect(async () => {
        await moderator.processOutputStream({
          part,
          streamParts,
          state: {},
          abort: mockAbort as any,
        });
      }).rejects.toThrow('Content flagged');

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('Content flagged for moderation'));
    });

    it('should include context when chunkWindow is greater than 0', async () => {
      const model = setupMockModel({ object: createMockModerationResult(false) });
      const moderator = new ModerationProcessor({
        model,
        chunkWindow: 2, // Include 2 previous chunks
        strategy: 'block',
      });

      const mockAbort = vi.fn();

      const previousChunks: ChunkType[] = [
        {
          type: 'text-delta' as const,
          payload: { text: 'Previous content ', id: '1' },
          runId: '1',
          from: ChunkFrom.AGENT,
        },
        { type: 'text-delta' as const, payload: { text: 'more context ', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
      ];
      const currentChunk: ChunkType = {
        type: 'text-delta' as const,
        payload: { text: 'current part', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };

      const result = await moderator.processOutputStream({
        part: currentChunk,
        streamParts: previousChunks,
        state: {},
        abort: mockAbort as any,
      });

      // Should return the part if moderation passes
      expect(result).toEqual(currentChunk);
      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should skip non-text-delta chunks', async () => {
      const model = setupMockModel({ object: createMockModerationResult(true, ['hate']) });
      const moderator = new ModerationProcessor({
        model,
        strategy: 'block',
      });

      const mockAbort = vi.fn();

      const objectChunk: ChunkType = {
        type: 'object' as const,
        object: { key: 'value' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };

      const result = await moderator.processOutputStream({
        part: objectChunk,
        streamParts: [],
        state: {},
        abort: mockAbort as any,
      });

      // Should return the part without moderation
      expect(result).toEqual(objectChunk);
      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should properly handle chunkWindow=0 with current part in streamParts', async () => {
      const model = setupMockModel({ object: createMockModerationResult(false) });
      const moderator = new ModerationProcessor({
        model,
        chunkWindow: 0, // No context window
        strategy: 'block',
      });

      const mockAbort = vi.fn();

      const currentChunk: ChunkType = {
        type: 'text-delta' as const,
        payload: { text: 'Safe content', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const streamParts = [currentChunk]; // streamParts includes the current part

      const result = await moderator.processOutputStream({
        part: currentChunk,
        streamParts,
        state: {},
        abort: mockAbort as any,
      });

      // Should moderate the current part and return it if safe
      expect(result).toEqual(currentChunk);
      expect(mockAbort).not.toHaveBeenCalled();
    });
  });
});

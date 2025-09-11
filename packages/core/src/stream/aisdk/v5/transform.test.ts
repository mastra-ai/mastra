import { describe, it, expect } from 'vitest';
import { convertMastraChunkToAISDKv5 } from './transform';
import { ChunkFrom } from '../../types';

describe('convertMastraChunkToAISDKv5', () => {
  describe('step-start chunk transformation', () => {
    it('should preserve messageId when converting step-start chunk', () => {
      // Arrange: Create a step-start chunk with a messageId
      const messageId = 'msg_123456789';
      const stepStartChunk = {
        type: 'step-start' as const,
        runId: 'test-run-123',
        from: ChunkFrom.AGENT,
        payload: {
          request: {
            prompt: 'test prompt',
          },
          warnings: [],
          messageId: messageId, // This is the database message ID
        },
      };

      // Act: Convert the chunk
      const result = convertMastraChunkToAISDKv5({
        chunk: stepStartChunk,
      });

      // Assert: The messageId should be preserved in the converted chunk
      expect(result).toBeDefined();
      expect(result?.type).toBe('start-step');

      // This assertion should fail with the current implementation
      // because messageId is being stripped out
      expect((result as any)?.messageId).toBe(messageId);

      // Also verify other properties are preserved
      expect((result as any)?.request).toEqual({
        prompt: 'test prompt',
      });
      expect((result as any)?.warnings).toEqual([]);
    });

    it('should make messageId available for toUIMessageStream', () => {
      // This test verifies that the messageId flows through the entire transformation pipeline
      const messageId = 'db_message_id_12345';
      const stepStartChunk = {
        type: 'step-start' as const,
        runId: 'test-run-456',
        from: ChunkFrom.AGENT,
        payload: {
          request: {},
          warnings: [],
          messageId: messageId,
        },
      };

      // Convert to AI SDK format
      const aiSDKChunk = convertMastraChunkToAISDKv5({
        chunk: stepStartChunk,
      });

      // The messageId should be available in the AI SDK chunk
      // so that toUIMessageStream can use it instead of generating a new ID
      expect(aiSDKChunk).toBeDefined();
      expect((aiSDKChunk as any)?.messageId).toBe(messageId);

      // This is important because toUIMessageStream needs this ID
      // to maintain consistency with the database
    });
  });

  describe('start chunk transformation', () => {
    it('should handle start chunk (not step-start) correctly', () => {
      // This test ensures we don't break the regular 'start' chunk handling
      const startChunk = {
        type: 'start' as const,
        runId: 'test-run-789',
        from: ChunkFrom.AGENT,
        payload: {},
      };

      const result = convertMastraChunkToAISDKv5({
        chunk: startChunk,
      });

      expect(result).toBeDefined();
      expect(result?.type).toBe('start');
    });
  });
});

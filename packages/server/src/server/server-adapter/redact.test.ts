import type { ChunkType } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';
import { redactStreamChunk } from './redact';

describe('redactStreamChunk', () => {
  describe('v1 format (legacy)', () => {
    it('should remove request from step-start chunk', () => {
      const chunk = {
        type: 'step-start' as const,
        messageId: 'msg-123',
        request: {
          body: JSON.stringify({
            model: 'gpt-4',
            input: [{ role: 'system', content: 'SECRET INSTRUCTIONS' }],
            tools: [{ name: 'secretTool', description: 'Secret tool' }],
          }),
        },
        warnings: [],
      };

      const redacted = redactStreamChunk(chunk as ChunkType);

      expect(redacted.type).toBe('step-start');
      expect((redacted as any).messageId).toBe('msg-123');
      expect((redacted as any).request).toEqual({});
      expect((redacted as any).warnings).toEqual([]);

      // Verify sensitive data is removed
      const chunkStr = JSON.stringify(redacted);
      expect(chunkStr).not.toContain('SECRET INSTRUCTIONS');
      expect(chunkStr).not.toContain('secretTool');
    });

    it('should remove request from step-finish chunk', () => {
      const chunk = {
        type: 'step-finish' as const,
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        request: {
          body: JSON.stringify({
            model: 'gpt-4',
            input: [{ role: 'system', content: 'CONFIDENTIAL' }],
          }),
        },
        response: { id: 'resp-123' },
      };

      const redacted = redactStreamChunk(chunk as ChunkType);

      expect(redacted.type).toBe('step-finish');
      expect((redacted as any).finishReason).toBe('stop');
      expect((redacted as any).request).toBeUndefined();
      expect((redacted as any).response).toEqual({ id: 'resp-123' });

      // Verify sensitive data is removed
      const chunkStr = JSON.stringify(redacted);
      expect(chunkStr).not.toContain('CONFIDENTIAL');
    });
  });

  describe('v2 format', () => {
    it('should remove request from step-start payload', () => {
      const chunk = {
        runId: 'run-123',
        from: 'AGENT',
        type: 'step-start' as const,
        payload: {
          request: {
            body: JSON.stringify({
              model: 'gpt-4',
              input: [{ role: 'system', content: 'SECRET INSTRUCTIONS' }],
              tools: [{ name: 'secretTool', description: 'Secret tool' }],
            }),
          },
          warnings: [],
          messageId: 'msg-123',
        },
      };

      const redacted = redactStreamChunk(chunk as ChunkType);

      expect(redacted.type).toBe('step-start');
      expect((redacted as any).runId).toBe('run-123');
      expect((redacted as any).payload.request).toEqual({});
      expect((redacted as any).payload.warnings).toEqual([]);
      expect((redacted as any).payload.messageId).toBe('msg-123');

      // Verify sensitive data is removed
      const chunkStr = JSON.stringify(redacted);
      expect(chunkStr).not.toContain('SECRET INSTRUCTIONS');
      expect(chunkStr).not.toContain('secretTool');
    });

    it('should remove request from step-finish payload.metadata and payload.output.steps[]', () => {
      const sensitiveRequest = {
        body: JSON.stringify({
          model: 'gpt-4',
          input: [{ role: 'system', content: 'API_KEY=sk-secret' }],
        }),
      };

      const chunk = {
        type: 'step-finish' as const,
        runId: 'run-123',
        from: 'AGENT',
        payload: {
          messageId: 'msg-123',
          stepResult: { reason: 'stop' },
          metadata: {
            id: 'id-123',
            timestamp: '2024-01-01T00:00:00.000Z',
            request: sensitiveRequest,
          },
          output: {
            text: 'Hello',
            steps: [
              {
                content: [],
                usage: { inputTokens: 10, outputTokens: 20 },
                request: sensitiveRequest,
                response: { id: 'resp-123' },
              },
            ],
          },
        },
      };

      const redacted = redactStreamChunk(chunk as ChunkType);

      expect(redacted.type).toBe('step-finish');
      expect((redacted as any).payload.metadata.request).toBeUndefined();
      expect((redacted as any).payload.metadata.id).toBe('id-123');
      expect((redacted as any).payload.output.steps[0].request).toBeUndefined();
      expect((redacted as any).payload.output.steps[0].response).toEqual({ id: 'resp-123' });

      // Verify sensitive data is removed
      const chunkStr = JSON.stringify(redacted);
      expect(chunkStr).not.toContain('API_KEY');
      expect(chunkStr).not.toContain('sk-secret');
    });

    it('should remove request from finish payload.metadata and payload.output.steps[]', () => {
      const sensitiveRequest = {
        body: JSON.stringify({
          model: 'gpt-4',
          input: [{ role: 'system', content: 'INTERNAL_SECRET' }],
        }),
      };

      const chunk = {
        type: 'finish' as const,
        runId: 'run-123',
        from: 'AGENT',
        payload: {
          messageId: 'msg-123',
          metadata: {
            id: 'id-123',
            request: sensitiveRequest,
          },
          output: {
            text: 'Done',
            steps: [
              {
                content: [],
                request: sensitiveRequest,
              },
            ],
          },
        },
      };

      const redacted = redactStreamChunk(chunk as ChunkType);

      expect(redacted.type).toBe('finish');
      expect((redacted as any).payload.metadata.request).toBeUndefined();
      expect((redacted as any).payload.output.steps[0].request).toBeUndefined();

      // Verify sensitive data is removed
      const chunkStr = JSON.stringify(redacted);
      expect(chunkStr).not.toContain('INTERNAL_SECRET');
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined chunks', () => {
      expect(redactStreamChunk(null as any)).toBeNull();
      expect(redactStreamChunk(undefined as any)).toBeUndefined();
    });

    it('should pass through other chunk types unchanged', () => {
      const textDeltaChunk = {
        type: 'text-delta' as const,
        textDelta: 'Hello',
      };

      const redacted = redactStreamChunk(textDeltaChunk as ChunkType);
      expect(redacted).toEqual(textDeltaChunk);
    });

    it('should handle chunks without request field', () => {
      const chunk = {
        type: 'step-start' as const,
        messageId: 'msg-123',
        warnings: [],
      };

      const redacted = redactStreamChunk(chunk as ChunkType);
      expect(redacted).toEqual(chunk);
    });

    it('should handle v2 chunks without payload', () => {
      const chunk = {
        type: 'step-start' as const,
        runId: 'run-123',
      };

      const redacted = redactStreamChunk(chunk as ChunkType);
      expect(redacted).toEqual(chunk);
    });

    it('should handle output.steps that is not an array', () => {
      const chunk = {
        type: 'step-finish' as const,
        runId: 'run-123',
        from: 'AGENT',
        payload: {
          metadata: { request: { body: 'secret' } },
          output: {
            text: 'Hello',
            steps: 'not-an-array', // Edge case
          },
        },
      };

      const redacted = redactStreamChunk(chunk as ChunkType);
      expect((redacted as any).payload.metadata.request).toBeUndefined();
      expect((redacted as any).payload.output.steps).toBe('not-an-array');
    });
  });
});

import type { SpanRecord } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';
import { isTokenLimitExceeded, getTokenLimitMessage, getInputPreview } from '../span-utils';

describe('span-utils', () => {
  const createMockSpan = (attributes: any): SpanRecord => ({
    traceId: 'test-trace-id',
    spanId: 'test-span-id',
    parentSpanId: null,
    name: 'Test Span',
    scope: null,
    spanType: 'MODEL_GENERATION' as any,
    attributes,
    metadata: null,
    links: null,
    tags: null,
    startedAt: new Date('2025-01-01T00:00:00Z'),
    endedAt: new Date('2025-01-01T00:00:01Z'),
    input: null,
    output: null,
    error: null,
    requestContext: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:01Z'),
    isEvent: false,
    // Entity identification
    entityType: null,
    entityId: null,
    entityName: null,
    // Identity & Tenancy
    userId: null,
    organizationId: null,
    resourceId: null,
    // Correlation IDs
    runId: null,
    sessionId: null,
    threadId: null,
    requestId: null,
    // Deployment context
    environment: null,
    source: null,
    serviceName: null,
  });

  describe('isTokenLimitExceeded', () => {
    it('should return true when finishReason is "length"', () => {
      const span = createMockSpan({ finishReason: 'length' });
      expect(isTokenLimitExceeded(span)).toBe(true);
    });

    it('should return false when finishReason is "stop"', () => {
      const span = createMockSpan({ finishReason: 'stop' });
      expect(isTokenLimitExceeded(span)).toBe(false);
    });

    it('should return false when finishReason is "tool-calls"', () => {
      const span = createMockSpan({ finishReason: 'tool-calls' });
      expect(isTokenLimitExceeded(span)).toBe(false);
    });

    it('should return false when finishReason is missing', () => {
      const span = createMockSpan({});
      expect(isTokenLimitExceeded(span)).toBe(false);
    });

    it('should return false when span is undefined', () => {
      expect(isTokenLimitExceeded(undefined)).toBe(false);
    });

    it('should return false when attributes is null', () => {
      const span = createMockSpan(null);
      span.attributes = null;
      expect(isTokenLimitExceeded(span)).toBe(false);
    });
  });

  describe('getTokenLimitMessage', () => {
    it('should show token breakdown when input and output tokens are available', () => {
      const span = createMockSpan({
        usage: {
          inputTokens: 100,
          outputTokens: 4096,
          totalTokens: 4196,
        },
      });
      const message = getTokenLimitMessage(span);
      expect(message).toContain('100 input');
      expect(message).toContain('4096 output');
      expect(message).toContain('4196 total');
      expect(message).toContain('token limit');
      expect(message).toContain('truncated');
      expect(message).toContain('Token usage:');
    });

    it('should show total tokens when breakdown is not available', () => {
      const span = createMockSpan({
        usage: {
          totalTokens: 4196,
        },
      });
      const message = getTokenLimitMessage(span);
      expect(message).toContain('4196 tokens');
      expect(message).toContain('token limit');
      expect(message).toContain('truncated');
    });

    it('should work without token count', () => {
      const span = createMockSpan({});
      const message = getTokenLimitMessage(span);
      expect(message).toContain('token limit');
      expect(message).toContain('truncated');
      expect(message).not.toContain('input');
      expect(message).not.toContain('output');
    });

    it('should work with undefined span', () => {
      const message = getTokenLimitMessage(undefined);
      expect(message).toContain('token limit');
      expect(message).toContain('truncated');
    });

    it('should calculate total from input + output when totalTokens is missing', () => {
      const span = createMockSpan({
        usage: {
          inputTokens: 100,
          outputTokens: 200,
        },
      });
      const message = getTokenLimitMessage(span);
      expect(message).toContain('100 input');
      expect(message).toContain('200 output');
      expect(message).toContain('300 total');
    });

    it('should separate main message from token usage with newlines', () => {
      const span = createMockSpan({
        usage: {
          inputTokens: 100,
          outputTokens: 200,
        },
      });
      const message = getTokenLimitMessage(span);
      expect(message).toContain('\n\n');
    });
  });

  describe('getInputPreview', () => {
    it('should return empty string for null input', () => {
      expect(getInputPreview(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(getInputPreview(undefined)).toBe('');
    });

    it('should extract user message content from message array', () => {
      const input = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello, how are you?' },
      ];
      expect(getInputPreview(input)).toBe('Hello, how are you?');
    });

    it('should join multiple user messages with pipe separator', () => {
      const input = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Response' },
        { role: 'user', content: 'Second message' },
      ];
      expect(getInputPreview(input)).toBe('First message | Second message');
    });

    it('should truncate long text to maxLength with ellipsis', () => {
      const longContent = 'a'.repeat(150);
      const input = [{ role: 'user', content: longContent }];
      const result = getInputPreview(input, 100);
      expect(result).toHaveLength(101); // 100 chars + ellipsis
      expect(result.endsWith('…')).toBe(true);
    });

    it('should handle multipart content arrays', () => {
      const input = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            { type: 'image', image_url: 'http://example.com/img.png' },
          ],
        },
      ];
      expect(getInputPreview(input)).toBe('What is in this image?');
    });

    it('should handle plain string input', () => {
      expect(getInputPreview('Hello world')).toBe('Hello world');
    });

    it('should truncate long string input', () => {
      const longStr = 'b'.repeat(150);
      const result = getInputPreview(longStr, 100);
      expect(result).toHaveLength(101);
      expect(result.endsWith('…')).toBe(true);
    });

    it('should fallback to JSON.stringify for object input', () => {
      const input = { key: 'value' };
      expect(getInputPreview(input)).toBe('{"key":"value"}');
    });

    it('should handle empty message array', () => {
      expect(getInputPreview([])).toBe('');
    });

    it('should skip messages without user role', () => {
      const input = [
        { role: 'system', content: 'System prompt' },
        { role: 'assistant', content: 'Assistant response' },
      ];
      expect(getInputPreview(input)).toBe('');
    });

    it('should use custom maxLength', () => {
      const input = [{ role: 'user', content: 'Hello world, this is a test message' }];
      const result = getInputPreview(input, 10);
      expect(result).toBe('Hello worl…');
    });
  });
});

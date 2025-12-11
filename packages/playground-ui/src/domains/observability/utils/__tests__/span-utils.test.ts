import { describe, it, expect } from 'vitest';
import { isTokenLimitExceeded, getTokenLimitMessage } from '../span-utils';
import { SpanRecord } from '@mastra/core/storage';

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
});

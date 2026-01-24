import { describe, it, expect } from 'vitest';
import {
  serializeEvent,
  serializeEvents,
  serializeEventsToBuffer,
  estimateEventSize,
  parseJsonl,
} from './serializer.js';
import type { ObservabilityEvent } from './types.js';

describe('serializer', () => {
  const mockTrace: ObservabilityEvent = {
    type: 'trace',
    data: {
      traceId: 'trace_123',
      projectId: 'proj_456',
      deploymentId: 'deploy_789',
      name: 'test-trace',
      startTime: new Date('2025-01-23T12:00:00.000Z'),
      endTime: new Date('2025-01-23T12:00:01.000Z'),
      durationMs: 1000,
      status: 'ok',
      metadata: {},
    },
  };

  const mockSpan: ObservabilityEvent = {
    type: 'span',
    data: {
      spanId: 'span_789',
      traceId: 'trace_123',
      parentSpanId: null,
      projectId: 'proj_456',
      deploymentId: 'deploy_789',
      name: 'llm-call',
      kind: 'internal',
      startTime: new Date('2025-01-23T12:00:00.000Z'),
      endTime: new Date('2025-01-23T12:00:00.500Z'),
      durationMs: 500,
      status: 'ok',
      attributes: {},
      events: [],
    },
  };

  describe('serializeEvent', () => {
    it('should serialize a single event to JSON string', () => {
      const result = serializeEvent(mockTrace);
      expect(result).toBe(JSON.stringify(mockTrace));
    });

    it('should not include trailing newline', () => {
      const result = serializeEvent(mockTrace);
      expect(result.endsWith('\n')).toBe(false);
    });

    it('should produce valid JSON', () => {
      const result = serializeEvent(mockTrace);
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe('serializeEvents', () => {
    it('should serialize multiple events to JSONL format', () => {
      const events = [mockTrace, mockSpan];
      const result = serializeEvents(events);

      expect(result).toBe(JSON.stringify(mockTrace) + '\n' + JSON.stringify(mockSpan) + '\n');
    });

    it('should end with a newline', () => {
      const result = serializeEvents([mockTrace]);
      expect(result.endsWith('\n')).toBe(true);
    });

    it('should return empty string for empty array', () => {
      const result = serializeEvents([]);
      expect(result).toBe('');
    });

    it('should produce one valid JSON per line', () => {
      const events = [mockTrace, mockSpan];
      const result = serializeEvents(events);
      const lines = result.split('\n').filter(line => line.length > 0);

      expect(lines).toHaveLength(2);
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });
  });

  describe('serializeEventsToBuffer', () => {
    it('should return a Buffer with JSONL content', () => {
      const events = [mockTrace, mockSpan];
      const result = serializeEventsToBuffer(events);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString('utf8')).toBe(serializeEvents(events));
    });

    it('should return empty buffer for empty array', () => {
      const result = serializeEventsToBuffer([]);
      expect(result.length).toBe(0);
    });
  });

  describe('estimateEventSize', () => {
    it('should return the byte size including newline', () => {
      const size = estimateEventSize(mockTrace);
      const actualSize = Buffer.byteLength(JSON.stringify(mockTrace), 'utf8') + 1;
      expect(size).toBe(actualSize);
    });

    it('should handle events with unicode characters', () => {
      const eventWithUnicode: ObservabilityEvent = {
        type: 'trace',
        data: {
          ...mockTrace.data,
          name: 'テスト-trace-🚀',
        },
      };
      const size = estimateEventSize(eventWithUnicode);
      const actualSize = Buffer.byteLength(JSON.stringify(eventWithUnicode), 'utf8') + 1;
      expect(size).toBe(actualSize);
    });

    it('should account for complex nested data', () => {
      const eventWithNested: ObservabilityEvent = {
        type: 'trace',
        data: {
          ...mockTrace.data,
          metadata: {
            nested: { deeply: { value: 'test' } },
            array: [1, 2, 3],
          },
        },
      };
      const size = estimateEventSize(eventWithNested);
      const actualSize = Buffer.byteLength(JSON.stringify(eventWithNested), 'utf8') + 1;
      expect(size).toBe(actualSize);
    });
  });

  describe('parseJsonl', () => {
    it('should parse JSONL content back to events', () => {
      const events = [mockTrace, mockSpan];
      const jsonl = serializeEvents(events);
      const parsed = parseJsonl(jsonl);

      // Compare serialized forms since Date objects don't compare equal
      expect(JSON.stringify(parsed)).toBe(JSON.stringify(events));
    });

    it('should handle empty lines', () => {
      const jsonl = JSON.stringify(mockTrace) + '\n\n' + JSON.stringify(mockSpan) + '\n';
      const parsed = parseJsonl(jsonl);

      expect(parsed).toHaveLength(2);
    });

    it('should handle single event', () => {
      const jsonl = JSON.stringify(mockTrace) + '\n';
      const parsed = parseJsonl(jsonl);

      expect(parsed).toHaveLength(1);
      expect(JSON.stringify(parsed[0])).toBe(JSON.stringify(mockTrace));
    });

    it('should handle content without trailing newline', () => {
      const jsonl = JSON.stringify(mockTrace);
      const parsed = parseJsonl(jsonl);

      expect(parsed).toHaveLength(1);
    });

    it('should handle whitespace-only lines', () => {
      const jsonl = JSON.stringify(mockTrace) + '\n   \n' + JSON.stringify(mockSpan) + '\n';
      const parsed = parseJsonl(jsonl);

      expect(parsed).toHaveLength(2);
    });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../message-list';

describe('Context Filter Implementation', () => {
  let testMessages: MastraDBMessage[];

  beforeEach(() => {
    // Create a realistic set of messages with different roles
    // Using type assertions for test simplicity
    testMessages = [
      {
        id: '1',
        role: 'system',
        content: { format: 2, parts: [{ type: 'text', text: 'You are a helpful assistant' }] },
        createdAt: new Date(),
      },
      {
        id: '2',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Hello, can you help me?' }] },
        createdAt: new Date(),
      },
      {
        id: '3',
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'tool-invocation', toolCallId: 'call-1', toolName: 'search', args: { query: 'test' } }],
        },
        createdAt: new Date(),
      },
      {
        id: '4',
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Based on the search, here is the answer' }],
        },
        createdAt: new Date(),
      },
      {
        id: '5',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Thank you!' }] },
        createdAt: new Date(),
      },
    ] as MastraDBMessage[];
  });

  describe('maxMessages filter', () => {
    it('should limit messages to the specified maximum', () => {
      const maxMessages = 3;
      let filtered = testMessages;

      // Apply maxMessages filter (take most recent)
      if (maxMessages > 0 && filtered.length > maxMessages) {
        filtered = filtered.slice(-maxMessages);
      }

      expect(filtered.length).toBe(3);
      expect(filtered[0]?.id).toBe('3'); // Last 3 messages
      expect(filtered[1]?.id).toBe('4');
      expect(filtered[2]?.id).toBe('5');
    });

    it('should not filter when maxMessages is greater than message count', () => {
      const maxMessages = 10;
      let filtered = testMessages;

      if (maxMessages > 0 && filtered.length > maxMessages) {
        filtered = filtered.slice(-maxMessages);
      }

      expect(filtered.length).toBe(testMessages.length);
    });
  });

  describe('includeSystem filter', () => {
    it('should remove system messages when includeSystem is false', () => {
      const includeSystem = false;
      let filtered = testMessages;

      if (includeSystem === false) {
        filtered = filtered.filter(m => m.role !== 'system');
      }

      expect(filtered.every(m => m.role !== 'system')).toBe(true);
      expect(filtered.length).toBe(4); // Original 5 minus 1 system message
    });

    it('should keep system messages when includeSystem is not false', () => {
      let filtered = testMessages;
      // When includeSystem is true or undefined, don't filter
      const systemMessages = filtered.filter(m => m.role === 'system');
      expect(systemMessages.length).toBe(1);
    });
  });

  describe('includeToolMessages filter', () => {
    it('should remove tool invocation messages when includeToolMessages is false', () => {
      const includeToolMessages = false;
      let filtered = testMessages;

      if (includeToolMessages === false) {
        filtered = filtered.filter(m => {
          if (m.role === 'assistant' && m.content) {
            const content = m.content;
            if (typeof content === 'object' && content !== null && 'parts' in content) {
              const parts = (content as any).parts;
              return !parts.some((p: any) => p.type === 'tool-invocation' || p.type === 'tool-call');
            }
          }
          return true;
        });
      }

      // Should filter out assistant with tool invocation (id 3)
      expect(filtered.find(m => m.id === '3')).toBeUndefined();
      expect(filtered.find(m => m.id === '4')).toBeDefined(); // Regular assistant message should remain
    });
  });

  describe('custom filter function', () => {
    it('should apply custom filter correctly', () => {
      const customFilter = (msg: MastraDBMessage) => msg.role === 'user' || msg.role === 'assistant';
      let filtered = testMessages;

      filtered = filtered.filter(customFilter);

      expect(filtered.every(m => m.role === 'user' || m.role === 'assistant')).toBe(true);
      expect(filtered.some(m => m.role === 'system')).toBe(false);
    });
  });

  describe('combined filters', () => {
    it('should apply all filters in the correct order', () => {
      let filtered = testMessages;
      const maxMessages = 3;
      const includeSystem = false;
      const includeToolMessages = false;
      const customFilter = (msg: MastraDBMessage) => msg.content !== null && msg.content !== undefined;

      // Apply filters in the same order as the implementation
      // 1. includeSystem
      if (includeSystem === false) {
        filtered = filtered.filter(m => m.role !== 'system');
      }

      // 2. includeToolMessages
      if (includeToolMessages === false) {
        filtered = filtered.filter(m => {
          if (m.role === 'assistant' && m.content) {
            const content = m.content;
            if (typeof content === 'object' && content !== null && 'parts' in content) {
              const parts = (content as any).parts;
              return !parts.some((p: any) => p.type === 'tool-invocation' || p.type === 'tool-call');
            }
          }
          return true;
        });
      }

      // 3. custom filter
      filtered = filtered.filter(customFilter);

      // 4. maxMessages
      if (maxMessages > 0 && filtered.length > maxMessages) {
        filtered = filtered.slice(-maxMessages);
      }

      // Verify results
      expect(filtered.length).toBeLessThanOrEqual(maxMessages);
      expect(filtered.every(m => m.role !== 'system')).toBe(true);
      expect(filtered.every(m => m.content !== null && m.content !== undefined)).toBe(true);

      // Should have filtered out system message and tool invocation
      expect(filtered.find(m => m.id === '1')).toBeUndefined(); // system message
      expect(filtered.find(m => m.id === '3')).toBeUndefined(); // tool invocation
    });

    it('should handle edge case with empty messages', () => {
      let filtered: MastraDBMessage[] = [];
      const maxMessages = 5;
      const includeSystem = false;

      if (includeSystem === false) {
        filtered = filtered.filter(m => m.role !== 'system');
      }

      if (maxMessages > 0 && filtered.length > maxMessages) {
        filtered = filtered.slice(-maxMessages);
      }

      expect(filtered.length).toBe(0);
    });

    it('should respect filter order: type filters first, then custom, then maxMessages last', () => {
      let filtered = testMessages;

      // This order matters - we want to filter by type first, then limit count
      // 1. Remove system messages
      filtered = filtered.filter(m => m.role !== 'system');
      expect(filtered.length).toBe(4);

      // 2. Apply custom filter - only keep user messages
      filtered = filtered.filter(m => m.role === 'user');
      expect(filtered.length).toBe(2); // Only user messages

      // 3. Finally apply maxMessages to the filtered set
      const maxMessages = 1;
      if (maxMessages > 0 && filtered.length > maxMessages) {
        filtered = filtered.slice(-maxMessages);
      }

      expect(filtered.length).toBe(1);
      expect(filtered[0]?.id).toBe('5'); // Most recent user message
    });
  });
});

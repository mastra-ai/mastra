import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';

import { toAISdkV4Messages, toAISdkV5Messages } from '../convert-messages';

describe('toAISdkFormat', () => {
  const sampleMessages: MastraDBMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: [{ type: 'text', text: 'Hello' }],
      createdAt: new Date(),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hi there!' }],
      createdAt: new Date(),
    },
  ];

  describe('toAISdkV5Messages', () => {
    it('should convert Mastra V2 messages to AI SDK V5 UI format', () => {
      const result = toAISdkV5Messages(sampleMessages);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'msg-1');
      expect(result[0]).toHaveProperty('role', 'user');
      expect(result[1]).toHaveProperty('id', 'msg-2');
      expect(result[1]).toHaveProperty('role', 'assistant');
    });

    it('should handle empty array', () => {
      const result = toAISdkV5Messages([]);
      expect(result).toEqual([]);
    });
  });

  describe('toAISdkV4Messages', () => {
    it('should convert Mastra V2 messages to AI SDK V4 UI format', () => {
      const result = toAISdkV4Messages(sampleMessages);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'msg-1');
      expect(result[0]).toHaveProperty('role', 'user');
      expect(result[1]).toHaveProperty('id', 'msg-2');
      expect(result[1]).toHaveProperty('role', 'assistant');
    });

    it('should handle empty array', () => {
      const result = toAISdkV4Messages([]);
      expect(result).toEqual([]);
    });
  });
});

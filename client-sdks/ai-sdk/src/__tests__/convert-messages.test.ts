import type { MastraMessageV2 } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';

import { toAISdkV4Format, toAISdkV5Format } from '../convert-messages';

describe('toAISdkFormat', () => {
  const sampleMessages: MastraMessageV2[] = [
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

  describe('toAISdkV5Format', () => {
    it('should convert Mastra V2 messages to AI SDK V5 UI format', () => {
      const result = toAISdkV5Format(sampleMessages);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'msg-1');
      expect(result[0]).toHaveProperty('role', 'user');
      expect(result[1]).toHaveProperty('id', 'msg-2');
      expect(result[1]).toHaveProperty('role', 'assistant');
    });

    it('should handle empty array', () => {
      const result = toAISdkV5Format([]);
      expect(result).toEqual([]);
    });
  });

  describe('toAISdkV4Format', () => {
    it('should convert Mastra V2 messages to AI SDK V4 UI format', () => {
      const result = toAISdkV4Format(sampleMessages);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'msg-1');
      expect(result[0]).toHaveProperty('role', 'user');
      expect(result[1]).toHaveProperty('id', 'msg-2');
      expect(result[1]).toHaveProperty('role', 'assistant');
    });

    it('should handle empty array', () => {
      const result = toAISdkV4Format([]);
      expect(result).toEqual([]);
    });
  });
});

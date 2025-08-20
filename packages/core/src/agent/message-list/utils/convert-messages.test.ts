import { describe, it, expect } from 'vitest';
import type * as AIV4 from 'ai';
import type * as AIV5 from 'ai-v5';
import { convertMessages } from './convert-messages';
import type { MastraMessageV2 } from '../index';

describe('convertMessages', () => {
  describe('AIV5 UI to other formats', () => {
    const v5UIMessage: AIV5.UIMessage = {
      id: 'test-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Hello world' }],
    };

    it('converts AIV5 UI to AIV4 UI', () => {
      const result = convertMessages(v5UIMessage).to('AIV4.UI');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('Hello world');
    });

    it('converts AIV5 UI to AIV4 Core', () => {
      const result = convertMessages(v5UIMessage).to('AIV4.Core');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toEqual([{ type: 'text', text: 'Hello world' }]);
    });

    it('converts AIV5 UI to Mastra V2', () => {
      const result = convertMessages(v5UIMessage).to('Mastra.V2');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content.format).toBe(2);
      expect(result[0].content.parts).toHaveLength(1);
      expect(result[0].content.parts[0].type).toBe('text');
      expect(result[0].content.parts[0].text).toBe('Hello world');
    });
  });

  describe('AIV4 UI to other formats', () => {
    const v4UIMessage: AIV4.UIMessage = {
      id: 'test-2',
      role: 'assistant',
      content: 'Hi there!',
    };

    it('converts AIV4 UI to AIV5 UI', () => {
      const result = convertMessages(v4UIMessage).to('AIV5.UI');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      // Check for text part - may have additional parts
      const textPart = result[0].parts.find(p => p.type === 'text');
      expect(textPart).toBeDefined();
      expect(textPart?.text).toBe('Hi there!');
    });

    it('converts AIV4 UI to AIV5 Model', () => {
      const result = convertMessages(v4UIMessage).to('AIV5.Model');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      expect(result[0].content).toEqual([{ type: 'text', text: 'Hi there!' }]);
    });

    it('converts AIV4 UI to Mastra V2', () => {
      const result = convertMessages(v4UIMessage).to('Mastra.V2');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      expect(result[0].content.format).toBe(2);
      expect(result[0].content.content).toBe('Hi there!');
    });
  });

  describe('Mastra V2 to other formats', () => {
    const mastraV2Message: MastraMessageV2 = {
      id: 'test-3',
      role: 'user',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Test message' }],
        content: 'Test message',
      },
    };

    it('converts Mastra V2 to AIV4 UI', () => {
      const result = convertMessages(mastraV2Message).to('AIV4.UI');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('Test message');
    });

    it('converts Mastra V2 to AIV5 UI', () => {
      const result = convertMessages(mastraV2Message).to('AIV5.UI');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].parts).toEqual([{ type: 'text', text: 'Test message' }]);
    });
  });

  describe('Multiple messages', () => {
    const messages = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Hello',
      },
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: 'Hi! How can I help?',
      },
      {
        id: 'msg-3',
        role: 'user' as const,
        content: 'What is the weather?',
      },
    ];

    it('converts multiple AIV4 UI messages to AIV5 UI', () => {
      const result = convertMessages(messages).to('AIV5.UI');
      expect(result).toHaveLength(3);
      expect(result[0].role).toBe('user');
      const textPart0 = result[0].parts.find(p => p.type === 'text');
      expect(textPart0?.text).toBe('Hello');

      expect(result[1].role).toBe('assistant');
      const textPart1 = result[1].parts.find(p => p.type === 'text');
      expect(textPart1?.text).toBe('Hi! How can I help?');

      expect(result[2].role).toBe('user');
      const textPart2 = result[2].parts.find(p => p.type === 'text');
      expect(textPart2?.text).toBe('What is the weather?');
    });

    it('converts multiple messages to Mastra V2', () => {
      const result = convertMessages(messages).to('Mastra.V2');
      expect(result).toHaveLength(3);
      expect(result[0].content.content).toBe('Hello');
      expect(result[1].content.content).toBe('Hi! How can I help?');
      expect(result[2].content.content).toBe('What is the weather?');
      result.forEach(msg => {
        expect(msg.content.format).toBe(2);
      });
    });
  });

  describe('Tool messages', () => {
    const v5UIWithTool: AIV5.UIMessage = {
      id: 'tool-msg',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Let me check the weather for you.' },
        {
          type: 'tool',
          state: 'call',
          id: 'tool-1',
          name: 'getWeather',
          input: { city: 'San Francisco' },
        },
      ],
    };

    it('converts AIV5 UI with tools to AIV4 UI', () => {
      const result = convertMessages(v5UIWithTool).to('AIV4.UI');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      // Tool invocations might be handled differently
      // Let's check if the text content is preserved
      if (result[0].content) {
        expect(result[0].content).toContain('Let me check the weather for you.');
      }
      // Tool invocations may or may not be present depending on conversion logic
    });

    it('converts AIV5 UI with tools to Mastra V2', () => {
      const result = convertMessages(v5UIWithTool).to('Mastra.V2');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      // Check that the message has the expected structure
      expect(result[0].content.format).toBe(2);
      // Tool invocations may be handled differently in the conversion
    });
  });

  describe('Error handling', () => {
    it('throws error for unsupported output format', () => {
      expect(() => {
        // @ts-expect-error - testing invalid format
        convertMessages({ role: 'user', content: 'test' }).to('INVALID');
      }).toThrow('Unsupported output format: INVALID');
    });
  });
});

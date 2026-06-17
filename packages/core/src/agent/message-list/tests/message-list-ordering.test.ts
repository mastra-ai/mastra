import { describe, expect, it, vi } from 'vitest';
import { createSignal, mastraDBMessageToSignal } from '../../signals';
import type { MastraDBMessage } from '../../types';
import type { MessageListInput } from '../index';
import { MessageList } from '../index';

/**
 * Regression test for GitHub issue #10683
 * https://github.com/mastra-ai/mastra/issues/10683
 *
 * When messages have identical createdAt timestamps, the sort operation
 * should preserve the original input order (stable sort).
 */
describe('Message ordering with identical timestamps (Issue #10683)', () => {
  it('should preserve input order when messages have identical createdAt timestamps', () => {
    const timestamp = new Date('2024-01-01T12:00:00.000Z');

    // Create messages with identical timestamps
    const messages: MastraDBMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'First message' }] },
        createdAt: timestamp,
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Second message' }] },
        createdAt: timestamp,
      },
      {
        id: 'msg-3',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Third message' }] },
        createdAt: timestamp,
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Fourth message' }] },
        createdAt: timestamp,
      },
    ];

    const result = new MessageList().add(messages, 'memory').get.all.aiV5.ui();

    // The order should be preserved: msg-1, msg-2, msg-3, msg-4
    expect(result).toHaveLength(4);
    expect(result[0].id).toBe('msg-1');
    expect(result[1].id).toBe('msg-2');
    expect(result[2].id).toBe('msg-3');
    expect(result[3].id).toBe('msg-4');

    // Also verify the content order
    expect(result.map(m => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3', 'msg-4']);
  });

  it('should preserve order for many messages with identical timestamps (stress test)', () => {
    const timestamp = new Date('2024-01-01T12:00:00.000Z');
    const messageCount = 20;

    // Create many messages with identical timestamps
    const messages: MastraDBMessage[] = Array.from({ length: messageCount }, (_, i) => ({
      id: `msg-${i}`,
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: { format: 2 as const, parts: [{ type: 'text' as const, text: `Message ${i}` }] },
      createdAt: timestamp,
    }));

    // Run multiple times to catch non-deterministic behavior
    for (let run = 0; run < 10; run++) {
      const result = new MessageList().add(messages, 'memory').get.all.aiV5.ui();

      expect(result).toHaveLength(messageCount);
      for (let i = 0; i < messageCount; i++) {
        expect(result[i].id).toBe(`msg-${i}`);
      }
    }
  });

  it('should preserve order when using toAISdkV5Messages-style conversion', () => {
    const timestamp = new Date('2024-01-01T12:00:00.000Z');

    const messages: MastraDBMessage[] = [
      {
        id: 'first',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
        createdAt: timestamp,
      },
      {
        id: 'second',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Hi there!' }] },
        createdAt: timestamp,
      },
      {
        id: 'third',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'How are you?' }] },
        createdAt: timestamp,
      },
      {
        id: 'fourth',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: "I'm doing well!" }] },
        createdAt: timestamp,
      },
    ];

    // This mimics what toAISdkV5Messages does
    const result = new MessageList().add(messages, 'memory').get.all.aiV5.ui();

    // Verify exact order preservation
    expect(result.map(m => m.id)).toEqual(['first', 'second', 'third', 'fourth']);
  });

  it('should handle mixed timestamps correctly while preserving order for equal timestamps', () => {
    const time1 = new Date('2024-01-01T12:00:00.000Z');
    const time2 = new Date('2024-01-01T12:01:00.000Z');
    const time3 = new Date('2024-01-01T12:02:00.000Z');

    const messages: MastraDBMessage[] = [
      { id: 'a1', role: 'user', content: { format: 2, parts: [{ type: 'text', text: 'A1' }] }, createdAt: time1 },
      { id: 'a2', role: 'assistant', content: { format: 2, parts: [{ type: 'text', text: 'A2' }] }, createdAt: time1 },
      { id: 'b1', role: 'user', content: { format: 2, parts: [{ type: 'text', text: 'B1' }] }, createdAt: time2 },
      { id: 'b2', role: 'assistant', content: { format: 2, parts: [{ type: 'text', text: 'B2' }] }, createdAt: time2 },
      { id: 'c1', role: 'user', content: { format: 2, parts: [{ type: 'text', text: 'C1' }] }, createdAt: time3 },
    ];

    const result = new MessageList().add(messages, 'memory').get.all.aiV5.ui();

    // Messages should be in order: sorted by timestamp, then by original order for equal timestamps
    expect(result.map(m => m.id)).toEqual(['a1', 'a2', 'b1', 'b2', 'c1']);
  });

  /**
   * This is the EXACT reproduction case from issue #10683
   * https://github.com/DarkNoah/mastra-v5-messages
   *
   * Core messages WITHOUT createdAt fields should preserve their input order.
   * The bug is that aiV5ModelMessageToMastraDBMessage uses `new Date()` directly
   * instead of generateCreatedAt(), causing messages processed within the same
   * millisecond to get identical timestamps and then get shuffled by the sort.
   */
  it('should preserve order for Core messages without createdAt (exact reproduction from issue #10683)', () => {
    // Input messages in correct order - AI SDK V5 Core message format
    // Note: V5 uses 'input' for tool call args (not 'args')
    const messages: MessageListInput = [
      {
        role: 'system' as const,
        content: 'You are a helpful assistant.',
      },
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: 'hello',
          },
        ],
      },
      {
        role: 'assistant' as const,
        content: [
          {
            type: 'text' as const,
            text: 'Hello! How can I help you today?',
          },
        ],
      },
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: 'Use Bash to query the current time',
          },
        ],
      },
      {
        role: 'assistant' as const,
        content: [
          {
            type: 'text' as const,
            text: '\n',
          },
          {
            type: 'tool-call' as const,
            toolCallId: 'call_09fc29e47a164f1493ab0684',
            toolName: 'Bash',
            input: {
              command: 'date',
              description: 'Query the current system time',
            },
          },
        ],
      },
      {
        role: 'tool' as const,
        content: [
          {
            type: 'tool-result' as const,
            toolCallId: 'call_09fc29e47a164f1493ab0684',
            toolName: 'Bash',
            output: {
              type: 'text',
              value:
                'Command: date\nDirectory: (root)\nStdout: Mon Dec  1 11:19:20 CST 2025\n\nStderr: (empty)\nError: (none)\nExit Code: 0\nSignal: (none)\nProcess Group PGID: 72065',
            },
          },
        ],
      },
    ];

    // This is what toAISdkV5Messages does
    const result = new MessageList().add(messages, 'memory').get.all.aiV5.ui();

    // Expected order:
    // 1. user: "hello"
    // 2. assistant: "Hello! How can I help you today?"
    // 3. user: "Use Bash to query the current time"
    // 4. assistant with tool call
    // 5. assistant with tool result (tool messages become assistant messages in UI format)
    //
    // Note: system message is filtered out in UI format

    // Get the text content from each message for easier comparison
    const messageTexts = result.map(m => {
      const textPart = m.parts?.find((p: any) => p.type === 'text');
      return textPart ? (textPart as any).text : '[no text]';
    });

    // The first message should be "hello" (first user message)
    expect(messageTexts[0]).toBe('hello');

    // The second message should be "Hello! How can I help you today?" (first assistant response)
    expect(messageTexts[1]).toBe('Hello! How can I help you today?');

    // The third message should be "Use Bash to query the current time" (second user message)
    expect(messageTexts[2]).toBe('Use Bash to query the current time');

    // Verify role order as well
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('user');
  });

  /**
   * Simpler version of the reproduction - just user/assistant without tool calls
   */
  it('should preserve order for simple Core messages without createdAt', () => {
    const messages = [
      {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: 'First user message' }],
      },
      {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: 'First assistant response' }],
      },
      {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: 'Second user message' }],
      },
      {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: 'Second assistant response' }],
      },
    ];

    const result = new MessageList().add(messages, 'memory').get.all.aiV5.ui();

    expect(result).toHaveLength(4);

    // Verify exact order
    const texts = result.map(m => {
      const textPart = m.parts?.find((p: any) => p.type === 'text');
      return textPart ? (textPart as any).text : '';
    });

    expect(texts).toEqual([
      'First user message',
      'First assistant response',
      'Second user message',
      'Second assistant response',
    ]);
  });

  /**
   * Tests for when users DO provide createdAt timestamps
   * These should be preserved and messages should be sorted by them
   */
  describe('with user-provided createdAt timestamps', () => {
    it('should preserve user-provided createdAt for V5 Core messages with metadata.createdAt', () => {
      const time1 = new Date('2024-01-01T10:00:00.000Z');
      const time2 = new Date('2024-01-01T10:01:00.000Z');
      const time3 = new Date('2024-01-01T10:02:00.000Z');

      const messages = [
        {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'First message' }],
          metadata: { createdAt: time1 },
        },
        {
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: 'Second message' }],
          metadata: { createdAt: time2 },
        },
        {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'Third message' }],
          metadata: { createdAt: time3 },
        },
      ];

      const result = new MessageList().add(messages, 'memory').get.all.aiV5.ui();

      expect(result).toHaveLength(3);

      // Verify order is preserved based on provided timestamps
      const texts = result.map(m => {
        const textPart = m.parts?.find((p: any) => p.type === 'text');
        return textPart ? (textPart as any).text : '';
      });
      expect(texts).toEqual(['First message', 'Second message', 'Third message']);

      // Verify the timestamps are preserved in metadata (can be Date or string)
      expect(new Date((result[0].metadata as { createdAt?: string | Date })?.createdAt!).getTime()).toEqual(
        time1.getTime(),
      );
      expect(new Date((result[1].metadata as { createdAt?: string | Date })?.createdAt!).getTime()).toEqual(
        time2.getTime(),
      );
      expect(new Date((result[2].metadata as { createdAt?: string | Date })?.createdAt!).getTime()).toEqual(
        time3.getTime(),
      );
    });

    it('should sort messages correctly when user provides out-of-order timestamps via MastraDBMessage format', () => {
      const early = new Date('2024-01-01T09:00:00.000Z');
      const middle = new Date('2024-01-01T10:00:00.000Z');
      const late = new Date('2024-01-01T11:00:00.000Z');

      // MastraDBMessage format with createdAt - these WILL be sorted by timestamp
      const messages: MastraDBMessage[] = [
        {
          id: 'late',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Late message' }] },
          createdAt: late,
        },
        {
          id: 'early',
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Early message' }] },
          createdAt: early,
        },
        {
          id: 'middle',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Middle message' }] },
          createdAt: middle,
        },
      ];

      const result = new MessageList().add(messages, 'memory').get.all.aiV5.ui();

      // Messages should be sorted by their timestamps
      const texts = result.map(m => {
        const textPart = m.parts?.find((p: any) => p.type === 'text');
        return textPart ? (textPart as any).text : '';
      });
      expect(texts).toEqual(['Early message', 'Middle message', 'Late message']);
    });

    it('should handle mix of messages with and without createdAt', () => {
      const earlyTime = new Date('2024-01-01T08:00:00.000Z');

      // First message has a timestamp, rest don't
      const messages = [
        {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'Message with timestamp' }],
          metadata: { createdAt: earlyTime },
        },
        {
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: 'Message without timestamp 1' }],
        },
        {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'Message without timestamp 2' }],
        },
      ];

      const result = new MessageList().add(messages, 'memory').get.all.aiV5.ui();

      expect(result).toHaveLength(3);

      // First message should retain its early timestamp
      // Others should get generated timestamps that are later
      const texts = result.map(m => {
        const textPart = m.parts?.find((p: any) => p.type === 'text');
        return textPart ? (textPart as any).text : '';
      });

      // Order should be preserved since messages without timestamps get incrementing timestamps
      expect(texts).toEqual(['Message with timestamp', 'Message without timestamp 1', 'Message without timestamp 2']);
    });

    it('should not let signal prompt conversion advance generated timestamp state', () => {
      const signalTime = new Date('2999-01-01T09:00:00.000Z');
      const latestTime = new Date('2999-01-01T10:00:00.000Z');
      const list = new MessageList();

      list.add(
        [
          createSignal({
            id: 'signal-1',
            type: 'user-message',
            contents: 'Signal message',
            createdAt: signalTime,
          }).toDBMessage(),
          {
            id: 'assistant-latest',
            role: 'assistant' as const,
            content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'Latest assistant' }] },
            createdAt: latestTime,
          },
        ],
        'memory',
      );

      list.get.all.aiV5.prompt();
      list.add({ role: 'user', content: 'Generated timestamp after prompt conversion' }, 'input');

      const generatedMessage = list.get.all.db().at(-1);
      expect(generatedMessage?.createdAt.getTime()).toBe(latestTime.getTime() + 1);
    });

    it('should add signals after the current response while preserving acceptedAt', () => {
      const responseTime = new Date('2024-01-01T10:00:00.000Z');
      const signalTime = new Date('2024-01-01T09:00:00.000Z');
      const list = new MessageList();
      const signal = createSignal({
        id: 'signal-1',
        type: 'user-message',
        contents: 'Signal message',
        createdAt: signalTime,
      });

      list.add(
        {
          id: 'assistant-1',
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Response' }] },
          createdAt: responseTime,
        },
        'response',
      );

      const signalForTranscript = list.addSignal(signal);

      const storedSignal = list.get.all.db().at(-1)!;
      expect(signalForTranscript.createdAt.getTime()).toBeGreaterThan(responseTime.getTime());
      expect(signalForTranscript.acceptedAt).toEqual(signalTime);
      expect(storedSignal.createdAt).toEqual(signalForTranscript.createdAt);
      expect(storedSignal.content.metadata?.signal).toMatchObject({
        createdAt: signalForTranscript.createdAt.toISOString(),
        acceptedAt: signalTime.toISOString(),
      });
    });

    it('should normalize regular input signals using transcript timestamps', () => {
      const baseTime = Date.now() + 60_000;
      const responseTime = new Date(baseTime);
      const toolPartTime = baseTime + 5_000;
      const signalTime = new Date(baseTime + 2_000);
      const list = new MessageList();
      const signal = createSignal({
        id: 'regular-signal-after-tool-part',
        type: 'user-message',
        contents: 'Regular signal after tool output',
        createdAt: signalTime,
      });

      list.add(
        {
          id: 'assistant-with-tool-part-before-regular-signal',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Before tool output' },
              {
                type: 'tool-invocation',
                createdAt: toolPartTime,
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call-1',
                  toolName: 'gitStatus',
                  args: {},
                  result: '(no output)',
                },
              },
            ],
          },
          createdAt: responseTime,
        },
        'response',
      );
      list.add(signal, 'input');

      const storedSignal = list.get.all.db().at(-1)!;
      const recalledSignal = mastraDBMessageToSignal(storedSignal);
      expect(storedSignal.id).toBe(signal.id);
      expect(storedSignal.createdAt.getTime()).toBe(responseTime.getTime() + 1);
      expect(storedSignal.createdAt.getTime()).toBeLessThan(toolPartTime);
      expect(recalledSignal.createdAt).toEqual(storedSignal.createdAt);
      expect(recalledSignal.acceptedAt).toEqual(signalTime);
      expect(storedSignal.content.metadata?.signal).toMatchObject({
        createdAt: storedSignal.createdAt.toISOString(),
        acceptedAt: signalTime.toISOString(),
      });
    });

    it('should add signals after tool invocation updates', () => {
      const baseTime = Date.now() + 60_000;
      const responseTime = new Date(baseTime);
      const toolCallPartTime = baseTime + 1_000;
      const toolResultPartTime = baseTime + 5_000;
      const signalTime = new Date(baseTime + 2_000);
      const list = new MessageList();
      const signal = createSignal({
        id: 'signal-after-tool-part',
        type: 'user-message',
        contents: 'Signal after tool output',
        createdAt: signalTime,
      });

      list.add(
        {
          id: 'assistant-with-late-tool-part',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Before tool output' },
              {
                type: 'tool-invocation',
                createdAt: toolCallPartTime,
                toolInvocation: {
                  state: 'call',
                  toolCallId: 'call-1',
                  toolName: 'gitStatus',
                  args: {},
                },
              },
            ],
          },
          createdAt: responseTime,
        },
        'response',
      );

      vi.useFakeTimers();
      try {
        vi.setSystemTime(toolResultPartTime);
        list.updateToolInvocation({
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'call-1',
            toolName: 'gitStatus',
            args: {},
            result: '(no output)',
          },
        });
      } finally {
        vi.useRealTimers();
      }

      const signalForTranscript = list.addSignal(signal);

      expect(signalForTranscript.createdAt.getTime()).toBe(toolResultPartTime + 1);
      expect(signalForTranscript.acceptedAt).toEqual(signalTime);
      expect(list.get.all.db().map(message => message.id)).toEqual([
        'assistant-with-late-tool-part',
        'signal-after-tool-part',
      ]);
    });

    it('should preserve createdAt for V5 UI messages', () => {
      const time1 = new Date('2024-01-01T10:00:00.000Z');
      const time2 = new Date('2024-01-01T10:01:00.000Z');

      // V5 UI message format with createdAt at top level
      const messages = [
        {
          id: 'ui-msg-1',
          role: 'user' as const,
          createdAt: time1,
          parts: [{ type: 'text' as const, text: 'First UI message' }],
        },
        {
          id: 'ui-msg-2',
          role: 'assistant' as const,
          createdAt: time2,
          parts: [{ type: 'text' as const, text: 'Second UI message' }],
        },
      ];

      const result = new MessageList().add(messages, 'memory').get.all.aiV5.ui();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('ui-msg-1');
      expect(result[1].id).toBe('ui-msg-2');

      // Verify timestamps are preserved (metadata.createdAt can be Date or string)
      const createdAt1 = (result[0].metadata as { createdAt?: string | Date })?.createdAt;
      const createdAt2 = (result[1].metadata as { createdAt?: string | Date })?.createdAt;
      expect(new Date(createdAt1!).getTime()).toEqual(time1.getTime());
      expect(new Date(createdAt2!).getTime()).toEqual(time2.getTime());
    });

    it('should preserve historical response timestamps when part timestamps advance the watermark', () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

        const list = new MessageList();
        list.add(
          {
            id: 'user-1',
            role: 'user',
            content: { format: 2, content: 'Hello', parts: [{ type: 'text', text: 'Hello' }] },
            createdAt: new Date('2023-01-01T00:00:00.000Z'),
          },
          'memory',
        );
        list.add(
          {
            id: 'assistant-1',
            role: 'assistant',
            content: { format: 2, content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
            createdAt: new Date('2023-01-01T00:01:00.000Z'),
          },
          'memory',
        );
        list.add(
          {
            id: 'user-2',
            role: 'user',
            content: {
              format: 2,
              content: 'Next',
              parts: [{ type: 'text', text: 'Next', createdAt: new Date('2024-01-01T00:00:00.000Z').getTime() }],
            },
            createdAt: new Date('2023-01-01T00:02:00.000Z'),
          },
          'memory',
        );
        list.add(
          {
            id: 'assistant-2',
            role: 'assistant',
            content: { format: 2, content: 'Answer', parts: [{ type: 'text', text: 'Answer' }] },
            createdAt: new Date('2023-01-01T00:03:00.000Z'),
          },
          'response',
        );

        const messages = list.get.all.db();
        expect(messages.map(message => message.id)).toEqual(['user-1', 'assistant-1', 'user-2', 'assistant-2']);
        expect(messages.map(message => message.createdAt.toISOString())).toEqual([
          '2023-01-01T00:00:00.000Z',
          '2023-01-01T00:01:00.000Z',
          '2023-01-01T00:02:00.000Z',
          '2023-01-01T00:03:00.000Z',
        ]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should preserve order for V5 Core messages without timestamps', () => {
      // Even without any createdAt, order should be preserved
      const messages = [
        {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'First' }],
        },
        {
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: 'Second' }],
        },
        {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'Third' }],
        },
        {
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: 'Fourth' }],
        },
      ];

      const result = new MessageList().add(messages, 'memory').get.all.aiV5.ui();

      expect(result).toHaveLength(4);

      // Verify order is preserved
      const texts = result.map(m => {
        const textPart = m.parts?.find((p: any) => p.type === 'text');
        return textPart ? (textPart as any).text : '';
      });
      expect(texts).toEqual(['First', 'Second', 'Third', 'Fourth']);
    });
  });
});

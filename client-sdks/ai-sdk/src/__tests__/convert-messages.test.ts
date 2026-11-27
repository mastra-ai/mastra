import type { UIMessage as UIMessageV5 } from '@internal/ai-sdk-v5';
import type { UIMessage as UIMessageV6 } from '@internal/ai-v6';
import type { UIMessage as UIMessageV7 } from '@internal/ai-v7';
import type { MastraDBMessage } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent/message-list';
import type { MastraModelOutput } from '@mastra/core/stream';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { toAISdkMessages, toAISdkV4Messages, toAISdkV5Messages } from '../convert-messages';
import { toAISdkV5Stream } from '../convert-streams';

describe('toAISdkFormat', () => {
  const sampleMessages: MastraDBMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
      createdAt: new Date(),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: { format: 2, parts: [{ type: 'text', text: 'Hi there!' }] },
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

    it('should keep system reminders out of UI-facing v5 conversions', () => {
      const result = toAISdkV5Messages([
        {
          id: 'msg-reminder',
          role: 'user',
          content: {
            format: 2,
            parts: [{ type: 'text', text: '<system-reminder>continue</system-reminder>' }],
            metadata: {
              systemReminder: {
                type: 'anthropic-prefill-processor-retry',
              },
            },
          },
          createdAt: new Date(),
        },
      ]);

      expect(result).toEqual([]);
    });
  });

  describe('toAISdkMessages', () => {
    it('should default to AI SDK V5 UI message types', () => {
      const result = toAISdkMessages(sampleMessages);

      expectTypeOf(result).toEqualTypeOf<UIMessageV5[]>();
      expect(result).toEqual(toAISdkV5Messages(sampleMessages));
    });

    it('should support AI SDK V6 UI message types when version is v6', () => {
      const result = toAISdkMessages(sampleMessages, { version: 'v6' });

      expectTypeOf(result).toEqualTypeOf<UIMessageV6[]>();
      expect(result).toEqual(new MessageList().add(sampleMessages, 'memory').get.all.aiV6.ui());
    });

    it('should support AI SDK V7 UI message types when version is v7', () => {
      const result = toAISdkMessages(sampleMessages, { version: 'v7' });

      expectTypeOf(result).toEqualTypeOf<UIMessageV7[]>();
      expect(result).toEqual(new MessageList().add(sampleMessages, 'memory').get.all.aiV7.ui());
    });

    it('should produce the same messages for v6 and v7', () => {
      expect(toAISdkMessages(sampleMessages, { version: 'v7' })).toEqual(
        toAISdkMessages(sampleMessages, { version: 'v6' }),
      );
    });

    it('should handle empty arrays for all versions', () => {
      expect(toAISdkMessages([])).toEqual([]);
      expect(toAISdkMessages([], { version: 'v6' })).toEqual([]);
      expect(toAISdkMessages([], { version: 'v7' })).toEqual([]);
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

    it('should keep system reminders out of UI-facing v4 conversions', () => {
      const result = toAISdkV4Messages([
        {
          id: 'msg-reminder',
          role: 'user',
          content: {
            format: 2,
            parts: [{ type: 'text', text: '<system-reminder>continue</system-reminder>' }],
            metadata: {
              systemReminder: {
                type: 'anthropic-prefill-processor-retry',
              },
            },
          },
          createdAt: new Date(),
        },
      ]);

      expect(result).toEqual([]);
    });
  });

  describe('legacy system reminders without metadata', () => {
    const quoted = 'What does <system-reminder mean in the logs?';
    const userMessage = (parts: Array<{ type: 'text'; text: string }>) => ({
      id: 'msg-user',
      role: 'user' as const,
      content: { format: 2 as const, parts },
      createdAt: new Date(),
    });

    it('keeps user text that quotes a system-reminder tag in every version', () => {
      expect(toAISdkV4Messages(quoted)).toHaveLength(1);
      expect(toAISdkV5Messages(quoted)).toHaveLength(1);
      expect(toAISdkMessages(quoted, { version: 'v6' })).toHaveLength(1);
      expect(toAISdkMessages(quoted, { version: 'v7' })).toHaveLength(1);
    });

    it('keeps user text that starts with a quoted tag but is not a reminder element', () => {
      expect(toAISdkV5Messages('<system-reminder> shows up in my logs, what is it?')).toHaveLength(1);
      expect(toAISdkV5Messages('<system-reminder means what?</system-reminder>')).toHaveLength(1);
      expect(toAISdkV5Messages('<system-reminder/help</system-reminder>')).toHaveLength(1);
    });

    it('keeps a full reminder block pasted inside a longer user message', () => {
      const pasted = 'Why did the agent see this?\n<system-reminder>continue</system-reminder>';
      expect(toAISdkV5Messages([userMessage([{ type: 'text', text: pasted }])])).toHaveLength(1);
    });

    it('keeps user text placed between two reminder blocks', () => {
      for (const sandwiched of [
        '<system-reminder>A</system-reminder>\nWhy were these added?\n<system-reminder>B</system-reminder>',
        '<system-reminder>A</SYSTEM-REMINDER >\nWhy were these added?\n<system-reminder>B</system-reminder>',
      ]) {
        const messages = [userMessage([{ type: 'text', text: sandwiched }])];
        expect(toAISdkV4Messages(messages)).toHaveLength(1);
        expect(toAISdkV5Messages(messages)).toHaveLength(1);
        expect(toAISdkMessages(messages, { version: 'v6' })).toHaveLength(1);
        expect(toAISdkMessages(messages, { version: 'v7' })).toHaveLength(1);
      }
    });

    it('still hides a legacy reminder whose contents mention other or escaped tags', () => {
      for (const text of [
        '<system-reminder>see &lt;/system-reminder&gt; in docs</system-reminder>',
        '<system-reminder>close the </system-reminders> list</system-reminder>',
      ]) {
        expect(toAISdkV5Messages([userMessage([{ type: 'text', text }])])).toEqual([]);
      }
    });

    it('keeps user text whose wrapper is not the canonical lowercase reminder', () => {
      expect(toAISdkV5Messages('<SYSTEM-REMINDER>Is this valid?</SYSTEM-REMINDER>')).toHaveLength(1);
      expect(toAISdkV5Messages('<system-reminder>Is this valid?</SYSTEM-REMINDER >')).toHaveLength(1);
    });

    it('keeps a multi-part user message when only one part quotes the tag', () => {
      const result = toAISdkV5Messages([
        userMessage([
          { type: 'text', text: 'hello' },
          { type: 'text', text: quoted },
        ]),
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]!.parts.filter(part => part.type === 'text').map(part => part.text)).toEqual(['hello', quoted]);
    });

    it('still hides standalone legacy reminders that have no metadata', () => {
      const legacy = userMessage([
        { type: 'text', text: '<system-reminder type="dynamic-agents-md">ctx</system-reminder>\n' },
      ]);

      expect(toAISdkV4Messages([legacy])).toEqual([]);
      expect(toAISdkV5Messages([legacy])).toEqual([]);
      expect(toAISdkMessages([legacy], { version: 'v6' })).toEqual([]);
      expect(toAISdkMessages([legacy], { version: 'v7' })).toEqual([]);
    });

    it('still hides legacy reminders whose first text part is the wrapped reminder', () => {
      const legacy = userMessage([
        { type: 'text', text: '<system-reminder kind="walkthrough">Step one of the screen.</system-reminder>' },
        { type: 'text', text: 'Step two has this attachment.' },
      ]);

      expect(toAISdkV5Messages([legacy])).toEqual([]);
    });

    describe('first text part classification', () => {
      const hidden = [
        '<system-reminder />',
        '<system-reminder kind="reference-image" />',
        '<system-reminder a="1" b="x &amp; y" />',
        '<system-reminder>continue</system-reminder>',
        '<system-reminder type="dynamic-agents-md">ctx</system-reminder>',
        '<system-reminder a="1" b="&quot;q&quot;">ctx</system-reminder>',
        '<system-reminder>see &lt;/system-reminder&gt; in docs</system-reminder>',
        '<system-reminder>close the </system-reminders> list</system-reminder>',
        '<system-reminder>A<system-reminder>B</system-reminder>',
        '<system-reminder>ends with </system-reminder</system-reminder>',
        '<system-reminder a="x/&gt;y">ctx</system-reminder>',
        '<system-reminder a="x &quot;b=&quot;y">ctx</system-reminder>',
        '<system-reminder> </system-reminder>',
        '<system-reminder a="x a=">ctx</system-reminder>',
        '<system-reminder a="1" b="2" />',
        '  \n<system-reminder>continue</system-reminder>\n  ',
        '\t<system-reminder kind="x" />\n',
      ];
      const shown = [
        '<system-reminder /><system-reminder>B</system-reminder>',
        '<system-reminder />What is this?</system-reminder>',
        '<system-reminder /> and then my question',
        '<system-reminder/>',
        '<system-reminder></system-reminder>',
        '<system-reminder a="x&y" />',
        '<system-reminder a="1" a="2" />',
        '<system-reminder a="&copy;">x</system-reminder>',
        '<system-reminder>x</system-reminder',
        '<system-reminder kind="x" /><system-reminder />',
        '<system-reminder/>What?</system-reminder>',
        '<system-reminder>A</system-reminder> trailing question',
        '<system-reminder>A</system-reminder><system-reminder>B</system-reminder>',
        '<system-reminder>A</system-reminder>\nWhy were these added?\n<system-reminder>B</system-reminder>',
        '<system-reminder>A</SYSTEM-REMINDER >\nWhy were these added?\n<system-reminder>B</system-reminder>',
        '<system-reminder>A</system-reminder ><system-reminder>B</system-reminder>',
        '<SYSTEM-REMINDER>Is this valid?</SYSTEM-REMINDER>',
        '<System-Reminder />',
        '<system-reminder>Is this valid?</SYSTEM-REMINDER >',
        '<system-reminder> shows up in my logs, what is it?',
        '<system-reminder means what?</system-reminder>',
        '<system-reminder/help</system-reminder>',
        '<system-reminder / >',
        '<system-reminders>x</system-reminders>',
        '<system-reminder a=">">x</system-reminder>',
        '<system-reminder a="/>" />',
        "<system-reminder a='1'>x</system-reminder>",
        '<system-reminder a=1>x</system-reminder>',
        '<system-reminder  a="1">x</system-reminder>',
        '<system-reminder a="1"b="2">x</system-reminder>',
        '<system-reminder >x</system-reminder>',
        'What does <system-reminder mean in the logs?',
        'Why did the agent see this?\n<system-reminder>continue</system-reminder>',
      ];
      const convertAll = (text: string) =>
        [[userMessage([{ type: 'text', text }])], text].flatMap(messages => [
          toAISdkV4Messages(messages).length,
          toAISdkV5Messages(messages).length,
          toAISdkMessages(messages, { version: 'v6' }).length,
          toAISdkMessages(messages, { version: 'v7' }).length,
        ]);

      it.each(hidden)('hides %j in every version', text => {
        expect(convertAll(text)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      });

      it.each(shown)('keeps %j in every version', text => {
        expect(convertAll(text)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
      });
    });

    it('still hides file-only legacy reminders marked with a self-closing tag', () => {
      const legacy = {
        id: 'msg-reminder',
        role: 'user' as const,
        content: {
          format: 2 as const,
          parts: [
            { type: 'text' as const, text: '<system-reminder kind="reference-image" />' },
            { type: 'file' as const, data: 'data:image/png;base64,aGVsbG8=', mimeType: 'image/png' },
          ],
        },
        createdAt: new Date(),
      };

      expect(toAISdkV5Messages([legacy])).toEqual([]);
    });
  });

  describe('toAISdkV5Stream error handling', () => {
    it('should preserve error message details when converting agent stream', async () => {
      const errorMessage =
        'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits';
      const errorName = 'AI_APICallError';

      // Create a mock stream with error chunk
      const mockStream = new ReadableStream({
        async start(controller) {
          controller.enqueue({
            type: 'start',
            runId: 'test-run-id',
            payload: { id: 'test-id' },
          });

          controller.enqueue({
            type: 'error',
            runId: 'test-run-id',
            payload: {
              error: {
                message: errorMessage,
                name: errorName,
                stack: `${errorName}: ${errorMessage}\n    at someFunction (file.ts:10:5)`,
              },
            },
          });

          controller.close();
        },
      });

      const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, { from: 'agent' });

      const errorChunks: any[] = [];

      for await (const chunk of aiSdkStream) {
        if (chunk.type === 'error') {
          errorChunks.push(chunk);
          break;
        }
      }

      // Find the error chunk
      const errorChunk = errorChunks[0];

      expect(errorChunk).toBeDefined();
      expect(errorChunk.errorText).toBeDefined();
      expect(errorChunk.errorText).not.toBe('Error'); // Should not be the generic "Error" string
      expect(errorChunk.errorText).toContain(errorMessage); // Should contain the actual error message
    });
  });

  describe('toAISdkV5Stream tripwire handling', () => {
    it('should send finish event with finishReason "other" when tripwire occurs and stream does not exit gracefully', async () => {
      const tripwireReason = 'Content filter triggered';

      // Create a mock stream with tripwire chunk but no finish event
      const mockStream = new ReadableStream({
        async start(controller) {
          controller.enqueue({
            type: 'start',
            runId: 'test-run-id',
            payload: { id: 'test-id' },
          });

          controller.enqueue({
            type: 'tripwire',
            runId: 'test-run-id',
            payload: {
              reason: tripwireReason,
            },
          });

          // Stream closes without a finish event (ungraceful exit)
          controller.close();
        },
      });

      const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, {
        from: 'agent',
        sendFinish: true,
      });

      const chunks: any[] = [];
      let finishChunk: any = null;
      let tripwireChunk: any = null;

      for await (const chunk of aiSdkStream) {
        chunks.push(chunk);
        if (chunk.type === 'finish') {
          finishChunk = chunk;
        }
        if (chunk.type === 'data-tripwire') {
          tripwireChunk = chunk;
        }
      }

      // Verify tripwire chunk was received
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.type).toBe('data-tripwire');
      expect(tripwireChunk.data.reason).toBe(tripwireReason);

      // Verify finish event was sent with finishReason 'other'
      expect(finishChunk).toBeDefined();
      expect(finishChunk.type).toBe('finish');
      expect(finishChunk.finishReason).toBe('other');
    });

    it('should not send additional finish event if finish already occurred after tripwire', async () => {
      const tripwireReason = 'Content filter triggered';

      // Create a mock stream with tripwire chunk followed by finish event
      const mockStream = new ReadableStream({
        async start(controller) {
          controller.enqueue({
            type: 'start',
            runId: 'test-run-id',
            payload: { id: 'test-id' },
          });

          controller.enqueue({
            type: 'tripwire',
            runId: 'test-run-id',
            payload: {
              reason: tripwireReason,
            },
          });

          controller.enqueue({
            type: 'finish',
            runId: 'test-run-id',
            payload: {
              stepResult: {
                reason: 'stop',
              },
              output: {
                usage: {
                  inputTokens: 10,
                  outputTokens: 20,
                  totalTokens: 30,
                },
              },
            },
          });

          controller.close();
        },
      });

      const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, {
        from: 'agent',
        sendFinish: true,
      });

      const chunks: any[] = [];
      const finishChunks: any[] = [];

      for await (const chunk of aiSdkStream) {
        chunks.push(chunk);
        if (chunk.type === 'finish') {
          finishChunks.push(chunk);
        }
      }

      // Should only have one finish event (the original one, not an additional one)
      expect(finishChunks).toHaveLength(1);
    });
  });
});

describe('toAISdkMessages suspended tool rehydration', () => {
  const storedMessage = {
    id: 'msg-suspended',
    role: 'assistant',
    createdAt: new Date('2024-01-01'),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            toolCallId: 'tc-1',
            toolName: 'waitForInput',
            args: { question: 'Continue?' },
            state: 'call',
          },
        },
        { type: 'text', text: 'Waiting for input.' },
      ],
      metadata: {
        suspendedTools: {
          waitForInput: {
            toolCallId: 'tc-1',
            toolName: 'waitForInput',
            args: { question: 'Continue?' },
            type: 'suspension',
            runId: 'run-1',
            suspendPayload: { question: 'Continue?' },
            resumeSchema: '{"type":"object"}',
          },
        },
      },
    },
  } as MastraDBMessage;

  it.each(['v6', 'v7'] as const)('includes one data-tool-call-suspended part for %s', version => {
    const [message] = toAISdkMessages([storedMessage], { version });
    const suspended = message!.parts.filter(part => part.type === 'data-tool-call-suspended');
    expect(suspended).toHaveLength(1);
    expect(suspended[0]).toMatchObject({
      data: {
        toolCallId: 'tc-1',
        toolName: 'waitForInput',
        runId: 'run-1',
        suspendPayload: { question: 'Continue?' },
        resumeSchema: '{"type":"object"}',
      },
    });
  });
});

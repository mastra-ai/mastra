import type { TextPart } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { MessageList } from '../message-list';
import type { MastraMessageV2 } from '../message-list';
import { TripWire } from '../trip-wire';
import { runInputProcessors } from './runner';

// Helper function to create a MastraMessageV2
function createMessage(text: string, role: 'user' | 'assistant' = 'user'): MastraMessageV2 {
  return {
    id: crypto.randomUUID(),
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
    createdAt: new Date(),
  };
}

describe('runInputProcessors', () => {
  it('should run the input processors in order', async () => {
    const processors = [
      {
        name: 'processor1',
        process: async ({ messages }) => {
          messages.push(createMessage('extra message A'));
          return messages;
        },
      },
      {
        name: 'processor2',
        process: async ({ messages }) => {
          messages.push(createMessage('extra message B'));
          return messages;
        },
      },
    ];

    let messageList = new MessageList({
      threadId: '123',
      resourceId: '456',
    });

    messageList = await runInputProcessors(processors, messageList);

    expect(await messageList.get.all.prompt()).toEqual([
      {
        content: [
          {
            text: 'extra message A',
            type: 'text',
          },
        ],
        role: 'user',
      },
      {
        content: [
          {
            text: 'extra message B',
            type: 'text',
          },
        ],
        role: 'user',
      },
    ]);
  });

  it('should run processors sequentially in order', async () => {
    const executionOrder: string[] = [];

    const processors = [
      {
        name: 'processor1',
        process: async ({ messages }) => {
          executionOrder.push('processor1');
          messages.push(createMessage('extra message A'));
          return messages;
        },
      },
      {
        name: 'processor2',
        process: async ({ messages }) => {
          executionOrder.push('processor2');
          messages.push(createMessage('extra message B'));
          return messages;
        },
      },
    ];

    let messageList = new MessageList({
      threadId: '123',
      resourceId: '456',
    });

    messageList = await runInputProcessors(processors, messageList);

    // Verify execution order
    expect(executionOrder).toEqual(['processor1', 'processor2']);

    // Verify messages were added in order
    const allMessages = await messageList.get.all.prompt();
    expect(allMessages).toHaveLength(2);
    expect((allMessages[0].content[0] as TextPart).text).toBe('extra message A');
    expect((allMessages[1].content[0] as TextPart).text).toBe('extra message B');
  });

  it('should abort if tripwire is triggered', async () => {
    const processors = [
      {
        name: 'processor1',
        process: async ({ messages, abort }) => {
          messages.push(createMessage('before abort'));
          abort('bad message');
          return messages;
        },
      },
      {
        name: 'processor2',
        process: async ({ messages }) => {
          messages.push(createMessage('after abort - should not execute'));
          return messages;
        },
      },
    ];

    const messageList = new MessageList({
      threadId: '123',
      resourceId: '456',
    });

    await expect(runInputProcessors(processors, messageList)).rejects.toThrow(new TripWire('bad message'));
  });

  it('should abort with default message when no reason provided', async () => {
    const processors = [
      {
        name: 'processor1',
        process: async ({ abort, messages }) => {
          abort();
          return messages;
        },
      },
    ];

    const messageList = new MessageList({
      threadId: '123',
      resourceId: '456',
    });

    await expect(runInputProcessors(processors, messageList)).rejects.toThrow(
      new TripWire('Tripwire triggered by processor1'),
    );
  });

  it('should abort with custom reason', async () => {
    const processors = [
      {
        name: 'processor1',
        process: async ({ abort, messages }) => {
          abort('Custom abort reason');
          return messages;
        },
      },
    ];

    const messageList = new MessageList({
      threadId: '123',
      resourceId: '456',
    });

    await expect(runInputProcessors(processors, messageList)).rejects.toThrow(new TripWire('Custom abort reason'));
  });

  it('should not execute subsequent processors after tripwire', async () => {
    let secondProcessorExecuted = false;

    const processors = [
      {
        name: 'processor1',
        process: async ({ abort, messages }) => {
          abort('stopping here');
          return messages;
        },
      },
      {
        name: 'processor2',
        process: async ({ messages }) => {
          secondProcessorExecuted = true;
          messages.push(createMessage('should not be added'));
          return messages;
        },
      },
    ];

    const messageList = new MessageList({
      threadId: '123',
      resourceId: '456',
    });

    await expect(runInputProcessors(processors, messageList)).rejects.toThrow();
    expect(secondProcessorExecuted).toBe(false);
  });

  describe('telemetry integration', () => {
    it('should use telemetry.traceMethod for individual processors when telemetry is provided', async () => {
      const telemetryMock = {
        traceMethod: vi.fn((fn, _options) => fn),
      };

      const processors = [
        {
          name: 'test-processor-1',
          process: async ({ messages }) => {
            messages.push(createMessage('message from processor 1'));
            return messages;
          },
        },
        {
          name: 'test-processor-2',
          process: async ({ messages }) => {
            messages.push(createMessage('message from processor 2'));
            return messages;
          },
        },
      ];

      let messageList = new MessageList({
        threadId: '123',
        resourceId: '456',
      });

      messageList = await runInputProcessors(processors, messageList, telemetryMock);

      // Verify traceMethod was called for each processor
      expect(telemetryMock.traceMethod).toHaveBeenCalledTimes(2);

      // Verify the span names and attributes
      expect(telemetryMock.traceMethod).toHaveBeenNthCalledWith(1, expect.any(Function), {
        spanName: 'agent.inputProcessor.test-processor-1',
        attributes: {
          'processor.name': 'test-processor-1',
          'processor.index': '0',
          'processor.total': '2',
        },
      });

      expect(telemetryMock.traceMethod).toHaveBeenNthCalledWith(2, expect.any(Function), {
        spanName: 'agent.inputProcessor.test-processor-2',
        attributes: {
          'processor.name': 'test-processor-2',
          'processor.index': '1',
          'processor.total': '2',
        },
      });

      // Verify messages were processed correctly
      const result = await messageList.get.all.prompt();
      expect(result).toHaveLength(2);
      expect((result[0].content[0] as TextPart).text).toBe('message from processor 1');
      expect((result[1].content[0] as TextPart).text).toBe('message from processor 2');
    });

    it('should work without telemetry when not provided', async () => {
      const processors = [
        {
          name: 'no-telemetry-processor',
          process: async ({ messages }) => {
            messages.push(createMessage('message without telemetry'));
            return messages;
          },
        },
      ];

      let messageList = new MessageList({
        threadId: '123',
        resourceId: '456',
      });

      messageList = await runInputProcessors(processors, messageList);

      const result = await messageList.get.all.prompt();
      expect(result).toHaveLength(1);
      expect((result[0].content[0] as TextPart).text).toBe('message without telemetry');
    });

    it('should handle tripwire correctly with telemetry', async () => {
      const telemetryMock = {
        traceMethod: vi.fn((fn, _options) => fn),
      };

      const processors = [
        {
          name: 'tripwire-processor',
          process: async ({ abort, messages }) => {
            abort('telemetry tripwire test');
            return messages;
          },
        },
      ];

      const messageList = new MessageList({
        threadId: '123',
        resourceId: '456',
      });

      await expect(runInputProcessors(processors, messageList, telemetryMock)).rejects.toThrow(
        new TripWire('telemetry tripwire test'),
      );

      // Verify telemetry was still called even though processor aborted
      expect(telemetryMock.traceMethod).toHaveBeenCalledTimes(1);
    });
  });
});

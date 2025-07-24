import type { TextPart } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { MessageList } from '../message-list';
import { TripWire } from '../trip-wire';
import { runInputProcessors } from './runner';
import { createInputProcessor } from '.';

describe('runInputProcessors', () => {
  it('should run the input processors in order', async () => {
    const processors = [
      createInputProcessor('processor1', async ctx => {
        ctx.messages.add('extra message A', 'user');
      }),
      createInputProcessor('processor2', async ctx => {
        ctx.messages.add('extra message B', 'user');
      }),
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
    const processors = [
      createInputProcessor('processor1', async ctx => {
        ctx.messages.add('extra message A', 'user');
      }),
      createInputProcessor('processor2', async ctx => {
        await new Promise(resolve => setImmediate(resolve));
        ctx.messages.add('extra message B', 'user');
      }),
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

  it('should abort if tripwire is triggered', async () => {
    const processors = [
      createInputProcessor('processor1', async ctx => {
        ctx.messages.add('extra message A', 'user');
      }),
      createInputProcessor('processor2', async ctx => {
        ctx.abort('bad message');
      }),
    ];

    let messageList = new MessageList({
      threadId: '123',
      resourceId: '456',
    });

    await expect(runInputProcessors(processors, messageList)).rejects.toThrow(new TripWire('bad message'));
  });

  it('should abort with default message when no reason provided', async () => {
    const processors = [
      createInputProcessor('testProcessor', async ctx => {
        ctx.abort();
      }),
    ];

    let messageList = new MessageList({
      threadId: '123',
      resourceId: '456',
    });

    await expect(runInputProcessors(processors, messageList)).rejects.toThrow(
      new TripWire('Tripwire triggered by testProcessor'),
    );
  });

  it('should abort with custom reason', async () => {
    const processors = [
      createInputProcessor('customProcessor', async ctx => {
        ctx.abort('Custom abort reason');
      }),
    ];

    let messageList = new MessageList({
      threadId: '123',
      resourceId: '456',
    });

    await expect(runInputProcessors(processors, messageList)).rejects.toThrow(new TripWire('Custom abort reason'));
  });

  it('should not execute subsequent processors after tripwire', async () => {
    let executedProcessors: string[] = [];

    const processors = [
      createInputProcessor('processor1', async ctx => {
        executedProcessors.push('processor1');
      }),
      createInputProcessor('processor2', async ctx => {
        executedProcessors.push('processor2');
        ctx.abort('triggered');
      }),
      createInputProcessor('processor3', async ctx => {
        executedProcessors.push('processor3');
        ctx.messages.add('should not be added', 'user');
      }),
    ];

    let messageList = new MessageList({
      threadId: '123',
      resourceId: '456',
    });

    await expect(runInputProcessors(processors, messageList)).rejects.toThrow(TripWire);

    expect(executedProcessors).toEqual(['processor1', 'processor2']);
    expect(executedProcessors).not.toContain('processor3');
  });

  describe('telemetry integration', () => {
    it('should use telemetry.traceMethod for individual processors when telemetry is provided', async () => {
      const mockTraceMethod = vi.fn().mockImplementation((fn, _options) => {
        // Return a function that calls the original function
        return (data: any) => fn(data);
      });

      const mockTelemetry = {
        traceMethod: mockTraceMethod,
      };

      const processors = [
        createInputProcessor('test-processor-1', async ctx => {
          ctx.messages.add('message from processor 1', 'user');
        }),
        createInputProcessor('test-processor-2', async ctx => {
          ctx.messages.add('message from processor 2', 'user');
        }),
      ];

      let messageList = new MessageList({
        threadId: '123',
        resourceId: '456',
      });

      messageList = await runInputProcessors(processors, messageList, mockTelemetry);

      // Verify telemetry.traceMethod was called for each processor
      expect(mockTraceMethod).toHaveBeenCalledTimes(2);

      // Verify the first processor call
      expect(mockTraceMethod).toHaveBeenNthCalledWith(1, expect.any(Function), {
        spanName: 'agent.inputProcessor.test-processor-1',
        attributes: {
          'processor.name': 'test-processor-1',
          'processor.index': '0',
          'processor.total': '2',
        },
      });

      // Verify the second processor call
      expect(mockTraceMethod).toHaveBeenNthCalledWith(2, expect.any(Function), {
        spanName: 'agent.inputProcessor.test-processor-2',
        attributes: {
          'processor.name': 'test-processor-2',
          'processor.index': '1',
          'processor.total': '2',
        },
      });

      // Verify the messages were still processed correctly
      const result = await messageList.get.all.prompt();
      expect(result).toHaveLength(2);
      expect((result[0].content[0] as TextPart).text).toBe('message from processor 1');
      expect((result[1].content[0] as TextPart).text).toBe('message from processor 2');
    });

    it('should work without telemetry when not provided', async () => {
      const processors = [
        createInputProcessor('no-telemetry-processor', async ctx => {
          ctx.messages.add('message without telemetry', 'user');
        }),
      ];

      let messageList = new MessageList({
        threadId: '123',
        resourceId: '456',
      });

      // Should work fine without telemetry
      messageList = await runInputProcessors(processors, messageList, undefined);

      const result = await messageList.get.all.prompt();
      expect(result).toHaveLength(1);
      expect((result[0].content[0] as TextPart).text).toBe('message without telemetry');
    });

    it('should handle tripwire correctly with telemetry', async () => {
      const mockTraceMethod = vi.fn().mockImplementation((fn, _options) => {
        return (data: any) => fn(data);
      });

      const mockTelemetry = {
        traceMethod: mockTraceMethod,
      };

      const processors = [
        createInputProcessor('tripwire-processor', async ctx => {
          ctx.abort('telemetry tripwire test');
        }),
      ];

      let messageList = new MessageList({
        threadId: '123',
        resourceId: '456',
      });

      await expect(runInputProcessors(processors, messageList, mockTelemetry)).rejects.toThrow(TripWire);

      // Verify telemetry was still called even when processor aborted
      expect(mockTraceMethod).toHaveBeenCalledTimes(1);
      expect(mockTraceMethod).toHaveBeenCalledWith(expect.any(Function), {
        spanName: 'agent.inputProcessor.tripwire-processor',
        attributes: {
          'processor.name': 'tripwire-processor',
          'processor.index': '0',
          'processor.total': '1',
        },
      });
    });
  });
});

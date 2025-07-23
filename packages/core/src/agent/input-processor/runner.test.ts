import { describe, expect, it } from 'vitest';
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

  it('should wait for the next processor to be called', async () => {
    const processors = [
      createInputProcessor('processor1', async (ctx, next) => {
        await next();
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
            text: 'extra message B',
            type: 'text',
          },
        ],
        role: 'user',
      },
      {
        content: [
          {
            text: 'extra message A',
            type: 'text',
          },
        ],
        role: 'user',
      },
    ]);
  });

  it('should abort if tripwire is triggered', async () => {
    const processors = [
      createInputProcessor('processor1', async (ctx, next) => {
        await next();
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
      createInputProcessor('processor1', async (ctx, next) => {
        executedProcessors.push('processor1');
        await next();
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
});

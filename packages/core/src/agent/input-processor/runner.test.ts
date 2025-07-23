import { describe, expect, it } from 'vitest';
import { MessageList } from '../message-list';
import { TripWire } from '../trip-wire';
import { runInputProcessors } from './runner';
import { createInputProcessor } from '.';

describe('runInputProcessors', () => {
  it('should run the input processors in order', async () => {
    const processors = [
      createInputProcessor(ctx => {
        ctx.messages.add('extra message A', 'user');
      }),
      createInputProcessor(ctx => {
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
      createInputProcessor(async (ctx, next) => {
        await next();
        ctx.messages.add('extra message A', 'user');
      }),
      createInputProcessor(async ctx => {
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
      createInputProcessor(async (ctx, next) => {
        await next();
        ctx.messages.add('extra message A', 'user');
      }),
      createInputProcessor(async ctx => {
        ctx.abort('bad message');
      }),
    ];

    let messageList = new MessageList({
      threadId: '123',
      resourceId: '456',
    });

    expect(() => runInputProcessors(processors, messageList)).rejects.toThrow(new TripWire('bad message'));
  });
});

import { describe, expectTypeOf, it } from 'vitest';
import type { ThreadHistoryChunk, ThreadRunStatusChunk } from '../stream/types';
import type { Agent } from './agent';

declare const agent: Agent;
const target = { threadId: 'thread', resourceId: 'resource' };
type ChunkOf<T> = T extends { stream: AsyncIterable<infer C> } ? C : never;

describe('thread-history chunk typing', () => {
  it('is not part of a plain subscription or stream', async () => {
    const subscription = await agent.subscribeToThread(target);
    expectTypeOf<Extract<ChunkOf<typeof subscription>, ThreadHistoryChunk | ThreadRunStatusChunk>>().toBeNever();
    const output = await agent.stream('hello');
    expectTypeOf<Extract<ChunkOf<{ stream: typeof output.fullStream }>, { type: 'thread-history' }>>().toBeNever();
  });

  it('is part of a subscription that opts in', async () => {
    const withTrue = await agent.subscribeToThread({ ...target, withInitialHistory: true });
    expectTypeOf<Extract<ChunkOf<typeof withTrue>, ThreadHistoryChunk>>().toEqualTypeOf<ThreadHistoryChunk>();
    const withPage = await agent.subscribeToThread({ ...target, withInitialHistory: { perPage: 5 } });
    expectTypeOf<Extract<ChunkOf<typeof withPage>, ThreadHistoryChunk>>().toEqualTypeOf<ThreadHistoryChunk>();
  });

  it('includes status chunks only when opted in, independently of history', async () => {
    const history = await agent.subscribeToThread({ ...target, withInitialHistory: true });
    expectTypeOf<Extract<ChunkOf<typeof history>, ThreadRunStatusChunk>>().toBeNever();
    const disabled = await agent.subscribeToThread({ ...target, withInitialHistory: true, withRunStatus: false });
    expectTypeOf<Extract<ChunkOf<typeof disabled>, ThreadRunStatusChunk>>().toBeNever();
    const status = await agent.subscribeToThread({ ...target, withRunStatus: true });
    expectTypeOf<Extract<ChunkOf<typeof status>, ThreadRunStatusChunk>>().toEqualTypeOf<ThreadRunStatusChunk>();
    expectTypeOf<Extract<ChunkOf<typeof status>, ThreadHistoryChunk>>().toBeNever();
    const both = await agent.subscribeToThread({ ...target, withInitialHistory: true, withRunStatus: true });
    expectTypeOf<Extract<ChunkOf<typeof both>, ThreadHistoryChunk>>().toEqualTypeOf<ThreadHistoryChunk>();
    expectTypeOf<Extract<ChunkOf<typeof both>, ThreadRunStatusChunk>>().toEqualTypeOf<ThreadRunStatusChunk>();
    const runtime = await agent.subscribeToThread({
      ...target,
      withInitialHistory: true,
      withRunStatus: Math.random() > 0.5,
    });
    expectTypeOf<Extract<ChunkOf<typeof runtime>, ThreadRunStatusChunk>>().toEqualTypeOf<ThreadRunStatusChunk>();
  });

  it('is possible when the option is only known at runtime', async () => {
    const enabled = Math.random() > 0.5;
    const subscription = await agent.subscribeToThread({ ...target, withInitialHistory: enabled });
    expectTypeOf<Extract<ChunkOf<typeof subscription>, ThreadHistoryChunk>>().toEqualTypeOf<ThreadHistoryChunk>();
  });
});

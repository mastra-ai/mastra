import { describe, expectTypeOf, it } from 'vitest';
import type { ThreadHistoryChunk } from '../stream/types';
import type { Agent } from './agent';

declare const agent: Agent;
const target = { threadId: 'thread', resourceId: 'resource' };
type ChunkOf<T> = T extends { stream: AsyncIterable<infer C> } ? C : never;

describe('thread-history chunk typing', () => {
  it('is not part of a plain subscription or stream', async () => {
    const subscription = await agent.subscribeToThread(target);
    expectTypeOf<Extract<ChunkOf<typeof subscription>, ThreadHistoryChunk>>().toBeNever();
    const output = await agent.stream('hello');
    expectTypeOf<Extract<ChunkOf<{ stream: typeof output.fullStream }>, { type: 'thread-history' }>>().toBeNever();
  });

  it('is part of a subscription that opts in', async () => {
    const withTrue = await agent.subscribeToThread({ ...target, withInitialHistory: true });
    expectTypeOf<Extract<ChunkOf<typeof withTrue>, ThreadHistoryChunk>>().toEqualTypeOf<ThreadHistoryChunk>();
    const withPage = await agent.subscribeToThread({ ...target, withInitialHistory: { perPage: 5 } });
    expectTypeOf<Extract<ChunkOf<typeof withPage>, ThreadHistoryChunk>>().toEqualTypeOf<ThreadHistoryChunk>();
  });

  it('is possible when the option is only known at runtime', async () => {
    const enabled = Math.random() > 0.5;
    const subscription = await agent.subscribeToThread({ ...target, withInitialHistory: enabled });
    expectTypeOf<Extract<ChunkOf<typeof subscription>, ThreadHistoryChunk>>().toEqualTypeOf<ThreadHistoryChunk>();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { normalizeBehavior } from '../definition/normalize.js';
import { InMemoryBehaviorRuntimeStore } from '../runtime/in-memory-store.js';
import { BehaviorTransitionEngine } from '../runtime/transition-engine.js';
import { BehaviorIntentPolicyProcessor } from './intent-policy.js';

const definition = normalizeBehavior({
  id: 'coding',
  version: '1',
  initialState: 'understand',
  states: [
    {
      id: 'understand',
      tools: ['read'],
      transitions: [{ id: 'implement', target: 'implement' }],
    },
    {
      id: 'implement',
      tools: ['write'],
      transitions: [{ id: 'back', target: 'understand' }],
    },
  ],
});

const setup = async () => {
  const store = new InMemoryBehaviorRuntimeStore();
  await store.init();
  const engine = new BehaviorTransitionEngine({ definition, store });
  await engine.initialize('thread');
  const judgeIntent = vi.fn(async ({ intent }: { intent: string }) => ({ approved: intent === 'inspect code' }));
  const processor = new BehaviorIntentPolicyProcessor({ definition, store, judgeIntent });
  const execute = vi.fn(async (input: unknown) => input);
  const tool = { inputSchema: z.object({ path: z.string() }), execute };
  const result = await processor.processInputStep({ tools: { read: tool } } as never);
  const wrapped = result.tools!.read as typeof tool & {
    execute(input: Record<string, unknown>, context?: unknown): Promise<unknown>;
  };
  return { store, engine, processor, judgeIntent, execute, tool, wrapped };
};

describe('BehaviorIntentPolicyProcessor', () => {
  it('memoizes wrappers and keeps their schema stable across transitions', async () => {
    const { processor, engine, tool, wrapped } = await setup();
    const second = await processor.processInputStep({ tools: { read: tool } } as never);
    expect(second.tools!.read).toBe(wrapped);
    const schemaBefore = JSON.stringify((wrapped.inputSchema as z.ZodType).toJSONSchema());
    await engine.transition({ threadId: 'thread', name: 'implement', idempotencyKey: 'move' });
    const third = await processor.processInputStep({ tools: { read: tool } } as never);
    expect(third.tools!.read).toBe(wrapped);
    expect(JSON.stringify((wrapped.inputSchema as z.ZodType).toJSONSchema())).toBe(schemaBefore);
  });

  it('requires matching state intent and strips intent before execution', async () => {
    const { wrapped, execute } = await setup();
    await expect(wrapped.execute({ path: 'x' }, { threadId: 'thread' })).rejects.toThrow('requires an intent');
    await expect(wrapped.execute({ path: 'x', intent: 'wrong' }, { threadId: 'thread' })).rejects.toThrow('rejected');
    await expect(wrapped.execute({ path: 'x', intent: 'understand' }, { threadId: 'thread' })).resolves.toEqual({ path: 'x' });
    expect(execute).toHaveBeenCalledWith({ path: 'x' }, { threadId: 'thread' });
  });

  it('supports judged freeform intent and rejects stale intent after a transition', async () => {
    const { wrapped, engine, judgeIntent } = await setup();
    await expect(wrapped.execute({ path: 'x', intent: 'inspect code' }, { threadId: 'thread' })).resolves.toEqual({ path: 'x' });
    expect(judgeIntent).toHaveBeenCalledOnce();
    await engine.transition({ threadId: 'thread', name: 'implement', idempotencyKey: 'move' });
    await expect(wrapped.execute({ path: 'x', intent: 'understand' }, { threadId: 'thread' })).rejects.toThrow('not allowed');
  });

  it('aborts missing output intent before execution', async () => {
    const { processor } = await setup();
    const abort = vi.fn(() => {
      throw new Error('retry');
    });
    await expect(
      processor.processOutputStep({ toolCalls: [{ toolName: 'read', toolCallId: '1', args: {} }], abort } as never),
    ).rejects.toThrow('retry');
    expect(abort).toHaveBeenCalledWith('Tool "read" requires an intent', { retry: true });
  });
});

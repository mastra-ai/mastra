import { setImmediate } from 'node:timers/promises';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

// The unit project exposes GC to exercise V8's real reachability.
describe('idle Session retention (#28230)', () => {
  it('releases finished run contexts while keeping the session usable', async () => {
    expect(globalThis.gc).toBeTypeOf('function');
    const contexts: WeakRef<object>[] = [];
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a test agent.',
      inputProcessors: [
        {
          id: 'capture-run-context',
          processInput: ({ messages, requestContext, state }) => {
            if (!requestContext) throw new Error('Expected a run context');
            // Session consumers copy context entries; track the per-run payload
            // so both the original and copied contexts must release it.
            requestContext.set('retention-probe', state);
            contexts.push(new WeakRef(state));
            return messages;
          },
        },
      ],
      model: new MockLanguageModelV2({
        doStream: async () => ({
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        }),
      }),
    });
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'session', ownerId: 'owner', createInitialThread: true });
    try {
      for (let turn = 0; turn < 2; turn++) {
        const ended = new Promise<void>(resolve => {
          const unsubscribe = session.subscribe(event => {
            if (event.type === 'agent_end') {
              unsubscribe();
              resolve();
            }
          });
        });
        await session.sendMessage({ content: `message ${turn}` });
        await ended;
        // A WeakRef target is kept alive until the end of its current job. Never
        // dereference between collections, and let stream teardown finish first.
        for (let attempt = 0; attempt < 10; attempt++) {
          await setImmediate();
          globalThis.gc?.();
        }
        expect(contexts).toHaveLength(turn + 1);
        expect(contexts.map(context => context.deref())).toEqual(contexts.map(() => undefined));
      }
    } finally {
      await controller.deleteSession({ sessionId: session.id });
      await controller.destroy();
    }
  });
});

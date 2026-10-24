import { setImmediate } from 'node:timers/promises';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

// The changed-test gate uses the base branch's Vitest config, without --expose-gc.
// Enable real GC there too so the gate fails on retention, not missing test setup.
function getGarbageCollector(): () => void {
  if (globalThis.gc) return globalThis.gc;
  setFlagsFromString('--expose-gc');
  const gc: unknown = runInNewContext('gc');
  setFlagsFromString('--no-expose-gc');
  if (typeof gc !== 'function') throw new Error('Expected V8 garbage collection to be available');
  return () => gc();
}

describe('idle Session retention (#28230)', () => {
  it('releases finished run contexts while keeping the session usable', async () => {
    const collectGarbage = getGarbageCollector();
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
          collectGarbage();
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

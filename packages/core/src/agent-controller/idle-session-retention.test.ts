/**
 * An idle Session stays subscribed to its thread between turns. Once a turn
 * finishes, nothing from that run (output, tools, processor state, request
 * context) may stay reachable through the subscription loops (#28230).
 */
import { setImmediate } from 'node:timers/promises';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it } from 'vitest';

import { Agent } from '../agent';
import { useLoopScenarioAimock } from '../loop/test-utils/aimock/aimock-scenario';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

const getMock = useLoopScenarioAimock();

function getGarbageCollector(): () => void {
  if (globalThis.gc) return globalThis.gc;
  setFlagsFromString('--expose-gc');
  const gc: unknown = runInNewContext('gc');
  setFlagsFromString('--no-expose-gc');
  if (typeof gc !== 'function') throw new Error('Expected V8 garbage collection to be available');
  return () => gc();
}

describe('idle Session retention (#28230)', () => {
  it('releases each finished run while the Session stays subscribed and usable', async () => {
    const collectGarbage = getGarbageCollector();
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'Hello' });
    const runState: WeakRef<object>[] = [];
    const agent = new Agent({
      id: 'retention-agent',
      name: 'retention-agent',
      instructions: 'test',
      model: createOpenAI({ apiKey: 'aimock', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })('gpt-4o-mini'),
      inputProcessors: [
        {
          id: 'capture-run-state',
          processInput: ({ messages, requestContext, state }) => {
            if (!requestContext) throw new Error('Expected a run request context');
            // Session consumers copy context entries, so the per-run payload is
            // only collectable once both the original and the copy are released.
            requestContext.set('retention-probe', state);
            runState.push(new WeakRef(state));
            return messages;
          },
        },
      ],
    });
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'retention-controller',
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
        // A WeakRef target survives until the end of the job that created or
        // dereferenced it, so collect across several turns of the event loop.
        for (let attempt = 0; attempt < 10; attempt++) {
          await setImmediate();
          collectGarbage();
        }
        expect(runState).toHaveLength(turn + 1);
        expect(runState.map(ref => ref.deref())).toEqual(runState.map(() => undefined));
      }
      expect(llm.getRequests()).toHaveLength(2);
    } finally {
      await controller.deleteSession({ sessionId: session.id });
      await controller.destroy();
    }
  });
});

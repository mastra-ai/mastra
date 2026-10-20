import { createOpenAI } from '@ai-sdk/openai-v5';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent, AGENT_RESUME_CLAIM_STALE_MS } from '../../../../agent/agent';
import { Mastra } from '../../../../mastra';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import { useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * A resume claim held by a process that died must not block the suspension forever (#27366),
 * and a claim held by a live process must still not be taken over (#26133).
 *
 * Two Mastra instances share one store, like two server processes. Worker A resumes and is
 * inside the resumed tool when it "dies": every store call it makes from then on hangs, so
 * it neither renews nor releases its claim. Worker B resumes the same run afterwards.
 */
describe('AIMock loop scenario: resume claim after the claimant dies', () => {
  const getMock = useLoopScenarioAimock();

  afterEach(() => {
    vi.useRealTimers();
  });

  function createWorker(storage: InMemoryStore, name: string, runResumedTool: () => Promise<void>) {
    let dead = false;
    const executions: string[] = [];
    // The process's view of the shared store; once dead, its calls never complete.
    const processStorage = new Proxy(storage, {
      get(target, prop) {
        if (prop === 'getStore') {
          return async (domain: string) => {
            const store = await target.getStore(domain as any);
            if (domain !== 'workflows' || !store) return store;
            return new Proxy(store, {
              get(storeTarget, storeProp) {
                const value = Reflect.get(storeTarget, storeProp, storeTarget);
                if (typeof value !== 'function') return value;
                return (...args: unknown[]) => (dead ? new Promise(() => {}) : value.apply(storeTarget, args));
              },
            });
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url.replace(/\/+$/, '')}/v1` });
    const agent = new Agent({
      id: 'find-user-agent',
      name: 'Find User Agent',
      instructions: 'You find users.',
      model: openai(SCENARIO_MODEL_ID),
      tools: {
        findUser: createTool({
          id: 'find-user',
          description: 'Finds a user by name',
          inputSchema: z.object({ query: z.string() }),
          suspendSchema: z.object({ message: z.string() }),
          resumeSchema: z.object({ name: z.string() }),
          execute: async (_input, context) => {
            if (!context?.agent?.resumeData) {
              return context?.agent?.suspend({ message: 'Which user?' });
            }
            executions.push(name);
            await runResumedTool();
            return { name: context.agent.resumeData.name };
          },
        }),
      },
    });
    const mastra = new Mastra({ agents: { agent }, logger: false, storage: processStorage as InMemoryStore });

    return {
      agent: mastra.getAgent('agent'),
      executions,
      die: () => {
        dead = true;
      },
    };
  }

  async function setup() {
    getMock().on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [{ id: 'call-1', name: 'find-user', arguments: { query: 'Ada' } }],
      },
    );
    getMock().on({ endpoint: 'chat', hasToolResult: true }, { content: 'Found Ada.' });

    const storage = new InMemoryStore();
    let enteredA!: () => void;
    const aEntered = new Promise<void>(resolve => (enteredA = resolve));
    let finishA!: () => void;
    const aFinished = new Promise<void>(resolve => (finishA = resolve));
    const workerA = createWorker(storage, 'A', () => {
      enteredA();
      return aFinished;
    });
    const workerB = createWorker(storage, 'B', async () => {});

    const suspended = await workerA.agent.generate('Find the user Ada');
    expect(suspended.finishReason).toBe('suspended');
    const runId = suspended.runId!;

    // Fake only the clock and the claim renewal interval, so the test can jump past the stale
    // window. The clock still advances with real time, so resume's own snapshot polling and
    // aimock's HTTP traffic behave normally.
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], shouldAdvanceTime: true });
    const resumeA = workerA.agent.resumeGenerate({ name: 'Ada' }, { runId });
    resumeA.catch(() => {});
    await aEntered;

    return { runId, workerA, workerB, resumeA, finishA };
  }

  it('lets a later resume take over the claim of a resume whose process died', async () => {
    const { runId, workerA, workerB } = await setup();

    workerA.die();
    await vi.advanceTimersByTimeAsync(AGENT_RESUME_CLAIM_STALE_MS + 1);

    const resumed = await workerB.agent.resumeGenerate({ name: 'Ada' }, { runId });

    expect(resumed.text).toBe('Found Ada.');
    expect(workerB.executions).toEqual(['B']);
  }, 30_000);

  it('still rejects a resume while the first resume is alive past the stale window', async () => {
    const { runId, workerA, workerB, resumeA, finishA } = await setup();

    await vi.advanceTimersByTimeAsync(AGENT_RESUME_CLAIM_STALE_MS * 2);

    await expect(workerB.agent.resumeGenerate({ name: 'Ada' }, { runId })).rejects.toMatchObject({
      id: 'AGENT_RESUME_ALREADY_CLAIMED',
    });
    expect(workerB.executions).toEqual([]);

    finishA();
    const resumed = await resumeA;
    expect(resumed.text).toBe('Found Ada.');
    expect(workerA.executions).toEqual(['A']);
  }, 30_000);
});

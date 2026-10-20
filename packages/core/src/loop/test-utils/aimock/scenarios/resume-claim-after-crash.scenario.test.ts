import { createOpenAI } from '@ai-sdk/openai-v5';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent, AGENT_RESUME_CLAIM_STALE_MS } from '../../../../agent/agent';
import { Mastra } from '../../../../mastra';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import { useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';
import { Agent as MainAgent } from '../../../../agent/agent-main';

type HoldWrite = (method: string, args: any, phase: 'before' | 'after') => Promise<void> | undefined;

// WIP handoff: EXPLORE_STORE=libsql|pg runs against built store dists with a real clock (pair with
// EXPLORE_RESUME_CLAIM_STALE_MS, e.g. 2000). EXPLORE_STORES_DIR points at a checkout with built stores.
const STORE = process.env.EXPLORE_STORE ?? 'memory';
const STORES_DIR = process.env.EXPLORE_STORES_DIR ?? new URL('../../../../../../../stores', import.meta.url).pathname;
const DB_DIR = process.env.EXPLORE_DB_DIR ?? '/tmp';
const REAL_CLOCK = STORE !== 'memory' || process.env.EXPLORE_REAL_CLOCK === '1';
async function createStorage(): Promise<any> {
  const id = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (STORE === 'libsql') {
    const { LibSQLStore } = await import(`${STORES_DIR}/libsql/dist/index.js`);
    const store = new LibSQLStore({ id, url: `file:${DB_DIR}/${id}.db` });
    await store.init();
    return store;
  }
  if (STORE === 'pg') {
    const { PostgresStore } = await import(`${STORES_DIR}/pg/dist/index.js`);
    const store = new PostgresStore({
      id,
      connectionString: 'postgresql://postgres:postgres@127.0.0.1:5434/postgres?sslmode=disable',
      schemaName: id.replace(/-/g, '_'),
      max: 1,
    });
    await store.init();
    return store;
  }
  return new InMemoryStore();
}
const advance = (ms: number) =>
  REAL_CLOCK ? new Promise<void>(r => setTimeout(r, ms)) : vi.advanceTimersByTimeAsync(ms).then(() => {});
const outcome = (resume: Promise<{ text: string }>) =>
  resume.then(
    r => r.text,
    (e: { id?: string }) => e?.id ?? String(e),
  );

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
}

/**
 * A resume claim held by a process that died must not block the suspension forever (#27366),
 * and a claim held by a live process must still not be taken over (#26133).
 *
 * Mastra instances share one store, like server processes. Worker A resumes and is inside the
 * resumed tool when it "dies": every store call it makes from then on hangs, so it neither renews
 * nor releases its claim. Other workers resume the same run afterwards.
 *
 * The in-memory store supports run fencing. A worker created with `fencing: false` sees a store
 * without it, which is also how a process running the code from before run-fencing leases behaves:
 * it never takes over a `running` claim.
 */
describe('AIMock loop scenario: resume claim after the claimant dies', () => {
  const getMock = useLoopScenarioAimock();

  afterEach(() => {
    vi.useRealTimers();
  });

  function createWorker(
    storage: InMemoryStore,
    name: string,
    runResumedTool: () => Promise<void>,
    options: {
      fencing?: boolean;
      agentClass?: any;
      // Holds one of this process's store calls before it reaches the store or before its result
      // comes back, to model a slow store call.
      holdWrite?: HoldWrite;
    } = {},
  ) {
    let dead = false;
    const executions: string[] = [];
    const calls: string[] = [];
    // The process's view of the shared store; once dead, its calls never complete.
    const processStorage = new Proxy(storage, {
      get(target, prop) {
        if (prop === 'getStore') {
          return async (domain: string) => {
            const store = await target.getStore(domain as any);
            if (domain !== 'workflows' || !store) return store;
            return new Proxy(store, {
              get(storeTarget, storeProp) {
                if (storeProp === 'supportsRunFencing' && options.fencing === false) return () => false;
                const value = Reflect.get(storeTarget, storeProp, storeTarget);
                if (typeof value !== 'function') return value;
                return (...args: any[]) => {
                  const method = String(storeProp);
                  calls.push(method);
                  if (dead) return new Promise(() => {});
                  const hold = options.holdWrite;
                  if (!hold) return value.apply(storeTarget, args);
                  return (async () => {
                    await hold(method, args[0], 'before');
                    const result = await value.apply(storeTarget, args);
                    await hold(method, args[0], 'after');
                    return result;
                  })();
                };
              },
            });
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url.replace(/\/+$/, '')}/v1` });
    const AgentCtor = options.agentClass ?? Agent;
    const agent = new AgentCtor({
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
    const mastra = new Mastra({ agents: { agent }, logger: false, storage: processStorage });

    return {
      agent: mastra.getAgent('agent'),
      executions,
      calls,
      die: () => {
        dead = true;
      },
    };
  }

  async function setup(options: { fencing?: boolean; agentClass?: any } = {}) {
    getMock().on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [{ id: 'call-1', name: 'find-user', arguments: { query: 'Ada' } }],
      },
    );
    getMock().on({ endpoint: 'chat', hasToolResult: true }, { content: 'Found Ada.' });

    const storage = await createStorage();
    const aEntered = deferred();
    const aFinish = deferred();
    const workerA = createWorker(
      storage,
      'A',
      () => {
        aEntered.resolve();
        return aFinish.promise;
      },
      options,
    );

    const suspended = await workerA.agent.generate('Find the user Ada');
    expect(suspended.finishReason).toBe('suspended');
    const runId = suspended.runId!;

    // Fake only the clock and the claim renewal interval, so the test can jump past the stale
    // window. The clock still advances with real time, so resume's own snapshot polling and
    // aimock's HTTP traffic behave normally.
    if (!REAL_CLOCK) vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], shouldAdvanceTime: true });
    const resumeA = workerA.agent.resumeGenerate({ name: 'Ada' }, { runId });
    resumeA.catch(() => {});
    await aEntered.promise;

    return { storage, runId, workerA, resumeA, finishA: aFinish.resolve };
  }

  it('lets a later resume take over the claim of a resume whose process died', async () => {
    const { storage, runId, workerA } = await setup();
    const workerB = createWorker(storage, 'B', async () => {});

    workerA.die();
    await advance(AGENT_RESUME_CLAIM_STALE_MS + 1);

    const resumed = await workerB.agent.resumeGenerate({ name: 'Ada' }, { runId });

    expect(resumed.text).toBe('Found Ada.');
    expect(workerB.executions).toEqual(['B']);
  }, 30_000);

  it('still rejects a resume while the first resume is alive past the stale window', async () => {
    const { storage, runId, workerA, resumeA, finishA } = await setup();
    const workerB = createWorker(storage, 'B', async () => {});

    await advance(AGENT_RESUME_CLAIM_STALE_MS * 2);

    await expect(workerB.agent.resumeGenerate({ name: 'Ada' }, { runId })).rejects.toMatchObject({
      id: 'AGENT_RESUME_ALREADY_CLAIMED',
    });
    expect(workerB.executions).toEqual([]);

    finishA();
    const resumed = await resumeA;
    expect(resumed.text).toBe('Found Ada.');
    expect(workerA.executions).toEqual(['A']);
  }, 30_000);

  it('lets exactly one of many concurrent resumes take over a dead claim', async () => {
    const { storage, runId, workerA } = await setup();
    const takers = Array.from({ length: 6 }, (_, i) => createWorker(storage, `T${i}`, async () => {}));

    workerA.die();
    await advance(AGENT_RESUME_CLAIM_STALE_MS + 1);

    const outcomes = await Promise.all(takers.map(t => outcome(t.agent.resumeGenerate({ name: 'Ada' }, { runId }))));

    expect(outcomes.filter(o => o === 'Found Ada.')).toHaveLength(1);
    expect(outcomes.filter(o => o !== 'Found Ada.')).toEqual(Array(5).fill('AGENT_RESUME_ALREADY_CLAIMED'));
    expect(takers.flatMap(t => t.executions)).toHaveLength(1);
  }, 30_000);

  /**
   * A dies. C reads A's lapsed claim, but its first write acting on it (taking the claim over) is
   * slow to reach the store. Meanwhile B takes the claim over and runs the tool. Returns once C's
   * write has landed and before its result reaches C.
   */
  async function raceTwoTakers(cls: { C?: any; F?: any } = {}) {
    const { storage, runId, workerA } = await setup();
    const cTakeoverSent = deferred();
    const cTakeoverArrive = deferred();
    const cTakeoverLanded = deferred();
    const cTakeoverReturn = deferred();
    const workerC = createWorker(storage, 'C', async () => {}, {
      agentClass: cls.C,
      holdWrite: (method, args, phase) => {
        // A lease takeover, or a status-only hand-back of a running claim.
        const takesOver =
          (method === 'claimRunOwnership' && !args.force) ||
          (method === 'updateWorkflowState' &&
            args.opts.status === 'suspended' &&
            args.opts.expectedStatus === 'running');
        if (!takesOver) return undefined;
        if (phase === 'before') {
          cTakeoverSent.resolve();
          return cTakeoverArrive.promise;
        }
        cTakeoverLanded.resolve();
        return cTakeoverReturn.promise;
      },
    });
    const bEntered = deferred();
    const bFinish = deferred();
    const workerB = createWorker(storage, 'B', () => {
      bEntered.resolve();
      return bFinish.promise;
    });
    const workerF = createWorker(storage, 'F', async () => {}, { agentClass: cls.F });

    workerA.die();
    await advance(AGENT_RESUME_CLAIM_STALE_MS + 1);

    const resumeC = workerC.agent.resumeGenerate({ name: 'Ada' }, { runId });
    resumeC.catch(() => {});
    await cTakeoverSent.promise;

    const resumeB = workerB.agent.resumeGenerate({ name: 'Ada' }, { runId });
    resumeB.catch(() => {});
    await bEntered.promise;

    cTakeoverArrive.resolve();
    await cTakeoverLanded.promise;

    const executions = () => [
      ...workerA.executions,
      ...workerB.executions,
      ...workerC.executions,
      ...workerF.executions,
    ];
    return {
      runId,
      workerC,
      workerF,
      resumeB,
      resumeC,
      finishB: bFinish.resolve,
      returnC: cTakeoverReturn.resolve,
      executions,
    };
  }

  it('keeps the live takeover when a slower taker of the same dead claim catches up', async () => {
    const { runId, workerF, resumeB, resumeC, finishB, returnC, executions } = await raceTwoTakers();

    await advance(AGENT_RESUME_CLAIM_STALE_MS + 1);
    returnC();
    await expect(resumeC).rejects.toMatchObject({ id: 'AGENT_RESUME_ALREADY_CLAIMED' });

    await expect(outcome(workerF.agent.resumeGenerate({ name: 'Ada' }, { runId }))).resolves.toBe(
      'AGENT_RESUME_ALREADY_CLAIMED',
    );
    // B is still alive well past the stale window, so a later resume must not take it over.
    await advance(AGENT_RESUME_CLAIM_STALE_MS * 2);
    await expect(outcome(workerF.agent.resumeGenerate({ name: 'Ada' }, { runId }))).resolves.toBe(
      'AGENT_RESUME_ALREADY_CLAIMED',
    );

    finishB();
    expect((await resumeB).text).toBe('Found Ada.');
    expect(executions()).toEqual(['A', 'B']);
  }, 60_000);

  it('rejects a brand-new resume that arrives while the slower taker is still catching up', async () => {
    const { runId, workerF, resumeB, resumeC, finishB, returnC, executions } = await raceTwoTakers();

    // A third, unrelated resume (a client retry) arrives while C's write is still in flight.
    const fOutcome = await outcome(workerF.agent.resumeGenerate({ name: 'Ada' }, { runId }));

    returnC();
    await expect(resumeC).rejects.toMatchObject({ id: 'AGENT_RESUME_ALREADY_CLAIMED' });
    finishB();
    await resumeB;

    expect(fOutcome).toBe('AGENT_RESUME_ALREADY_CLAIMED');
    expect(executions()).toEqual(['A', 'B']);
  }, 60_000);

  it('rejects later resumes while the live claimant runs, even if the slower taker dies mid-write', async () => {
    const { runId, workerC, workerF, resumeB, finishB, executions } = await raceTwoTakers();

    workerC.die();
    await advance(AGENT_RESUME_CLAIM_STALE_MS * 2);

    const fOutcome = await outcome(workerF.agent.resumeGenerate({ name: 'Ada' }, { runId }));

    finishB();
    expect((await resumeB).text).toBe('Found Ada.');
    expect(fOutcome).toBe('AGENT_RESUME_ALREADY_CLAIMED');
    expect(executions()).toEqual(['A', 'B']);
  }, 60_000);

  it('never double-runs when processes without the lease run next to ones with it', async () => {
    const { storage, runId, workerA } = await setup();
    const oldC = createWorker(storage, 'oldC', async () => {}, { fencing: false });
    const bEntered = deferred();
    const bFinish = deferred();
    const workerB = createWorker(storage, 'B', () => {
      bEntered.resolve();
      return bFinish.promise;
    });
    const oldF = createWorker(storage, 'oldF', async () => {}, { fencing: false });

    workerA.die();
    await advance(AGENT_RESUME_CLAIM_STALE_MS + 1);

    // A process without the lease never takes over a running claim, so it cannot rescue A but
    // cannot clobber anyone either.
    const cOutcome = await outcome(oldC.agent.resumeGenerate({ name: 'Ada' }, { runId }));
    const resumeB = workerB.agent.resumeGenerate({ name: 'Ada' }, { runId });
    await bEntered.promise;
    const fOutcome = await outcome(oldF.agent.resumeGenerate({ name: 'Ada' }, { runId }));
    await advance(AGENT_RESUME_CLAIM_STALE_MS * 2);
    const f2Outcome = await outcome(oldF.agent.resumeGenerate({ name: 'Ada' }, { runId }));
    bFinish.resolve();

    expect((await resumeB).text).toBe('Found Ada.');
    expect([cOutcome, fOutcome, f2Outcome]).toEqual(Array(3).fill('AGENT_RESUME_ALREADY_CLAIMED'));
    expect([...workerA.executions, ...oldC.executions, ...workerB.executions, ...oldF.executions]).toEqual(['A', 'B']);
  }, 60_000);

  it('never takes over a running claim started by a process without the lease', async () => {
    const { storage, runId, resumeA, finishA, workerA } = await setup({ fencing: false });
    const workerB = createWorker(storage, 'B', async () => {});

    // A runs well past the stale window without renewing anything.
    await advance(AGENT_RESUME_CLAIM_STALE_MS * 2);
    await expect(outcome(workerB.agent.resumeGenerate({ name: 'Ada' }, { runId }))).resolves.toBe(
      'AGENT_RESUME_ALREADY_CLAIMED',
    );

    finishA();
    expect((await resumeA).text).toBe('Found Ada.');
    expect([...workerA.executions, ...workerB.executions]).toEqual(['A']);
  }, 30_000);

  it('keeps the behaviour from before leases on a store without run fencing', async () => {
    const { storage, runId, workerA } = await setup({ fencing: false });
    const workerB = createWorker(storage, 'B', async () => {}, { fencing: false });

    // A dead running claim is never taken over without fencing: nothing tells it from a slow one.
    workerA.die();
    await advance(AGENT_RESUME_CLAIM_STALE_MS * 2);
    await expect(outcome(workerB.agent.resumeGenerate({ name: 'Ada' }, { runId }))).resolves.toBe(
      'AGENT_RESUME_ALREADY_CLAIMED',
    );

    // A claim left `pending` (claimed, never started) is still taken over once stale.
    const workflows = (await storage.getStore('workflows'))!;
    await workflows.updateWorkflowState({
      workflowName: 'agentic-loop',
      runId,
      opts: { status: 'pending', expectedStatus: 'running', resumeClaimedAt: Date.now() - AGENT_RESUME_CLAIM_STALE_MS },
    });
    await expect(outcome(workerB.agent.resumeGenerate({ name: 'Ada' }, { runId }))).resolves.toBe('Found Ada.');

    expect([...workerA.executions, ...workerB.executions]).toEqual(['A', 'B']);
    const leaseCalls = ['claimRunOwnership', 'renewRunOwnership', 'releaseRunOwnership', 'getRunOwnership'];
    expect([...workerA.calls, ...workerB.calls].filter(c => leaseCalls.includes(c))).toEqual([]);
    const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: 'agentic-loop', runId });
    expect(snapshot?.resumeLeasedClaimAt).toBeUndefined();
  }, 30_000);
  describe('next to main from before this change (e3c7914518)', () => {
    const run = (w: any, runId: string) => outcome(w.agent.resumeGenerate({ name: 'Ada' }, { runId }));

    it('main processes next to a new takeover never double-run', async () => {
      const { storage, runId, workerA } = await setup();
      const mainC = createWorker(storage, 'mainC', async () => {}, { agentClass: MainAgent });
      const bEntered = deferred();
      const bFinish = deferred();
      const workerB = createWorker(storage, 'B', () => {
        bEntered.resolve();
        return bFinish.promise;
      });
      const mainF = createWorker(storage, 'mainF', async () => {}, { agentClass: MainAgent });
      workerA.die();
      await advance(AGENT_RESUME_CLAIM_STALE_MS + 1);
      const c = await run(mainC, runId);
      const resumeB = workerB.agent.resumeGenerate({ name: 'Ada' }, { runId });
      await bEntered.promise;
      const f1 = await run(mainF, runId);
      await advance(AGENT_RESUME_CLAIM_STALE_MS * 2);
      const f2 = await run(mainF, runId);
      bFinish.resolve();
      expect((await resumeB).text).toBe('Found Ada.');
      expect([c, f1, f2]).toEqual(Array(3).fill('AGENT_RESUME_ALREADY_CLAIMED'));
      expect([...workerA.executions, ...mainC.executions, ...workerB.executions, ...mainF.executions]).toEqual([
        'A',
        'B',
      ]);
    }, 60_000);

    it('a new process never takes over a running claim started by main', async () => {
      const { storage, runId, workerA, resumeA, finishA } = await setup({ agentClass: MainAgent });
      const workerB = createWorker(storage, 'B', async () => {});
      await advance(AGENT_RESUME_CLAIM_STALE_MS * 2);
      const b = await run(workerB, runId);
      finishA();
      expect((await resumeA).text).toBe('Found Ada.');
      expect(b).toBe('AGENT_RESUME_ALREADY_CLAIMED');
      expect([...workerA.executions, ...workerB.executions]).toEqual(['A']);
    }, 60_000);

    it('main never takes over a live new-build claim', async () => {
      const { storage, runId, workerA, resumeA, finishA } = await setup();
      const mainF = createWorker(storage, 'mainF', async () => {}, { agentClass: MainAgent });
      await advance(AGENT_RESUME_CLAIM_STALE_MS * 2);
      const f = await run(mainF, runId);
      finishA();
      expect((await resumeA).text).toBe('Found Ada.');
      expect(f).toBe('AGENT_RESUME_ALREADY_CLAIMED');
      expect([...workerA.executions, ...mainF.executions]).toEqual(['A']);
    }, 60_000);
  });
});

/**
 * REPRO (not collected by CI — the `unit:*` project only includes `src/**\/*.test.ts`).
 *
 * Run with:
 *   cd packages/core && npx vitest run src/agent-controller/__tests__/repro-session-abort-lost-run.repro.ts
 *   (rename to `.test.ts` first if your vitest filters strictly by the include glob)
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SHOWS
 * ---------------------------------------------------------------------------
 * `session-abort-immediate-next-message.test.ts` ("Given the prior stream still
 * finalizing past the idle-wait timeout, ...") fails intermittently in CI. That
 * failure is NOT test flake — it is a real, user-visible, PERMANENT hang in the
 * post-abort send path on `main`.
 *
 * Sending a message immediately after `abort()` can silently swallow the
 * message:
 *
 *   - the session emits `agent_start` and reports a new run id,
 *   - the model is NEVER called for that run,
 *   - no terminal `agent_end` is ever emitted (confirmed past the 5s
 *     `ABORT_STREAM_GRACE_MS` deadline, up to a 10s cap here),
 *   - `displayState.isRunning` stays `true` forever.
 *
 * The session is wedged: it never returns to idle and the follow-up message is
 * never answered.
 *
 * ---------------------------------------------------------------------------
 * EVIDENCE
 * ---------------------------------------------------------------------------
 * Rate: ~1 in 40 synchronous iterations locally (the CI failure is the same
 * ~2-3% window; CI's extra load widens it).
 *
 * Decisive signal — count of model `doStream` calls per iteration:
 *
 *   [MOCK] focus-0 doStream call #1 -> held        <-- FAILING: no call #2
 *   [MOCK] focus-1 doStream call #1 -> held
 *   [MOCK] focus-1 doStream call #2 -> text        <-- PASSING: follow-up ran
 *
 * Every passing iteration calls `doStream` twice; the failing iteration calls it
 * once. The second run is started in session bookkeeping but never reaches the
 * model.
 *
 * Instrumented trace of the failing iteration:
 *   1. run.setRunId(run1)                 — run 1 starts, streams `heldStream`
 *   2. consent abort()
 *   3. sendMessage()                      — follow-up
 *   4. stream.cleanup #1  (current=null)  — local subscription torn down
 *      run.reset (was=run1)
 *   5. stream.cleanup #2  (current=null)
 *      run.reset (was=null)
 *   6. subscribeToThread -> attach -> consumer loop B starts
 *   7. run.setRunId(run2)
 *      EMIT agent_start                   (consumer loop B, session-run-engine.ts:1358)
 *   8. chunks: data-user-message, step-start, text-start, text-delta   <-- then NOTHING
 *      ... no `text-end`, no `finish`, no `error`, no `detach`
 *
 * Both `stream.cleanup()` calls happen BEFORE the new subscription is attached,
 * so this is not a late-unsubscribe problem. Consumer loop B emits the second
 * `agent_start` and then stops receiving chunks mid-run.
 *
 * ---------------------------------------------------------------------------
 * ROOT CAUSE
 * ---------------------------------------------------------------------------
 * `Session.sendSignal` (packages/core/src/agent-controller/session.ts) handles
 * the post-abort window at ~3603-3627:
 *
 *     if (submittedAbortRequested && (submittedRunId || submittedActiveRunId)) {
 *       const idle = await this.waitForStreamIdle();
 *       if (!idle) this.thread.cleanupSubscription();
 *       await this.thread.ensureSubscription(threadId, agent);
 *     }
 *
 * This correctly forces a fresh local subscription so the new run's events reach
 * the session — but it does not stop the signal from being ROUTED onto the
 * still-dying run. The agent runtime tracks the active run per thread in
 * `state.activeThreadRunIds` (packages/core/src/agent/thread-stream-runtime.ts
 * ~3570-3612). Tearing down the local subscription does not clear that entry;
 * it is released only when the dying run finalizes.
 *
 * Because `submittedWhileWorking` is computed from the pre-wait snapshot
 * (session.ts ~3537-3550):
 *
 *     const submittedWhileWorking =
 *       submittedIsRunning || (submittedAbortRequested && Boolean(submittedRunId || submittedActiveRunId));
 *     const signal = submittedWhileWorking ? asInterjection(submitted) : submitted;
 *
 * the follow-up carries `delivery: 'while-active'`, so the agent treats it as an
 * interjection into the current run rather than a fresh turn. When run 1's
 * teardown is still in flight, the interjection is accepted onto the dying run
 * — which has already produced its model output and will never make another
 * model call — so the message is swallowed. Meanwhile the freshly attached
 * consumer loop observes the reserved new run id, emits `agent_start`, then
 * waits forever for a terminal chunk that never comes.
 *
 * This is the exact hazard the code's own comment warns about:
 *   "... Dispatching a fresh signal now would let the agent queue it onto the
 *    dying run instead of starting a new run, and the follow-up would never get
 *    a response."
 * The `!idle` branch papers over the subscription, not the routing.
 *
 * Note: `waitForStreamIdle` is mocked to return `false` in this test, but the
 * guard at session.ts:3611 and the real run-teardown ordering are not mocked —
 * the race is between run 1 finalizing and the dispatch. On an unloaded machine
 * run 1 usually wins; under CI load it does not.
 *
 * ---------------------------------------------------------------------------
 * PROVENANCE
 * ---------------------------------------------------------------------------
 * Pre-existing on `main` (this file is branched from `origin/main`). The
 * regression test came from #23565; the underlying hole is the residual case
 * that PR did not close. It is unrelated to the structured-output change in
 * #24176 — the PR only flips the CI coin by landing a new commit.
 *
 * ---------------------------------------------------------------------------
 * FIX DIRECTION (needs a decision — see notes in the PR/issue)
 * ---------------------------------------------------------------------------
 * The message sent after `abort()` is a fresh turn, not an interjection into a
 * run the user just cancelled. Candidate fixes:
 *
 *   (a) Once the post-abort lingering state is detected, re-derive delivery for
 *       the post-wait state so the signal is a plain user turn rather than
 *       `asInterjection(...)` — i.e. stop treating a run the user just aborted as
 *       a delivery target.
 *   (b) Make `sendSignal` wait for the run to be actually released from the
 *       agent runtime (not just the local subscription) before dispatching, so
 *       `activeThreadRunIds` no longer points at the dying run.
 *   (c) Clear/ignore the stale `activeThreadRunIds` entry as part of the forced
 *       re-subscription.
 *
 * (a) is the most local and matches #23456's stated intent ("must start a fresh,
 * observable run"), but it changes delivery semantics and needs review against
 * the deferred-abort / plan-approval paths. Any of these touches core session
 * lifecycle, so it should not be rushed.
 *
 * A deterministic regression test is the other gap: the current test is
 * timing-dependent at ~2.5%, which is why CI flakes instead of failing loudly.
 */
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

vi.setConfig({ testTimeout: 300_000 });

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const ITERATIONS = 60;

/** A model stream that emits an opening delta, then blocks until `gate` resolves. */
function heldStream(gate: Promise<void>) {
  return new ReadableStream({
    async start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-held', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-held' });
      controller.enqueue({ type: 'text-delta', id: 'text-held', delta: 'thinking' });
      await gate;
      try {
        controller.enqueue({ type: 'text-end', id: 'text-held' });
        controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
        controller.close();
      } catch {
        // The run was aborted while held; the stream is already torn down.
      }
    },
  });
}

/** A model stream that completes immediately with a short text turn. */
function textStream(delta: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-text', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
      controller.close();
    },
  });
}

async function createHarness(id: string) {
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>(resolve => {
    releaseFirst = resolve;
  });

  let callCount = 0;
  const modelCalls = () => callCount;
  const agent = new Agent({
    id: `${id}-agent`,
    name: `${id} agent`,
    instructions: 'You reply to the user.',
    model: new MastraLanguageModelV2Mock({
      doStream: async () => {
        callCount++;
        const n = callCount;
        return { stream: n === 1 ? heldStream(firstGate) : textStream('second reply') };
      },
    }),
  });

  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { [`${id}-agent`]: agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent(`${id}-agent`);

  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: `${id}-controller`,
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
  });
  await controller.init();
  const session = await controller.createSession({ id: `${id}-session`, ownerId: 'owner-1' });
  await session.thread.create();

  const events: AgentControllerEvent[] = [];
  session.subscribe((event: AgentControllerEvent) => {
    events.push(event);
  });

  return { session, events, releaseFirst, modelCalls };
}

/** Resolve once `count` events of `type` have been observed, or after `timeoutMs`. */
function waitForEventCount(
  events: AgentControllerEvent[],
  type: AgentControllerEvent['type'],
  count: number,
  timeoutMs = 5_000,
) {
  return new Promise<void>(resolve => {
    const start = Date.now();
    const check = () => {
      if (events.filter(e => e.type === type).length >= count || Date.now() - start > timeoutMs) {
        resolve();
        return;
      }
      setTimeout(check, 10);
    };
    check();
  });
}

describe('REPRO: message sent right after abort() can be swallowed (#23456 residual)', () => {
  it(`starts the follow-up run against the model (${ITERATIONS} synchronous iterations)`, async () => {
    const failures: string[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const { session, events, releaseFirst, modelCalls } = await createHarness(`repro-${i}`);

      void session.sendMessage({ content: 'first message' }).catch(() => {});
      await waitForEventCount(events, 'agent_start', 1, 5_000);
      // Let the held stream emit its opening delta so the run is genuinely in flight.
      await new Promise<void>(r => setTimeout(r, 0));

      // Mirror the regression test: force the idle-wait timeout escape so the
      // `!idle` forced-cleanup branch in sendSignal is taken.
      vi.spyOn(session as any, 'waitForStreamIdle').mockResolvedValue(false);

      session.abort();
      const sent = session.sendMessage({ content: 'second message' });
      await sent.catch(() => {});

      // Poll past ABORT_STREAM_GRACE_MS (5s) so "later" is distinguishable from "never".
      const started = Date.now();
      while (Date.now() - started < 10_000) {
        if (events.some(e => e.type === 'agent_end')) break;
        await new Promise<void>(r => setTimeout(r, 50));
      }

      const ends = events.filter(e => e.type === 'agent_end').length;
      const starts = events.filter(e => e.type === 'agent_start').length;

      if (ends < 1) {
        failures.push(
          `iteration ${i}: starts=${starts} ends=${ends} modelCalls=${modelCalls()} ` +
            `isRunning=${session.displayState.get().isRunning} elapsedMs=${Date.now() - started} ` +
            `(follow-up run never reached the model; session never returned to idle)`,
        );
      }

      releaseFirst();
    }

    if (failures.length > 0) {
      throw new Error(
        `Swallowed follow-up after abort in ${failures.length}/${ITERATIONS} iterations:\n  ` + failures.join('\n  '),
      );
    }

    // If this assertion fails, the bug did not reproduce in this run — re-run;
    // it is a genuine race (observed ~1 in 40) and CI hits it under load.
    expect(failures).toEqual([]);
  });
});

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { McE2eScenario } from './types.js';

const OBJECTIVE = 'Keep the mid-goal thread switch e2e objective alive.';

/**
 * A live goal survives a thread created in the middle of it: the goal is set on
 * the starting thread, `/new` creates a second thread while the goal is still
 * live, and the original thread's durable goal record must still be there —
 * on the same thread — when the app shuts down.
 *
 * This is a positive end-to-end demo, not a discriminating regression test for
 * the empty-mirror deletion defect (#22447): it passes on pre-fix code as well.
 * `saveToThread` resolves its thread id from the live session, and the session
 * has already switched to the new thread by the time `thread_created` is
 * dispatched, so the pre-fix delete landed on the new (goal-less) thread. The
 * paths that could destroy a live row — a swallowed `getObjective` failure, or
 * a save inside the `setGoal` window — need an injected storage fault, which
 * this harness has no seam for. The deterministic pin lives in
 * `src/tui/__tests__/goal-manager.test.ts`, as with
 * `goal-fresh-thread-persistence.ts`.
 */
export const goalSurvivesNewThreadScenario: McE2eScenario = {
  name: 'goal-survives-new-thread',
  description: 'Set a goal, create a new thread mid-goal, and verify the original thread keeps its goal record.',
  testName: 'keeps the durable goal when a new thread is created mid-goal',
  useOpenAIModel: true,
  aimockFixture: 'goal-survives-new-thread.json',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.models = {
      ...settings.models,
      goalJudgeModel: 'openai/gpt-5.4-mini',
      goalMaxTurns: 3,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime, dbPath }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit(`/goal ${OBJECTIVE}`);
    await runtime.waitForScreenText(/Mid-goal thread switch e2e acknowledged\./i, terminal, 20_000);

    terminal.submit('/goal status');
    await runtime.waitForScreenText(/Keep the mid-goal thread switch e2e objective alive\./i, terminal, 10_000);

    // Record which thread owns the goal *before* the switch, so the assertion
    // below is "this exact record survived" rather than the much weaker "some
    // thread has a goal" — which a delete-then-recreate would also satisfy.
    const beforeDb = new DatabaseSync(dbPath, { readOnly: true });
    let originalThreadId: string;
    let threadCountBefore: number;
    try {
      threadCountBefore = (beforeDb.prepare('select count(*) as n from mastra_threads').get() as { n: number }).n;
      const before = beforeDb.prepare(`select threadId from mastra_thread_state where type = 'goal'`).all() as Array<{
        threadId: string;
      }>;
      if (before.length !== 1) {
        throw new Error(`Expected one goal record before the thread switch, found ${before.length}`);
      }
      originalThreadId = before[0]!.threadId;
    } finally {
      beforeDb.close();
    }

    // Create a second thread while the goal is still live. This is the
    // `thread_created` path that empties the in-memory goal mirror.
    // A thread row is only persisted once the thread carries a turn, so `/new`
    // alone leaves the count unchanged and the switch unproven. Send a message
    // on the new thread to materialize it.
    terminal.submit('/new');
    await runtime.sleep(1000);
    terminal.submit('hello on the new thread');
    await runtime.waitForScreenText(/New thread reply\./i, terminal, 20_000);
    await runtime.sleep(1000);

    terminal.keyCtrlC();
    await runtime.stopApp?.();

    const db = new DatabaseSync(dbPath);
    try {
      const rows = db.prepare(`select threadId, value from mastra_thread_state where type = 'goal'`).all() as Array<{
        threadId: string;
        value: string;
      }>;
      if (rows.length !== 1) {
        throw new Error(`Expected exactly one persisted goal record, found ${rows.length}`);
      }
      const goal = JSON.parse(rows[0]!.value) as { objective?: string; status?: string };
      if (goal.objective !== OBJECTIVE) {
        throw new Error(
          `Expected persisted objective ${JSON.stringify(OBJECTIVE)}, found ${JSON.stringify(goal.objective)}`,
        );
      }
      if (goal.status === 'none' || !goal.status) {
        throw new Error(`Expected the goal to remain set, found status ${JSON.stringify(goal.status)}`);
      }

      // Compare against the pre-switch count rather than a bare `>= 2`: the
      // point is that `/new` actually created a thread, which a fixture that
      // happened to start with two threads would otherwise hide.
      const threadCountAfter = (db.prepare('select count(*) as n from mastra_threads').get() as { n: number }).n;
      if (threadCountAfter <= threadCountBefore) {
        throw new Error(
          `Expected /new to create a thread mid-goal, count went ${threadCountBefore} -> ${threadCountAfter}`,
        );
      }
      if (rows[0]!.threadId !== originalThreadId) {
        throw new Error(
          `Expected the goal to stay on the original thread ${originalThreadId}, found it on ${rows[0]!.threadId}`,
        );
      }
    } finally {
      db.close();
    }
  },
};

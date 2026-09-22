import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { McE2eScenario } from './types.js';

const OBJECTIVE = 'Keep the mid-goal thread switch e2e objective alive.';

/**
 * End-to-end coverage for a live goal surviving a thread created in the middle
 * of it: the goal is set on the starting thread, `/new` creates a second thread
 * while the goal is still live, and the original thread's durable goal record
 * must still be there when the app shuts down.
 *
 * This is NOT a discriminating regression test for the empty-mirror deletion
 * defect, and it cannot be made into one from this harness. Two reasons:
 *
 *  1. `GoalManager.saveToThread` resolves its thread id from the live session
 *     (`state.session.thread.getId()`), and the session assigns the new thread
 *     id before `thread_created` is dispatched. So on pre-fix code the
 *     `clearObjective` lands on the *new* thread, which has no goal row, and
 *     the original thread's row survives regardless of the fix.
 *  2. The two mechanisms that can actually destroy a live row — a swallowed
 *     `getObjective` failure on the same thread, and the window inside
 *     `setGoal` before `setObjective` resolves — need an injected storage
 *     fault, and the e2e harness exposes no seam for one (scenarios receive an
 *     app-data dir and a db path, nothing that reaches storage behaviour).
 *
 * The deterministic pin for the defect therefore lives in the unit tests
 * (`src/tui/__tests__/goal-manager.test.ts`), which assert that a save with an
 * empty mirror calls neither `clearObjective` nor the legacy-metadata wipe.
 * What this scenario buys is the real end-to-end path: a real goal, a real
 * mid-goal thread creation, and the goal record actually still in SQLite on the
 * thread that owns it. This mirrors the honesty convention already used by
 * `goal-fresh-thread-persistence.ts`.
 */
export const goalSaveDoesNotDeleteScenario: McE2eScenario = {
  name: 'goal-save-does-not-delete',
  description: 'Set a goal, create a new thread mid-goal, and verify the original thread keeps its goal record.',
  testName: 'keeps the durable goal when a new thread is created mid-goal',
  useOpenAIModel: true,
  aimockFixture: 'goal-save-does-not-delete.json',
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

    // Create a second thread while the goal is still live. This is the
    // `thread_created` path that empties the in-memory goal mirror.
    terminal.submit('/new');
    await runtime.sleep(1500);

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

      const threadRows = db.prepare('select id from mastra_threads').all() as Array<{ id: string }>;
      if (threadRows.length < 2) {
        throw new Error(`Expected a second thread to have been created mid-goal, found ${threadRows.length}`);
      }
      if (!threadRows.some(row => row.id === rows[0]!.threadId)) {
        throw new Error(`Persisted goal points at unknown thread ${rows[0]!.threadId}`);
      }
    } finally {
      db.close();
    }
  },
};

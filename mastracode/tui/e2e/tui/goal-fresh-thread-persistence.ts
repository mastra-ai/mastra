import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { McE2eScenario } from './types.js';

const OBJECTIVE = 'Keep the fresh thread goal e2e objective alive.';

/**
 * Regression coverage for goals started on a thread that does not exist yet.
 * The TUI creates the thread as part of starting the goal, and the deferred
 * `thread_created` handler runs afterwards — if the persistence flag is not
 * armed before the create, that handler drops the in-memory goal and the next
 * save clears the objective from the store. Here the goal must still be on the
 * created thread once the app shuts down.
 */
export const goalFreshThreadPersistenceScenario: McE2eScenario = {
  name: 'goal-fresh-thread-persistence',
  description: 'Start a persistent goal on a not-yet-created thread and verify it survives thread creation.',
  testName: 'persists a goal started on a freshly created thread',
  useOpenAIModel: true,
  aimockFixture: 'goal-fresh-thread-persistence.json',
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

    // Queue a brand-new thread so the goal start is the thing that creates it.
    terminal.submit('/new');
    await runtime.sleep(500);

    terminal.submit(`/goal ${OBJECTIVE}`);
    await runtime.waitForScreenText(/Fresh thread goal e2e acknowledged\./i, terminal, 20_000);

    terminal.submit('/goal status');
    await runtime.waitForScreenText(/Keep the fresh thread goal e2e objective alive\./i, terminal, 10_000);

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

      const threadRows = db.prepare('select id from mastra_threads where id = ?').all(rows[0]!.threadId) as Array<{
        id: string;
      }>;
      if (threadRows.length !== 1) {
        throw new Error(`Persisted goal points at unknown thread ${rows[0]!.threadId}`);
      }
    } finally {
      db.close();
    }
  },
};

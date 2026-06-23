import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

/**
 * The "new" resourceId that MC will use at startup (set via MASTRA_RESOURCE_ID).
 * Simulates the current computation — e.g. derived from a git remote URL that
 * was added after the original threads were created.
 */
const NEW_RESOURCE_ID = 'mc-e2e-new-remote-resource';

/**
 * The "old" resourceId that pre-existing threads were stored under.
 * Simulates the previous computation — e.g. derived from directory name
 * before a git remote was added to the repo.
 */
const OLD_RESOURCE_ID = 'mc-e2e-old-dirname-resource';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function gitInDir(args: string[], cwd: string): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

/**
 * Bug: When a repo's resourceId changes (e.g. a git remote is added, shifting
 * the computation from directory-based to URL-based), `#createSessionForResource`
 * queries threads by the NEW resourceId, finds 0, and creates a blank thread —
 * orphaning the user's existing conversations that are stored under the OLD id.
 *
 * This test seeds a thread under the OLD resourceId with `projectPath` matching
 * the current project directory. MC launches with the NEW resourceId.
 *
 * Expected (with fix): MC falls back to a metadata query for `projectPath`,
 * finds the old thread, and auto-resumes it.
 * Actual (without fix): MC finds 0 threads for the new resourceId and starts
 * a blank session.
 */
export const resourceidDriftAutoResumeScenario: McE2eScenario = {
  name: 'resourceid-drift-auto-resume',
  description:
    'Verify that MC auto-resumes a thread whose resourceId drifted, falling back to projectPath metadata.',
  testName: 'auto-resumes thread after resourceId drift via projectPath fallback',
  env() {
    return { MASTRA_RESOURCE_ID: NEW_RESOURCE_ID };
  },
  prepare({ dbPath, projectDir }) {
    // Create a real git repo with a remote — simulating a project that now
    // computes a different (URL-based) resourceId than when the thread was created.
    mkdirSync(projectDir, { recursive: true });
    gitInDir(['init', '-b', 'main'], projectDir);
    gitInDir(['config', 'user.email', 'mc-e2e@example.com'], projectDir);
    gitInDir(['config', 'user.name', 'MC E2E'], projectDir);
    execFileSync('touch', [join(projectDir, '.gitkeep')]);
    gitInDir(['add', '.gitkeep'], projectDir);
    gitInDir(['commit', '-m', 'init'], projectDir);
    // Add a remote — this is what triggers a new resourceId in the real scenario
    gitInDir(['remote', 'add', 'origin', 'https://github.com/test-org/my-project.git'], projectDir);

    // Seed a thread under the OLD resourceId, tagged with the current projectDir.
    // This simulates a thread created before the git remote was added.
    const futureDate = new Date('2099-01-01T00:00:00.000Z');
    const threadId = 'thread-old-resource-tagged';
    const meta = JSON.stringify({ projectPath: projectDir });

    const sql = `
INSERT INTO mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
VALUES
  (${quoteSql(threadId)}, ${quoteSql(OLD_RESOURCE_ID)}, ${quoteSql('Thread from before remote added')}, ${quoteSql(meta)}, ${quoteSql(futureDate.toISOString())}, ${quoteSql(futureDate.toISOString())});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    // Wait for MC to start
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);
    runtime.printScreen('after startup', terminal);

    // Use /thread to check which thread was loaded.
    // With the fix: should show "Thread from before remote added" (old thread
    // found via projectPath fallback despite resourceId mismatch).
    // Without the fix: MC found 0 threads for the new resourceId, created a
    // blank one, then promptForThreadSelection set pendingNewThread = true.
    terminal.submit('/thread');
    await runtime.waitForScreenText(/Thread from before remote added/i, terminal);
    runtime.printScreen('after /thread (should show old thread resumed via fallback)', terminal);

    terminal.keyCtrlC();
  },
};

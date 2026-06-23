import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import type { McE2eScenario } from './types.js';

const RESOURCE_ID = 'mc-e2e-cross-worktree-resource';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function gitInDir(args: string[], cwd: string): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

/**
 * Bug: #createSessionForResource picks the most-recent thread by updatedAt
 * filtered only by resourceId — it ignores projectPath. When multiple worktrees
 * share the same git URL (and thus the same resourceId), the harness can load a
 * thread from a DIFFERENT worktree into the session, contaminating it with the
 * wrong model pack, settings, and conversation history.
 *
 * This test seeds a single thread under the shared resourceId, tagged for a
 * DIFFERENT worktree path. MC launches in a worktree that has NO thread. Without
 * the fix, the harness loads the wrong thread (promptForThreadSelection sets
 * pendingNewThread but the wrong thread's metadata is already bound).
 *
 * Expected (with fix): harness filters by projectPath, finds 0 matches, does
 * NOT load the other worktree's thread.
 * Actual (without fix): harness loads the wrong worktree's thread by updatedAt.
 */
export const worktreeCrossThreadResumeScenario: McE2eScenario = {
  name: 'worktree-cross-thread-resume',
  description:
    'Verify that MC in a worktree does NOT auto-resume a thread tagged for a different worktree.',
  testName: 'does not auto-resume a thread from a different worktree',
  env() {
    return { MASTRA_RESOURCE_ID: RESOURCE_ID };
  },
  prepare({ dbPath, projectDir }) {
    // Create a main git repo alongside the project dir
    const mainRepoDir = join(dirname(projectDir), 'main-repo');
    execFileSync('mkdir', ['-p', mainRepoDir]);
    gitInDir(['init', '-b', 'main'], mainRepoDir);
    gitInDir(['config', 'user.email', 'mc-e2e@example.com'], mainRepoDir);
    gitInDir(['config', 'user.name', 'MC E2E'], mainRepoDir);
    execFileSync('touch', [join(mainRepoDir, 'README.md')]);
    gitInDir(['add', 'README.md'], mainRepoDir);
    gitInDir(['commit', '-m', 'init'], mainRepoDir);

    // Create worktree at projectDir (this is where MC will launch)
    gitInDir(['worktree', 'add', projectDir, '-b', 'worktree-current'], mainRepoDir);

    // Seed ONE thread: tagged for a DIFFERENT worktree. The current worktree
    // (projectDir) has no thread. Without the fix, the harness loads this wrong
    // thread because it's the most recent (and only) match by resourceId.
    const otherWorktreePath = join(dirname(projectDir), 'other-worktree');
    const futureDate = new Date('2099-06-01T00:00:00.000Z');
    const otherThreadId = 'thread-other-worktree-newer';
    const otherMeta = JSON.stringify({ projectPath: otherWorktreePath });

    const sql = `
INSERT INTO mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
VALUES
  (${quoteSql(otherThreadId)}, ${quoteSql(RESOURCE_ID)}, ${quoteSql('WRONG_WORKTREE_THREAD')}, ${quoteSql(otherMeta)}, ${quoteSql(futureDate.toISOString())}, ${quoteSql(futureDate.toISOString())});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    // Wait for MC to start — "Worktree of:" confirms worktree detection
    await runtime.waitForScreenText(/Worktree of:/i, terminal);
    runtime.printScreen('after startup', terminal);

    // Use /thread to inspect which thread was loaded.
    terminal.submit('/thread');

    // Wait for /thread output to fully render. With or without the fix,
    // promptForThreadSelection finds 0 matches for this worktree path and sets
    // pendingNewThread = true. This text confirms the output is complete.
    await runtime.waitForScreenText(/Pending new thread: yes/i, terminal);
    runtime.printScreen('after /thread', terminal);

    // The critical assertion: the wrong worktree's thread should NOT be loaded.
    // Without the fix, the harness picked "WRONG_WORKTREE_THREAD" by updatedAt
    // and its title appears on screen alongside "Pending new thread: yes".
    // With the fix, the harness filters by projectPath first and never loads it.
    await runtime.waitForScreenTextAbsent(/WRONG_WORKTREE_THREAD/i, terminal, 2_000);

    terminal.keyCtrlC();
  },
};

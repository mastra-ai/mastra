import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import type { McE2eScenario } from './types.js';

const RESOURCE_ID = 'mc-e2e-worktree-resource';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function gitInDir(args: string[], cwd: string): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

export const worktreeThreadScopingScenario: McE2eScenario = {
  name: 'worktree-thread-scoping',
  description:
    'Verify that starting MC in a git worktree does NOT auto-resume untagged threads or threads tagged for a different path.',
  testName: 'worktree filters out untagged and mismatched-path threads on startup',
  env() {
    return { MASTRA_RESOURCE_ID: RESOURCE_ID };
  },
  prepare({ dbPath, projectDir }) {
    // Create a main git repo alongside the project dir, then add projectDir as a worktree.
    const mainRepoDir = join(dirname(projectDir), 'main-repo');
    execFileSync('mkdir', ['-p', mainRepoDir]);
    gitInDir(['init', '-b', 'main'], mainRepoDir);
    gitInDir(['config', 'user.email', 'mc-e2e@example.com'], mainRepoDir);
    gitInDir(['config', 'user.name', 'MC E2E'], mainRepoDir);
    execFileSync('touch', [join(mainRepoDir, 'README.md')]);
    gitInDir(['add', 'README.md'], mainRepoDir);
    gitInDir(['commit', '-m', 'init'], mainRepoDir);

    // Create worktree at projectDir
    gitInDir(['worktree', 'add', projectDir, '-b', 'worktree-branch'], mainRepoDir);

    // Seed threads into the database — none tagged for the current worktree path.
    // Use a future timestamp so the thread is "newer" than the worktree directory's
    // birthtime — this ensures the birthtime fallback filter passes the thread
    // through, and only the worktree-specific check (the fix) blocks it.
    const futureDate = new Date('2099-01-01T00:00:00.000Z');
    const futureIso = futureDate.toISOString();

    const untaggedThreadId = 'thread-untagged-from-main';
    const otherPathThreadId = 'thread-other-worktree';

    const untaggedMeta = JSON.stringify({});
    const otherPathMeta = JSON.stringify({ projectPath: '/some/other/worktree' });

    const sql = `
INSERT INTO mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
VALUES
  (${quoteSql(untaggedThreadId)}, ${quoteSql(RESOURCE_ID)}, ${quoteSql('Untagged thread from main repo')}, ${quoteSql(untaggedMeta)}, ${quoteSql(futureIso)}, ${quoteSql(futureIso)}),
  (${quoteSql(otherPathThreadId)}, ${quoteSql(RESOURCE_ID)}, ${quoteSql('Thread from other worktree')}, ${quoteSql(otherPathMeta)}, ${quoteSql(futureIso)}, ${quoteSql(futureIso)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    // Wait for MC to start — "Worktree of:" confirms worktree detection
    await runtime.waitForScreenText(/Worktree of:/i, terminal);
    runtime.printScreen('after startup', terminal);

    // With the fix, the controller filters by projectPath, finds 0 matches for
    // this worktree, and creates a fresh (untitled) thread. Without the fix,
    // the untagged thread passes through and gets selected by updatedAt.
    terminal.submit('/thread');
    await runtime.waitForScreenText(/Resource:/i, terminal);
    runtime.printScreen('after /thread', terminal);

    // The critical assertion: neither the untagged thread nor the other
    // worktree's thread should be loaded.
    await runtime.waitForScreenTextAbsent(/Untagged thread from main repo/i, terminal, 2_000);
    await runtime.waitForScreenTextAbsent(/Thread from other worktree/i, terminal, 2_000);

    terminal.keyCtrlC();
  },
};

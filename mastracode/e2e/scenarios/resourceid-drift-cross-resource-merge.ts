import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const NEW_RESOURCE_ID = 'mc-e2e-drift-merge-new';
const OLD_RESOURCE_ID = 'mc-e2e-drift-merge-old';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function gitInDir(args: string[], cwd: string): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

/**
 * Bug: After a resourceId change, the first MC run creates a new thread
 * (T_new) under the new resourceId.  The user then manually switches to an
 * old thread (stored under the old resourceId) and tags it with
 * /thread:tag-dir.  On the next MC restart, Layer 1 finds T_new under the
 * new resourceId and skips the cross-resource Layer 2 query, so the
 * recently-tagged old thread is never discovered — even though it is the
 * most recently used.
 *
 * This test seeds BOTH threads:
 *   1. T_new  — under the NEW resourceId with matching projectPath (older)
 *   2. T_old  — under the OLD resourceId with matching projectPath (newer)
 *
 * Expected: MC merges candidates from both layers and resumes T_old (most
 * recent) — it should also migrate T_old's resourceId.
 */
export const resourceidDriftCrossResourceMergeScenario: McE2eScenario = {
  name: 'resourceid-drift-cross-resource-merge',
  description:
    'Verify MC resumes the most-recent tagged thread even when a newer-resourceId thread also exists.',
  testName: 'prefers most-recent cross-resource thread over same-resource thread after drift',
  env() {
    return { MASTRA_RESOURCE_ID: NEW_RESOURCE_ID };
  },
  prepare({ dbPath, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    gitInDir(['init', '-b', 'main'], projectDir);
    gitInDir(['config', 'user.email', 'mc-e2e@example.com'], projectDir);
    gitInDir(['config', 'user.name', 'MC E2E'], projectDir);
    execFileSync('touch', [join(projectDir, '.gitkeep')]);
    gitInDir(['add', '.gitkeep'], projectDir);
    gitInDir(['commit', '-m', 'init'], projectDir);
    gitInDir(['remote', 'add', 'origin', 'https://github.com/test-org/my-project.git'], projectDir);

    const meta = JSON.stringify({ projectPath: projectDir });

    // T_new: created under the NEW resourceId during a prior MC run (older).
    const olderDate = new Date('2098-01-01T00:00:00.000Z');
    // T_old: the user's original thread — tagged later, more recently used.
    const newerDate = new Date('2099-06-01T00:00:00.000Z');

    const sql = `
INSERT INTO mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
VALUES
  (${quoteSql('thread-new-resource')}, ${quoteSql(NEW_RESOURCE_ID)}, ${quoteSql('NEW_RESOURCE_THREAD')}, ${quoteSql(meta)}, ${quoteSql(olderDate.toISOString())}, ${quoteSql(olderDate.toISOString())}),
  (${quoteSql('thread-old-resource-tagged')}, ${quoteSql(OLD_RESOURCE_ID)}, ${quoteSql('OLD_TAGGED_THREAD')}, ${quoteSql(meta)}, ${quoteSql(newerDate.toISOString())}, ${quoteSql(newerDate.toISOString())});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);
    runtime.printScreen('after startup', terminal);

    terminal.submit('/thread');
    // With the fix: the OLD tagged thread (most recent) is resumed,
    // NOT the NEW resource thread.
    await runtime.waitForScreenText(/OLD_TAGGED_THREAD/i, terminal);
    runtime.printScreen('after /thread — should show old tagged thread', terminal);

    terminal.keyCtrlC();
  },
};

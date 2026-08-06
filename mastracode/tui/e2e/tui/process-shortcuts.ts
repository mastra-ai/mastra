import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const processShortcutsScenario: McE2eScenario = {
  name: 'process-shortcuts',
  description: 'Exercise process shortcut help, Alt+Z undo behavior, and Ctrl+C storage shutdown through the real TUI.',
  testName: 'shows suspend shortcut help, restores cleared input with Alt+Z, and checkpoints storage on shutdown',
  async run({ terminal, runtime, dbPath }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('/help');
    await runtime.waitForScreenText(/Keyboard Shortcuts/i, terminal);
    await runtime.waitForScreenText(/Ctrl\+Z\s+Suspend process \(fg to resume\)/i, terminal);
    await runtime.waitForScreenText(/Alt\+Z\s+Undo last clear/i, terminal);
    runtime.printScreen('after /help', terminal);

    terminal.write('mc alt-z undo e2e draft');
    await runtime.waitForScreenText(/mc alt-z undo e2e draft/i, terminal);
    terminal.keyCtrlC();
    await runtime.waitForScreenTextAbsent(/mc alt-z undo e2e draft/i, terminal, 8_000);
    expect(terminal.serialize().view).not.toContain('mc alt-z undo e2e draft');

    terminal.write('\x1bz');
    await runtime.waitForScreenText(/mc alt-z undo e2e draft/i, terminal);
    runtime.printScreen('after Alt-Z undo', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);

    // Shut down the in-process app so storage close (WAL checkpoint) runs,
    // then verify the local database is intact and WAL/SHM sidecars are gone.
    await runtime.stopApp?.();

    const db = new DatabaseSync(dbPath);
    try {
      const rows = db.prepare('PRAGMA quick_check').all() as Array<Record<string, unknown>>;
      const result = rows[0] ? Object.values(rows[0])[0] : undefined;
      if (result !== 'ok') {
        throw new Error(`PRAGMA quick_check failed: ${String(result)}`);
      }
    } finally {
      db.close();
    }

    // After closeStorage() checkpoints and truncates the WAL, the sidecar
    // files should be absent (or at least not left in a half-written state).
    if (existsSync(`${dbPath}-wal`)) {
      throw new Error(`WAL sidecar still exists after shutdown: ${dbPath}-wal`);
    }
    if (existsSync(`${dbPath}-shm`)) {
      throw new Error(`SHM sidecar still exists after shutdown: ${dbPath}-shm`);
    }
  },
};

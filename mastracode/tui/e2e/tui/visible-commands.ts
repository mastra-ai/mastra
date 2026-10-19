import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

let settingsPath = '';

export const visibleCommandsScenario: McE2eScenario = {
  name: 'visible-commands',
  description: 'Exercise visible slash-command UI for help and the Theme setting through the real TUI.',
  testName: 'shows help and switches theme from settings in the real TUI',
  prepare({ appDataDir }) {
    settingsPath = join(appDataDir, 'settings.json');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.resize(120, 90);
    terminal.submit('/help');
    await runtime.waitForScreenText(/Commands/i, terminal);
    await runtime.waitForScreenText(/\/clone\s+Clone the current thread/i, terminal);
    await runtime.waitForScreenText(/\/threads\s+Switch between threads/i, terminal);
    await runtime.waitForScreenText(/\/resume\s+Alias for \/threads/i, terminal);
    await runtime.waitForScreenText(/\/name\s+Rename current thread/i, terminal);
    await runtime.waitForScreenText(/\/rename\s+Alias for \/name/i, terminal);
    await runtime.waitForScreenText(/\/api-keys/i, terminal);
    await runtime.waitForScreenText(/Ctrl\+Z|Suspend process/i, terminal);
    await runtime.waitForScreenTextAbsent(/\/knowledge\s+Browse scoped Subconscious knowledge/i, terminal);
    runtime.printScreen('after /help', terminal);

    terminal.submit('/knowledge');
    await runtime.waitForScreenText(/Unknown command:\s*\/knowledge/i, terminal);

    terminal.submit('/theme');
    await runtime.waitForScreenText(/Unknown command:\s*\/?theme\b/i, terminal);

    const down = '\x1b[B';
    terminal.submit('/settings');
    await runtime.waitForScreenText(/Theme/, terminal);
    await runtime.waitForScreenText(/Terminal background\s+Off/, terminal);
    terminal.write(down.repeat(3) + '\r');
    await runtime.waitForScreenText(/Match the terminal background/, terminal);
    runtime.printScreen('after opening Theme setting', terminal);

    terminal.write(down + '\r');
    await runtime.waitForScreenText(/Theme set to dark/i, terminal);
    await runtime.waitForScreenText(/Theme\s+dark/, terminal);
    runtime.printScreen('after picking dark in settings', terminal);

    terminal.write(down + '\r');
    await runtime.waitForScreenText(/Use the theme's background color/, terminal);
    terminal.write('\x1b[A\r');
    await runtime.waitForScreenText(/Terminal background\s+On/, terminal);
    runtime.printScreen('after turning on terminal background', terminal);

    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Terminal background\s+On/, terminal);
    const saved = JSON.parse(readFileSync(settingsPath, 'utf8'));
    assert.equal(saved.preferences.theme, 'dark');
    assert.equal(saved.preferences.terminalBackground, true);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};

import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const shellPassthroughConfiguredSettingsScenario: McE2eScenario = {
  name: 'shell-passthrough-configured-settings',
  description: 'Verify persisted shell passthrough settings drive the real TUI ! command path.',
  testName: 'uses persisted shell passthrough executable settings for local ! commands',
  prepare({ appDataDir }) {
    const wrapperPath = join(appDataDir, 'configured-shell-wrapper.sh');
    writeFileSync(
      wrapperPath,
      [
        '#!/bin/sh',
        'printf "MC_CONFIGURED_SETTINGS_SHELL arg0=%s command=%s\\n" "$1" "$2"',
        'exec /bin/sh "$@"',
        '',
      ].join('\n'),
    );
    chmodSync(wrapperPath, 0o755);

    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.shellPassthrough = {
      mode: 'path',
      executable: wrapperPath,
      family: 'posix',
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit("!printf 'MC_CONFIGURED_SETTINGS_COMMAND=ok\\n'");
    await runtime.waitForScreenText(/MC_CONFIGURED_SETTINGS_SHELL arg0=-c command=printf/i, terminal, 8_000);
    await runtime.waitForScreenText(/MC_CONFIGURED_SETTINGS_COMMAND=ok/i, terminal, 8_000);
    await runtime.waitForScreenText(/✓/i, terminal, 8_000);
    expect(terminal.serialize().view).not.toMatch(/MC_ENV_OVERRIDE_SHELL/i);
    runtime.printScreen('after configured settings shell passthrough', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};

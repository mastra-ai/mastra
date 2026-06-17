import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const shellPassthroughEnvOverrideScenario: McE2eScenario = {
  name: 'shell-passthrough-env-override',
  description: 'Verify MASTRACODE_SHELL overrides persisted shell passthrough settings in the real TUI ! path.',
  testName: 'uses MASTRACODE_SHELL env overrides before persisted shell passthrough settings',
  env({ appDataDir }) {
    return {
      MASTRACODE_SHELL: join(appDataDir, 'env-shell-wrapper.sh'),
      MASTRACODE_SHELL_MODE: 'path',
    };
  },
  prepare({ appDataDir }) {
    const envWrapperPath = join(appDataDir, 'env-shell-wrapper.sh');
    writeFileSync(
      envWrapperPath,
      ['#!/bin/sh', 'printf "MC_ENV_OVERRIDE_SHELL arg0=%s command=%s\\n" "$1" "$2"', 'exec /bin/sh "$@"', ''].join(
        '\n',
      ),
    );
    chmodSync(envWrapperPath, 0o755);

    const settingsWrapperPath = join(appDataDir, 'settings-shell-wrapper.sh');
    writeFileSync(
      settingsWrapperPath,
      [
        '#!/bin/sh',
        'printf "MC_SETTINGS_SHOULD_NOT_RUN arg0=%s command=%s\\n" "$1" "$2"',
        'exec /bin/sh "$@"',
        '',
      ].join('\n'),
    );
    chmodSync(settingsWrapperPath, 0o755);

    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.shellPassthrough = {
      mode: 'path',
      executable: settingsWrapperPath,
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

    terminal.submit("!printf 'MC_ENV_OVERRIDE_COMMAND=ok\\n'");
    await runtime.waitForScreenText(/MC_ENV_OVERRIDE_SHELL arg0=-c command=printf/i, terminal, 8_000);
    await runtime.waitForScreenText(/MC_ENV_OVERRIDE_COMMAND=ok/i, terminal, 8_000);
    await runtime.waitForScreenText(/✓/i, terminal, 8_000);
    expect(terminal.serialize().view).not.toMatch(/MC_SETTINGS_SHOULD_NOT_RUN/i);
    runtime.printScreen('after env override shell passthrough', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};

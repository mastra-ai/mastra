import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from './expect.js';

import type { McE2eScenario } from './types.js';

const DEBUG_SENTINEL = 'MC_E2E_DEBUG_LOG_SENTINEL';
export const debugLoggingScenario: McE2eScenario = {
  name: 'debug-logging',
  description: 'Launch the real TUI with MASTRA_DEBUG=1 and verify warnings are captured in app-data debug.log.',
  testName: 'captures opt-in debug warnings without leaking them into the TUI',
  env({ appDataDir }) {
    return {
      MASTRA_DEBUG: '1',
      MC_E2E_DEBUG_LOG_PATH: join(appDataDir, 'debug.log'),
    };
  },
  inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: true,
        memory: false,
        unixSocketPubSub: false,
      },
      setupDebugLogging: true,
      startupWarnings: [DEBUG_SENTINEL],
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();
    const screen = terminal.serialize().view;
    expect(screen).not.toContain(DEBUG_SENTINEL);

    terminal.keyCtrlC();

    const runConfig = JSON.parse(process.env.MC_E2E_RUNS_JSON ?? '[]').find(
      (config: { scenarioName?: string }) => config.scenarioName === 'debug-logging',
    ) as { env?: Record<string, string | null> } | undefined;
    const debugLogPath = runConfig?.env?.MC_E2E_DEBUG_LOG_PATH;
    if (!debugLogPath || !existsSync(debugLogPath)) {
      throw new Error(`Expected debug log to exist at ${debugLogPath ?? '<unset>'}`);
    }
    const log = readFileSync(debugLogPath, 'utf8');
    expect(log).toContain('[WARN]');
    expect(log).toContain(DEBUG_SENTINEL);
  },
};

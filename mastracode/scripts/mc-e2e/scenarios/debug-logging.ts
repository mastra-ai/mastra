import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from '@microsoft/tui-test';

import type { McE2ePrepareContext, McE2eScenario } from './types.js';

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
  prepare({ mastracodeDir, projectDir }: McE2ePrepareContext) {
    mkdirSync(projectDir, { recursive: true });
    const entrypoint = join(projectDir, '.mc-e2e-debug-logging-entrypoint.ts');
    const source = `import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const mastracodeDir = ${JSON.stringify(mastracodeDir)};
const { setupDebugLogging } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/debug-log.ts')).href);
const { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);
const { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);
const { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

setupDebugLogging();
console.warn(${JSON.stringify(DEBUG_SENTINEL)});

const result = await createMastraCode({
  cwd: process.cwd(),
  disableMcp: true,
  disableHooks: true,
  unixSocketPubSub: false,
  memory: false,
});

const tui = new MastraTUI({
  harness: result.harness,
  hookManager: result.hookManager,
  authStorage: result.authStorage,
  mcpManager: result.mcpManager,
  appName: 'Mastra Code',
  version: getCurrentVersion(),
  inlineQuestions: true,
});

void tui.run().catch(error => {
  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');
  process.exit(1);
});
`;
    writeFileSync(entrypoint, source, 'utf8');
  },
  entrypoint({ projectDir }) {
    return join(projectDir, '.mc-e2e-debug-logging-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
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

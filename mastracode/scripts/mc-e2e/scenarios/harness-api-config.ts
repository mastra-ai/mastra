import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

const CONFIG_DIR = '.harness-api-e2e';
const WRONG_CONFIG_DIR = '.wrong-harness-api-e2e';

export const harnessApiConfigScenario: McE2eScenario = {
  name: 'harness-api-config',
  description: 'Launch a custom createMastraCode entrypoint and verify public config reaches the real TUI.',
  testName: 'honors createMastraCode configDir and initialState in the TUI',
  projectFixture: 'long-branch',
  prepare({ mastracodeDir, projectDir }) {
    const configRoot = join(projectDir, CONFIG_DIR);
    const wrongConfigRoot = join(projectDir, WRONG_CONFIG_DIR);
    mkdirSync(join(configRoot, 'commands'), { recursive: true });
    mkdirSync(join(wrongConfigRoot, 'commands'), { recursive: true });

    writeFileSync(
      join(configRoot, 'commands', 'harness-api.md'),
      `---\ndescription: Harness API configDir command\n---\nCommand loaded from configured harness API config dir\n`,
    );
    writeFileSync(
      join(wrongConfigRoot, 'commands', 'wrong-harness-api.md'),
      `---\ndescription: Wrong initialState configDir command\n---\nThis command should not load\n`,
    );

    writeFileSync(
      join(projectDir, '.mc-e2e-harness-api-entrypoint.ts'),
      `import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const mastracodeDir = ${JSON.stringify(mastracodeDir)};
const { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);
const { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);
const { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const result = await createMastraCode({
  cwd: process.cwd(),
  configDir: '${CONFIG_DIR}',
  disableMcp: true,
  disableHooks: true,
  unixSocketPubSub: false,
  memory: false,
  initialState: {
    yolo: false,
    configDir: '${WRONG_CONFIG_DIR}',
  },
});

const tui = new MastraTUI({
  harness: result.harness,
  hookManager: result.hookManager,
  authStorage: result.authStorage,
  mcpManager: result.mcpManager,
  appName: 'Harness API Code',
  version: getCurrentVersion(),
  inlineQuestions: true,
});

void tui.run().catch(error => {
  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');
  process.exit(1);
});
`,
    );
  },
  entrypoint({ projectDir }) {
    return join(projectDir, '.mc-e2e-harness-api-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Harness API Code|Project:|Resource ID:/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('/help');
    await runtime.waitForScreenText(/Custom Commands/i, terminal);
    await runtime.waitForScreenText(/\/\/harness-api/i, terminal);
    await runtime.waitForScreenText(/Harness API configDir command/i, terminal);
    const helpScreen = terminal.serialize().view;
    expect(helpScreen).not.toMatch(/wrong-harness-api/i);
    expect(helpScreen).not.toMatch(/Wrong initialState configDir command/i);
    runtime.printScreen('after /help', terminal);

    terminal.submit('/yolo');
    await runtime.waitForScreenText(/YOLO mode ON/i, terminal);
    await runtime.waitForScreenText(/tools auto-approved/i, terminal);
    runtime.printScreen('after /yolo', terminal);

    terminal.keyCtrlC();
    await runtime.sleep(300);
    runtime.printScreen('after Ctrl-C', terminal);
  },
};

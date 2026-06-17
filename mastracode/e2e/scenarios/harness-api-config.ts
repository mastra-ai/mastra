import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const CONFIG_DIR = '.harness-api-e2e';
const WRONG_CONFIG_DIR = '.wrong-harness-api-e2e';

export const harnessApiConfigScenario: McE2eScenario = {
  name: 'harness-api-config',
  description: 'Launch a custom createMastraCode entrypoint and verify public config reaches the real TUI.',
  testName: 'honors createMastraCode configDir and initialState in the TUI',
  projectFixture: 'long-branch',
  prepare({ projectDir }) {
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

  },
  inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      config: {
        configDir: CONFIG_DIR,
        disableHooks: true,
        disableMcp: true,
        initialState: {
          configDir: WRONG_CONFIG_DIR,
          yolo: false,
        },
        memory: false,
        unixSocketPubSub: false,
      },
      tui: {
        appName: 'Harness API Code',
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await expect(terminal.getByText(/Harness API Code|Project:|Resource ID:/gi, { full: true, strict: false })).toBeVisible();
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
    runtime.printScreen('after Ctrl-C', terminal);
  },
};

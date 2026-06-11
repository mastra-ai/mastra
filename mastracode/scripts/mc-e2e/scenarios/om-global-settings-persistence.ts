import type { McE2eScenario } from './types.js';

export const omGlobalSettingsPersistenceScenario: McE2eScenario = {
  name: 'om-global-settings-persistence',
  description: 'Verify /om changes persist to global settings and current thread metadata through the real TUI.',
  testName: 'persists OM caveman and attachment settings globally and on the active thread',
  useOpenAIModel: true,
  aimockFixture: 'om-global-settings-persistence.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('Create OM settings persistence thread.');
    await runtime.waitForScreenText(/OM settings thread ready\./i, terminal, 12_000);

    terminal.submit('/om');
    await runtime.waitForScreenText(/Observational Memory Settings/i, terminal, 8_000);
    await runtime.waitForScreenText(/Caveman observations\s+Off/i, terminal, 8_000);
    await runtime.waitForScreenText(/Observe attachments\s+Auto/i, terminal, 8_000);

    terminal.write('\x1b[B'.repeat(4));
    await runtime.sleep(250);
    terminal.write('\r');
    await runtime.waitForScreenText(/Caveman-style terse compression/i, terminal, 8_000);
    terminal.write('\x1b[A');
    await runtime.sleep(200);
    terminal.write('\r');
    await runtime.waitForScreenText(/Caveman observations\s+On/i, terminal, 8_000);

    terminal.write('\x1b[B');
    await runtime.sleep(250);
    terminal.write('\r');
    await runtime.waitForScreenText(/Always forward attachments/i, terminal, 8_000);
    terminal.write('\x1b[B');
    await runtime.sleep(200);
    terminal.write('\r');
    await runtime.waitForScreenText(/Observe attachments\s+On/i, terminal, 8_000);

    terminal.write('\x1b');
    await runtime.sleep(300);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("OM_GLOBAL_CAVEMAN="+s.models.omCavemanObservations); console.log("OM_GLOBAL_ATTACH="+s.models.omObserveAttachments)'`,
    );
    await runtime.waitForScreenText(/OM_GLOBAL_CAVEMAN=true/i, terminal, 8_000);
    await runtime.waitForScreenText(/OM_GLOBAL_ATTACH=true/i, terminal, 8_000);

    terminal.submit(
      `!sqlite3 "$MASTRA_DB_PATH" "select 'OM_THREAD_KEYS=' || (instr(metadata,'cavemanObservations')>0) || ':' || (instr(metadata,'observeAttachments')>0) from mastra_threads where instr(metadata,'cavemanObservations')>0 limit 1"`,
    );
    await runtime.waitForScreenText(/OM_THREAD_KEYS=1:1/i, terminal, 8_000);

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 1) {
      throw new Error(`Expected OM settings persistence scenario to make 1 AIMock request, received ${requests.length}`);
    }
  },
};

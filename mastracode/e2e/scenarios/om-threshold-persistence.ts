import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const omThresholdPersistenceScenario: McE2eScenario = {
  name: 'om-threshold-persistence',
  description: 'Persists OM observation/reflection thresholds globally and on the active thread through the real TUI.',
  testName: 'restores and updates OM threshold settings through /om',
  useOpenAIModel: true,
  aimockFixture: 'om-threshold-persistence.json',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      quietModePreferenceSelected: true,
    };
    settings.models = {
      ...settings.models,
      omObservationThreshold: 12_000,
      omReflectionThreshold: 80_000,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('Create OM threshold persistence thread.');
    await runtime.waitForScreenText(/OM threshold thread ready\./i, terminal, 12_000);

    terminal.submit('/om');
    await runtime.waitForScreenText(/Observational Memory Settings/i, terminal, 8_000);
    await runtime.waitForScreenText(/Observation threshold\s+12k/i, terminal, 8_000);
    await runtime.waitForScreenText(/Reflection threshold\s+80k/i, terminal, 8_000);

    terminal.write('\x1b[B'.repeat(2));
    terminal.write('\r');
    await runtime.waitForScreenText(/Observation Threshold/i, terminal, 8_000);
    terminal.write('15');
    terminal.write('\r');
    await runtime.waitForScreenText(/Observation threshold\s+15k/i, terminal, 8_000);
    await runtime.waitForScreenTextAbsent(/_k tokens/i, terminal, 8_000);

    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Reflection Threshold/i, terminal, 8_000);
    terminal.write('60');
    terminal.write('\r');
    await runtime.waitForScreenText(/Reflection threshold\s+60k/i, terminal, 8_000);
    await runtime.waitForScreenTextAbsent(/_k tokens/i, terminal, 8_000);

    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Observational Memory Settings/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("OM_THRESH_GLOBAL="+s.models.omObservationThreshold+":"+s.models.omReflectionThreshold)'`,
    );
    await runtime.waitForScreenText(/OM_THRESH_GLOBAL=15000:60000/i, terminal, 8_000);

    terminal.submit(
      `!sqlite3 "$MASTRA_DB_PATH" "select 'OM_THRESH_THREAD=' || (instr(hex(metadata),'6F62736572766174696F6E5468726573686F6C64')>0) || ':' || (instr(hex(metadata),'3135303030')>0) || ':' || (instr(hex(metadata),'7265666C656374696F6E5468726573686F6C64')>0) || ':' || (instr(hex(metadata),'3630303030')>0) from mastra_threads where instr(hex(metadata),'6F62736572766174696F6E5468726573686F6C64')>0 limit 1"`,
    );
    await runtime.waitForScreenText(/OM_THRESH_THREAD=1:1:1:1/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 1) {
      throw new Error(`Expected OM threshold persistence scenario to make 1 AIMock request, received ${requests.length}`);
    }
  },
};

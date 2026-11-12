import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';

import type { McE2eScenario } from './types.js';

export const backgroundSubagentDeferredScenario = {
  name: 'background-subagent-deferred',
  description: 'Run a subagent as a deferred background task and wake the parent with its completion.',
  testName: 'keeps the parent working while a background subagent runs, then reports it finished',
  useOpenAIModel: true,
  aimockFixture: 'background-subagent-deferred.json',
  prepare({ appDataDir }) {
    const path = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(path, 'utf8'));
    settings.backgroundTools = { enabled: true };
    settings.preferences = { ...settings.preferences, subagentsEnabled: true };
    writeFileSync(path, JSON.stringify(settings, null, 2));
  },
  inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({ config: { disableHooks: true, disableMcp: true, unixSocketPubSub: false } });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    terminal.resize(140, 80);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit('Delegate the audit in the background.');
    await runtime.waitForOutputText(/PARENT_KEEPS_WORKING/, terminal, 30_000);
    await runtime.waitForOutputText(/SAW_SUBAGENT_RESULT/, terminal, 30_000);
    await runtime.waitForScreenText(/↳ Explore finished · Audit the auth module and report the marker\./, terminal);
    await runtime.waitForScreenText(/subagent explore .*✓ background/, terminal);
    // A finished background box stays compact; its result is one keypress away.
    expect(terminal.serialize().view).not.toContain('AUDIT_RESULT_MARKER');

    terminal.write('\x07');
    await runtime.waitForScreenText(/✓ ◆ explore: Audit the auth module/, terminal, 10_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/AUDIT_RESULT_MARKER/, terminal, 10_000);
    expect(terminal.serialize().view).not.toContain('UNEXPECTED_MODEL_CALL');

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests);
    // The completion notice wakes the parent, which reads the result from the original call.
    expect(serialized).toContain('Background Explore subagent finished');
    expect(serialized).toContain('AUDIT_RESULT_MARKER');
  },
} satisfies McE2eScenario;

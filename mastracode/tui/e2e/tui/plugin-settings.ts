import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

let pluginDir: string;
let dataDir: string;
export const pluginSettingsScenario: McE2eScenario = {
  name: 'plugin-settings',
  description: 'Edit, save and cancel a native plugin settings form without model requests.',
  testName: 'persists native settings through real TUI controls without calling a model',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'plugin-settings.json',
  expectedAimockRequests: 0,
  prepare({ projectDir, homeDir }) {
    pluginDir = join(projectDir, 'settings-plugin');
    dataDir = join(homeDir, '.mastracode', 'plugin-data', 'proof.settings');
    mkdirSync(pluginDir, { recursive: true });
    cpSync(new URL('../fixtures/plugin-settings/plugin.ts', import.meta.url), join(pluginDir, 'index.ts'));
  },
  inProcessApp({ startMastraCodeApp, projectDir }) {
    return startMastraCodeApp({
      onCreated: async result => {
        await result.pluginManager!.installLocal(pluginDir, 'project');
        await result.session.thread.create();
        await result.session.thread.rename({ title: 'Settings proof thread' });
        await result.session.thread.setSetting({ key: 'projectPath', value: projectDir });
      },
    });
  },
  async run({ terminal, runtime }) {
    await runtime.waitForScreenText(/Resource ID:/, terminal);
    terminal.submit('/settings-proof');
    await runtime.waitForScreenText(/Native settings proof/, terminal);
    runtime.printScreen('native form', terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Enabled: On/, terminal);
    terminal.write('\x1b[B\r');
    await runtime.waitForScreenText(/Question/, terminal);
    terminal.write('\x01\x0bsaved label\r');
    await runtime.waitForScreenText(/Label: saved label/, terminal);
    terminal.write('\x1b[B\x1b[B\r');
    await runtime.waitForScreenText(/Skip/, terminal);
    terminal.write('\x1b[B\r');
    await runtime.waitForScreenText(/Policy: Send/, terminal);
    terminal.write('\x1b[B\x1b[B\x1b[B\r');
    await runtime.waitForScreenText(/Saved/, terminal);
    runtime.printScreen('saved settings', terminal);
    const persisted = () => JSON.parse(readFileSync(join(dataDir, readdirSync(dataDir)[0]!), 'utf8'));
    assert.deepEqual(persisted(), { enabled: true, label: 'saved label', policy: 'send' });
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Native settings proof/, terminal);
    terminal.submit('/settings-proof');
    await runtime.waitForScreenText(/Label: saved label/, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Enabled: Off/, terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Native settings proof/, terminal);
    terminal.submit('/settings-proof');
    await runtime.waitForScreenText(/Enabled: On/, terminal);
    assert.equal(persisted().enabled, true);
    runtime.printScreen('cancel preserved saved settings', terminal);
    terminal.write('\x1b');
  },
  verifyAimockRequests(requests) {
    assert.equal(requests.length, 0);
  },
};

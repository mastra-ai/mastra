import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const externalFixtureDir = '/tmp/mastracode-request-access-e2e';
const externalFixtureFile = join(externalFixtureDir, 'allowed.txt');
const externalFixtureText = 'REQUEST_ACCESS_E2E_GRANTED_FILE';

export const requestAccessModalScenario: McE2eScenario = {
  name: 'request-access-modal',
  description: 'Exercise request_access approval and same-turn allowed-path use through the real TUI.',
  testName: 'approves request_access and reads the granted external path in the real TUI',
  skipReason: 'current main no longer renders the request_access granted confirmation after approval',
  useOpenAIModel: true,
  aimockFixture: 'request-access-modal.json',
  prepare() {
    rmSync(externalFixtureDir, { recursive: true, force: true });
    mkdirSync(externalFixtureDir, { recursive: true });
    writeFileSync(externalFixtureFile, `${externalFixtureText}\n`, 'utf8');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await runtime.waitForScreenText(/Mastra Code|Build|Plan|Fast|Type|Press|>/i, terminal);

    terminal.submit('Request access to the external e2e fixture and read it.');
    await runtime.waitForScreenText(/request_access.*\/tmp\/mastracode-request-access-e2e/i, terminal);
    await runtime.waitForScreenText(/Grant sandbox access to "\/tmp\/mastracode-request-access-e2e"\?/i, terminal);
    await runtime.waitForScreenText(/Reason: Read deterministic request_access e2e fixture outside the project root\./i, terminal);
    await runtime.waitForScreenText(/Yes.*Allow access to this directory/i, terminal);
    runtime.printScreen('request access prompt visible', terminal);

    terminal.write('\r');

    await runtime.waitForScreenText(/Access granted: "\/tmp\/mastracode-request-access-e2e"/i, terminal);
    await runtime.waitForScreenText(/view \/tmp\/mastracode-request-access-e2e\/allowed\.txt/i, terminal);
    await runtime.waitForScreenText(/REQUEST_ACCESS_E2E_GRANTED_FILE/i, terminal);
    await runtime.waitForScreenText(/Request access e2e complete\./i, terminal);
    runtime.printScreen('after granted read', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};

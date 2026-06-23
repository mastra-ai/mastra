import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const doubleSlashAutocompleteFilterScenario = {
  name: 'double-slash-autocomplete-filter',
  description: 'Narrows // autocomplete to custom slash commands only.',
  testName: 'shows only custom slash commands when autocomplete is opened with //',
  projectFixture: 'long-branch',
  prepare({ projectDir }) {
    const commandsDir = join(projectDir, '.mastracode', 'commands');
    mkdirSync(commandsDir, { recursive: true });
    writeFileSync(
      join(commandsDir, 'custom-alpha.md'),
      `---\ndescription: Custom alpha double slash autocomplete sentinel\n---\nAlpha custom command.\n`,
    );
    writeFileSync(
      join(commandsDir, 'custom-bravo.md'),
      `---\ndescription: Custom bravo double slash autocomplete sentinel\n---\nBravo custom command.\n`,
    );
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project: project/i, terminal);

    terminal.write('//');
    await runtime.waitForScreenText(/Custom alpha double slash autocomplete sentinel/i, terminal, 8_000);
    await runtime.waitForScreenText(/Custom bravo double slash autocomplete sentinel/i, terminal, 8_000);
    await runtime.waitForScreenTextAbsent(/Start a new thread/i, terminal, 1_000);
    await runtime.waitForScreenTextAbsent(/Switch model pack/i, terminal, 1_000);
    runtime.printScreen('double slash custom command autocomplete filter', terminal);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 0) {
      throw new Error(`Expected no AIMock requests for autocomplete-only scenario, received ${requests.length}`);
    }
  },
} satisfies McE2eScenario;

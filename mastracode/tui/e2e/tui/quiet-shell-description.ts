import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const quietShellDescriptionScenario: McE2eScenario = {
  name: 'quiet-shell-description',
  description:
    'Verify quiet mode shows the execute_command description in place of the raw command, and Ctrl+E reveals the command.',
  testName: 'shows the shell command description in quiet mode and the command when expanded',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'quiet-shell-description.json',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = { ...settings.onboarding, quietModePreferenceSelected: true };
    settings.preferences = { ...settings.preferences, quietMode: true, quietModeMaxToolPreviewLines: 2 };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:/i, terminal);

    terminal.submit('Run the described shell command.');
    await runtime.waitForScreenText(/Quiet shell description complete\./i, terminal, 20_000);
    await runtime.waitForScreenText(/✓ Printing the quiet description marker/i, terminal, 5_000);
    await runtime.waitForScreenText(/quiet-description-output/i, terminal, 5_000);
    const view = terminal.serialize().view;
    expect(view).not.toMatch(/\$ printf/);
    // The output preview sits above the box's `$ <path>` header, which sits above the row
    const previewAt = view.search(/│ quiet-description-output/);
    const headerAt = view.search(/│ \$ /);
    const rowAt = view.search(/✓ Printing the quiet description marker/);
    if (!(previewAt >= 0 && previewAt < headerAt && headerAt < rowAt)) {
      throw new Error(`Expected preview, then $ header, then row; got ${previewAt}, ${headerAt}, ${rowAt}`);
    }
    runtime.printScreen('quiet shell description', terminal);

    terminal.write('\x05');
    await runtime.waitForScreenText(/\$ printf 'quiet-description-output/, terminal, 8_000);
    expect(terminal.serialize().view).not.toMatch(/Printing the quiet description marker/i);
    runtime.printScreen('expanded shell command', terminal);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const tool = requests
      .flatMap(request => ((request as any)?.body?.tools ?? []) as any[])
      .find(candidate => candidate?.function?.name === 'execute_command');
    const schema = tool?.function?.parameters;
    if (!schema) throw new Error('Expected AIMock request to include the execute_command tool schema');
    // Mastra Code turns on requireDescription, so the model sees description first and required.
    const firstArg = Object.keys(schema.properties ?? {})[0];
    if (firstArg !== 'description') {
      throw new Error(`Expected description to be the first execute_command arg, received ${firstArg}`);
    }
    expect(schema.required).toContain('description');
    expect(schema.properties.description.description).toContain('Drilling into the first of 15 failures');
  },
};

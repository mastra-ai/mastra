import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';
import { typeTextSlowly } from './typing-utils.js';

function expectTracking(terminal: Parameters<McE2eScenario['run']>[0]['terminal'], expected: string, when: string) {
  const mode = terminal.mouseTracking?.();
  if (mode !== expected) throw new Error(`Expected mouse tracking "${expected}" ${when}, got "${mode}"`);
}

export const mouseModalAndAutocompleteScenario = {
  name: 'mouse-modal-and-autocomplete',
  description:
    'Mouse tracking is only on while a modal or slash autocomplete is open; clicks select and wheel moves the highlight.',
  testName: 'selects a model and a slash command with the mouse and hands the mouse back to the terminal afterwards',
  prepare({ appDataDir, projectDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
    };
    settings.customProviders = [
      {
        name: 'Mouse E2E',
        url: 'http://127.0.0.1:43213/v1',
        apiKey: 'sk-mouse-e2e',
        models: ['alpha-model', 'bravo-model', 'charlie-model'],
      },
    ];
    settings.customModelPacks = [
      {
        name: 'Mouse E2E',
        models: { plan: 'mouse-e2e/alpha-model', build: 'mouse-e2e/alpha-model', fast: 'mouse-e2e/alpha-model' },
        createdAt: new Date(0).toISOString(),
      },
    ];
    settings.models = {
      ...settings.models,
      activeModelPackId: 'custom:Mouse E2E',
      modeDefaults: {},
      subagentModels: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const commandsDir = join(projectDir, '.mastracode', 'commands');
    mkdirSync(commandsDir, { recursive: true });
    writeFileSync(join(commandsDir, 'mouse-alpha.md'), '---\ndescription: Mouse alpha command\n---\nAlpha.\n');
    writeFileSync(join(commandsDir, 'mouse-bravo.md'), '---\ndescription: Mouse bravo command\n---\nBravo.\n');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/\bbuild · mouse-e2e\/alpha-model/i, terminal, 10_000);
    await terminal.flushInput?.();
    expectTracking(terminal, 'none', 'at the idle prompt');

    // Modal: wheel moves the highlight, a click selects the clicked row.
    terminal.submit('/model');
    await runtime.waitForScreenText(/Select Model/i, terminal, 8_000);
    terminal.write('mouse-e2e');
    await runtime.waitForScreenText(/mouse-e2e\/charlie-model/i, terminal, 8_000);
    await terminal.flushInput?.();
    expectTracking(terminal, 'any', 'while the model selector is open');

    const before = terminal.serialize().view.match(/→ (\S+)/)?.[1];
    terminal.wheel?.('down');
    await terminal.flushInput?.();
    await runtime.sleep(200);
    const after = terminal.serialize().view.match(/→ (\S+)/)?.[1];
    if (!before || !after || before === after) {
      throw new Error(`Expected wheel to move the highlight (before=${before}, after=${after})`);
    }

    // Hover marks the row under the pointer without moving the highlight.
    terminal.hoverText?.('mouse-e2e/charlie-model');
    await terminal.flushInput?.();
    await runtime.sleep(200);
    const hoveredView = terminal.serialize().view;
    if (!/▌\s*\S*\s*mouse-e2e\/charlie-model/.test(hoveredView) || hoveredView.match(/→ (\S+)/)?.[1] !== after) {
      throw new Error(`Expected hover marker on charlie-model with highlight still on ${after}\n\n${hoveredView}`);
    }

    terminal.clickText?.('mouse-e2e/charlie-model');
    await runtime.waitForScreenText(/Switched build mode to mouse-e2e\/charlie-model/i, terminal, 8_000);
    await runtime.waitForScreenTextAbsent(/Select Model/i, terminal, 8_000);
    await terminal.flushInput?.();
    expectTracking(terminal, 'none', 'after the model selector closed');

    // Slash autocomplete: clicking an item completes it without submitting.
    await typeTextSlowly(terminal, '/mouse-');
    await runtime.waitForScreenText(/Mouse bravo command/i, terminal, 20_000);
    await terminal.flushInput?.();
    await runtime.sleep(200);
    expectTracking(terminal, 'any', 'while slash autocomplete is open');
    runtime.printScreen('slash autocomplete before click', terminal);

    terminal.hoverText?.('Mouse bravo command');
    await terminal.flushInput?.();
    await runtime.sleep(300);
    if (!/▌.*mouse-bravo/.test(terminal.serialize().view)) {
      throw new Error(`Expected hover marker on the bravo suggestion\n\n${terminal.serialize().view}`);
    }

    terminal.clickText?.('Mouse bravo command');
    await runtime.waitForScreenTextAbsent(/Mouse alpha command/i, terminal, 8_000);
    await runtime.waitForScreenText(/\/mouse-bravo/i, terminal, 8_000);
    await terminal.flushInput?.();
    await runtime.sleep(200);
    expectTracking(terminal, 'none', 'after the autocomplete item was applied');
    runtime.printScreen('after clicking slash item', terminal);

    // /settings is a SettingsList: clicking a row opens its submenu, clicking a submenu row picks it.
    terminal.keyCtrlC();
    await runtime.waitForScreenTextAbsent(/\/mouse-bravo/i, terminal, 8_000);
    terminal.submit('/settings');
    await runtime.waitForScreenText(/Notifications/, terminal, 20_000);
    await terminal.flushInput?.();
    await runtime.sleep(200);
    terminal.clickText?.('Notifications');
    await runtime.waitForScreenText(/Terminal bell/, terminal, 8_000);
    await terminal.flushInput?.();
    await runtime.sleep(200);
    terminal.clickText?.('Terminal bell');
    await runtime.waitForScreenText(/Notifications\s+Bell/, terminal, 8_000);
    runtime.printScreen('after picking a settings value by mouse', terminal);

    terminal.keyCtrlC();
    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;

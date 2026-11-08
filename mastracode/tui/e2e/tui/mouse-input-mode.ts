import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const ALT_M = '\x1bm';

function expectTracking(terminal: Parameters<McE2eScenario['run']>[0]['terminal'], expected: string, when: string) {
  const mode = terminal.mouseTracking?.();
  if (mode !== expected) throw new Error(`Expected mouse tracking "${expected}" ${when}, got "${mode}"`);
}

export const mouseInputModeScenario = {
  name: 'mouse-input-mode',
  description:
    'Alt+M turns on mouse mode for the input box: clicks place the cursor, a drag selects and copies, and submitting turns it off.',
  testName: 'edits the prompt with the mouse while mouse mode is on and hands the mouse back on submit',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
    };
    settings.customProviders = [
      { name: 'Pointer E2E', url: 'http://127.0.0.1:43214/v1', apiKey: 'sk-pointer-e2e', models: ['alpha-model'] },
    ];
    settings.customModelPacks = [
      {
        name: 'Pointer E2E',
        models: { plan: 'pointer-e2e/alpha-model', build: 'pointer-e2e/alpha-model', fast: 'pointer-e2e/alpha-model' },
        createdAt: new Date(0).toISOString(),
      },
    ];
    settings.models = {
      ...settings.models,
      activeModelPackId: 'custom:Pointer E2E',
      modeDefaults: {},
      subagentModels: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/\bbuild · pointer-e2e\/alpha-model/i, terminal, 10_000);
    await terminal.flushInput?.();
    expectTracking(terminal, 'none', 'at startup (mouse mode always starts off)');

    terminal.write('hello brave world');
    await runtime.waitForScreenText(/hello brave world/, terminal, 8_000);
    terminal.write(ALT_M);
    await runtime.waitForScreenText(/pointer-e2e\/alpha-model.*\bmouse\b/, terminal, 8_000);
    await terminal.flushInput?.();
    expectTracking(terminal, 'any', 'after Alt+M');

    // A click mid-text places the cursor there.
    terminal.clickText?.('world');
    await terminal.flushInput?.();
    await runtime.sleep(200);
    terminal.write('big ');
    await runtime.waitForScreenText(/hello brave big world/, terminal, 8_000);

    // Dragging over a word copies it through OSC 52, and typing replaces it.
    terminal.dragText?.('brave', 0, 5);
    await terminal.flushInput?.();
    await runtime.sleep(300);
    const copied = terminal.clipboardWrites?.() ?? [];
    if (copied.at(-1) !== 'brave')
      throw new Error(`Expected "brave" copied through OSC 52, got ${JSON.stringify(copied)}`);
    terminal.write('bold');
    await runtime.waitForScreenText(/hello bold big world/, terminal, 8_000);
    runtime.printScreen('after editing with the mouse', terminal);

    // Alt+M again turns it off.
    terminal.write(ALT_M);
    await runtime.waitForScreenTextAbsent(/pointer-e2e\/alpha-model.*\bmouse\b/, terminal, 8_000);
    await terminal.flushInput?.();
    expectTracking(terminal, 'none', 'after the second Alt+M');

    // Submitting a message turns mouse mode off.
    terminal.write(ALT_M);
    await runtime.waitForScreenText(/pointer-e2e\/alpha-model.*\bmouse\b/, terminal, 8_000);
    await terminal.flushInput?.();
    expectTracking(terminal, 'any', 'after turning mouse mode back on');
    terminal.write('\r');
    await runtime.waitForScreenTextAbsent(/pointer-e2e\/alpha-model.*\bmouse\b/, terminal, 8_000);
    await terminal.flushInput?.();
    expectTracking(terminal, 'none', 'after submitting');

    terminal.keyCtrlC();
    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;

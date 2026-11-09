import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const AUTO = /alpha-model.*mouse mode: auto/;
const OFF = /alpha-model.*mouse mode: off/;

function expectTracking(terminal: Parameters<McE2eScenario['run']>[0]['terminal'], expected: string, when: string) {
  const mode = terminal.mouseTracking?.();
  if (mode !== expected) throw new Error(`Expected mouse tracking "${expected}" ${when}, got "${mode}"`);
}

export const mouseInputModeScenario = {
  name: 'mouse-input-mode',
  description:
    'With the Mouse setting at "Input box only", typing or editing captures the mouse for the input box (clicks place the cursor, a drag selects and copies); a wheel tick, an outside click or submitting hands it back.',
  testName:
    'opts in through /settings, edits the prompt with the mouse and hands the mouse back on wheel, outside click and submit',
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

    // Off by default: typing leaves the mouse with the terminal and no indicator shows.
    terminal.write('draft');
    await runtime.waitForScreenText(/→ draft/, terminal, 8_000);
    await terminal.flushInput?.();
    await runtime.sleep(200);
    expectTracking(terminal, 'none', 'while typing with the setting off');
    if (/mouse mode/.test(terminal.serialize().view)) throw new Error('Mouse mode indicator shown before opting in');
    for (let i = 0; i < 5; i++) terminal.write('\x7f');
    await runtime.waitForScreenTextAbsent(/→ draft/, terminal, 8_000);

    // Opt in through /settings with the keyboard: dialogs are not opted in, so /settings leaves the mouse alone.
    terminal.submit('/settings');
    await runtime.waitForScreenText(/Mouse\s+Off/, terminal, 8_000);
    await terminal.flushInput?.();
    expectTracking(terminal, 'none', 'while /settings is open with dialog mouse off');
    for (let i = 0; i < 20 && !/→\s*Mouse\b/.test(terminal.serialize().view); i++) {
      terminal.write('\x1b[B');
      await terminal.flushInput?.();
      await runtime.sleep(50);
    }
    terminal.write('\r');
    await runtime.waitForScreenText(/Dialogs \+ input box/, terminal, 8_000);
    terminal.write('\x1b[B\x1b[B\r');
    await runtime.waitForScreenText(/Mouse\s+Input box only/, terminal, 8_000);
    await terminal.flushInput?.();
    expectTracking(terminal, 'none', 'in /settings after opting in to the input box only');
    terminal.write('\x1b');
    await runtime.waitForScreenText(OFF, terminal, 8_000);
    await terminal.flushInput?.();
    expectTracking(terminal, 'none', 'after opting in, before typing');

    // Typing turns mouse mode on.
    terminal.write('hello brave world');
    await runtime.waitForScreenText(AUTO, terminal, 8_000);
    await terminal.flushInput?.();
    expectTracking(terminal, 'any', 'after typing');

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

    // The first wheel tick hands the wheel back to the terminal; typing takes the mouse again.
    terminal.wheel?.('up');
    await runtime.waitForScreenText(OFF, terminal, 8_000);
    await terminal.flushInput?.();
    expectTracking(terminal, 'none', 'after a wheel tick');
    terminal.write('!');
    await runtime.waitForScreenText(AUTO, terminal, 8_000);

    // A click outside the input box hands the mouse back too; an editing key takes it again.
    terminal.clickText?.('build · ');
    await runtime.waitForScreenText(OFF, terminal, 8_000);
    await terminal.flushInput?.();
    expectTracking(terminal, 'none', 'after clicking outside the input box');
    await runtime.waitForScreenText(/hello bold! big world/, terminal, 8_000);
    terminal.write('\x1b[D');
    await runtime.waitForScreenText(AUTO, terminal, 8_000);

    // Submitting turns mouse mode off.
    terminal.write('\r');
    await runtime.waitForScreenText(OFF, terminal, 8_000);
    await terminal.flushInput?.();
    expectTracking(terminal, 'none', 'after submitting');

    terminal.keyCtrlC();
    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;

import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const stateCommandsScenario: McE2eScenario = {
  name: 'state-commands',
  description:
    'Exercise visible mode, thinking, permissions, sandbox, resource, cost, observability, and feedback surfaces.',
  testName: 'shows state command feedback in the real TUI',
  env: () => ({ MASTRACODE_MODEL_ID: 'openai/gpt-5.6-codex' }),
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('/mode');
    await runtime.waitForScreenText(/Modes:/i, terminal);
    await runtime.waitForScreenText(/\*\s+build|build\s+-/i, terminal);
    runtime.printScreen('after /mode', terminal);

    terminal.submit('/think status');
    await runtime.waitForScreenText(/Thinking:/i, terminal);
    runtime.printScreen('after /think status', terminal);

    // Direct maximum-effort override — the response must identify the session override.
    terminal.submit('/think max');
    await runtime.waitForScreenText(/Thinking: Max \(session override\)/i, terminal);
    runtime.printScreen('after /think max', terminal);

    // Clearing the override reports the inherited configured default with its source.
    terminal.submit('/think default');
    await runtime.waitForScreenText(/Thinking → .+\((?:.+ mode default|global default)\)/i, terminal);
    runtime.printScreen('after /think default', terminal);

    // Change the global default through the real Settings overlay, then verify
    // this session inherits it without a session override.
    terminal.submit('/settings');
    await runtime.waitForScreenText(/Thinking level\s+(?:none|Off)/i, terminal);
    terminal.write('\x1b[B'.repeat(2));
    terminal.write('\r');
    await runtime.waitForScreenText(/Balanced reasoning/i, terminal);
    terminal.write('\x1b[B'.repeat(2));
    terminal.write('\r');
    await runtime.waitForScreenText(/Thinking level\s+Medium/i, terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Settings/i, terminal, 8_000);
    terminal.submit('/think status');
    await runtime.waitForScreenText(/Thinking: Medium \(global default\)/i, terminal);
    runtime.printScreen('after inherited Settings default', terminal);

    terminal.submit('/permissions');
    await runtime.waitForScreenText(/Tool Approval Permissions/i, terminal);
    await runtime.waitForScreenText(/Category Policies:/i, terminal);
    runtime.printScreen('after /permissions', terminal);

    terminal.submit('/yolo');
    await runtime.waitForScreenText(/YOLO mode (ON|OFF)/i, terminal);
    await runtime.waitForScreenText(/tools (auto-approved|require approval)/i, terminal);
    runtime.printScreen('after /yolo', terminal);

    terminal.submit('/cost');
    await runtime.waitForScreenText(/Token Usage \(Current Thread\):/i, terminal);
    runtime.printScreen('after /cost', terminal);

    terminal.submit('/resource');
    await runtime.waitForScreenText(/Current:/i, terminal);
    await runtime.waitForScreenText(/Known resource IDs:/i, terminal);
    runtime.printScreen('after /resource', terminal);

    terminal.submit('/resource mc-e2e-alt-resource');
    await runtime.waitForScreenText(/Switched to resource: mc-e2e-alt-resource/i, terminal);
    await runtime.waitForScreenText(/no existing threads, a new one will be created/i, terminal);
    runtime.printScreen('after /resource switch', terminal);

    terminal.submit('/resource reset');
    await runtime.waitForScreenText(/Resource ID reset to:/i, terminal);
    runtime.printScreen('after /resource reset', terminal);

    terminal.submit('/sandbox add /path/that/does/not/exist');
    await runtime.waitForScreenText(/Path does not exist:/i, terminal);
    runtime.printScreen('after /sandbox add missing path', terminal);

    terminal.submit('/observability local');
    await runtime.waitForScreenText(/Local DuckDB tracing is currently/i, terminal);
    await runtime.waitForScreenText(/\/observability local on/i, terminal);
    runtime.printScreen('after /observability local', terminal);

    terminal.submit('/feedback up');
    await runtime.waitForScreenText(/No active session to attach feedback to/i, terminal);
    runtime.printScreen('after /feedback without session', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};

import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import { selectMenuRow } from './menu-navigation.js';
import type { McE2eScenario, McE2eTerminal } from './types.js';

const ARROW_DOWN = '\x1b[B';
const ARROW_UP = '\x1b[A';
const PROMPT_SUMMARY = '"ALPHA-ONE check BRAVO-TWO CHARLIE-THREE"';
const SCRIPT_SUMMARY = 'run ./check.sh + "DELTA-FOUR ECHO-FIVE"';
const PROMPT_ROW = /every 1h · (next at|paused)/;
const SCRIPT_ROW = /every 2h · (next at|paused)/;

function viewLines(terminal: McE2eTerminal): string[] {
  return terminal.serialize().view.split('\n');
}

function failWithScreen(step: string, problems: Array<string | false>, lines: string[]): void {
  const found = problems.filter(Boolean);
  if (found.length > 0) throw new Error(`${step}: ${found.join('; ')}\n--- screen ---\n${lines.join('\n')}`);
}

/** Every schedule occupies exactly one picker row, with its whole source summary on that row. */
function expectOneRowPerSchedule(terminal: McE2eTerminal, step: string): void {
  const lines = viewLines(terminal);
  const promptRows = lines.filter(line => PROMPT_ROW.test(line));
  const scriptRows = lines.filter(line => SCRIPT_ROW.test(line));
  failWithScreen(
    step,
    [
      promptRows.length !== 1 && `expected 1 "every 1h" row, saw ${promptRows.length}`,
      scriptRows.length !== 1 && `expected 1 "every 2h" row, saw ${scriptRows.length}`,
      !promptRows[0]?.includes(PROMPT_SUMMARY) && `prompt row should read ${PROMPT_SUMMARY}`,
      !scriptRows[0]?.includes(SCRIPT_SUMMARY) && `script row should read ${SCRIPT_SUMMARY}`,
    ],
    lines,
  );
}

async function pressAndSettle(terminal: McE2eTerminal, key: string): Promise<void> {
  const before = terminal.serialize().view;
  terminal.write(key);
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline && terminal.serialize().view === before) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  // Let any trailing redraw from the same keypress land before inspecting rows.
  await new Promise(resolve => setTimeout(resolve, 100));
}

export const schedulesMultilinePromptScenario: McE2eScenario = {
  name: 'schedules-multiline-prompt',
  description:
    'Have the agent create schedules whose prompt and extra prompt span several lines, arrow through /schedules, then fire one and verify every schedule summary (picker rows, manage dialog, transcript header) stays on one line.',
  testName: 'summarizes schedules with multi-line prompts on one line in the picker and transcript',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'schedules-multiline-prompt.json',
  prepare({ projectDir }) {
    const scriptPath = join(projectDir, 'check.sh');
    writeFileSync(scriptPath, '#!/bin/sh\necho ok\n');
    chmodSync(scriptPath, 0o755);
  },
  inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: true,
        unixSocketPubSub: false,
        scheduleTools: true,
        initialState: { yolo: true },
      },
    });
  },
  async run({ terminal, runtime }) {
    // Picker rows are truncated to the overlay width, and the label's length depends on the
    // clock ("next at 16:00:00 (in 5s)" vs "next at Nov 12 00:00:00 (in 59m 59s)"). A fixed wide
    // terminal leaves room for the longest label plus the whole summary, whatever the time or
    // MC_E2E_COLUMNS. Newlines in a summary still break a row at any width.
    terminal.resize(160, 40);
    runtime.startLiveOutput(terminal);

    await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();

    terminal.submit('Schedule the multi-line checks.');
    await runtime.waitForScreenText(/Multi-line schedules created\./i, terminal, 30_000);

    terminal.submit('/schedules');
    await runtime.waitForScreenText(/Schedules on this thread \(2\)/i, terminal);
    expectOneRowPerSchedule(terminal, 'picker opened');

    // Highlight moves redraw the picker in place; a row that spans several
    // terminal lines makes those redraws land on the wrong lines.
    for (let step = 1; step <= 3; step++) {
      await pressAndSettle(terminal, ARROW_DOWN);
      expectOneRowPerSchedule(terminal, `after arrow down ${step}`);
    }
    for (let step = 1; step <= 2; step++) {
      await pressAndSettle(terminal, ARROW_UP);
      expectOneRowPerSchedule(terminal, `after arrow up ${step}`);
    }
    runtime.printScreen('after navigating schedules', terminal);

    await selectMenuRow(terminal, PROMPT_ROW);
    await runtime.waitForScreenText(/Run now/i, terminal);
    const manageLines = viewLines(terminal);
    failWithScreen(
      'manage dialog',
      [
        !manageLines.some(line => /Schedule [0-9a-f]{8}: every 1h —/.test(line) && line.includes(PROMPT_SUMMARY)) &&
          `manage dialog should summarize the schedule as ${PROMPT_SUMMARY} on one line`,
      ],
      manageLines,
    );
    await selectMenuRow(terminal, /Run now/);
    await runtime.waitForScreenText(/Multi-line schedule fire handled\./i, terminal, 60_000);
    runtime.printScreen('after multi-line fire', terminal);

    // The fired turn's header is the one-line summary; the prompt body renders below it.
    const firedLines = viewLines(terminal);
    const headers = firedLines.filter(line => /⏱ schedule [0-9a-f]{8}/.test(line));
    failWithScreen(
      'fired schedule header',
      [
        headers.length !== 1 && `expected 1 schedule header, saw ${headers.length}`,
        !headers[0]?.includes(`every 1h · ${PROMPT_SUMMARY}`) &&
          `header should read every 1h · ${PROMPT_SUMMARY} on one line`,
      ],
      firedLines,
    );

    terminal.keyCtrlC();
  },
};

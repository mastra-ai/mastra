import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';
import { typeTextSlowly } from './typing-utils.js';

const SKILL_NAME = 'tab-complete-e2e';
const SKILL_INSTRUCTIONS = 'Tab completion e2e skill instructions.';
const SKILL_ARGS = 'focus tab-accept';
const TAB = '\t';
const ENTER = '\r';

export const skillTabAutocompleteScenario = {
  name: 'skill-tab-autocomplete',
  description: 'Accepts a namespaced /skill/<name> autocomplete selection with Tab and keeps the leading slash.',
  testName: 'Tab-completing a namespaced skill keeps the leading slash so the command still dispatches',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'skill-tab-autocomplete.json',
  prepare({ projectDir }) {
    const dir = join(projectDir, '.mastracode', 'skills', SKILL_NAME);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      `---\nname: ${SKILL_NAME}\ndescription: ${SKILL_NAME} description\nuser-invocable: true\n---\n${SKILL_INSTRUCTIONS}\n`,
    );
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project: project/i, terminal);
    await terminal.flushInput?.();
    await runtime.waitForScreenText(/│ ›/i, terminal, 10_000);

    // Only matches the skill once the inner slash is typed — the exact prefix
    // shape pi-tui's applyCompletion mishandles.
    await typeTextSlowly(terminal, '/skill/tab');
    await runtime.waitForScreenText(new RegExp(`${SKILL_NAME} description`, 'i'), terminal, 30_000);
    runtime.printScreen('skill autocomplete open', terminal);
    await terminal.flushInput?.();
    await new Promise(resolve => setTimeout(resolve, 200));

    terminal.write(TAB);
    await terminal.flushInput?.();
    // The slash-mode prompt only renders while the input still starts with "/".
    await runtime.waitForScreenText(/│ \/ skill\/tab-complete-e2e/i, terminal, 10_000);
    runtime.printScreen('after Tab', terminal);

    // No leading space here on purpose: the separator has to come from the Tab
    // completion itself, otherwise this scenario would pass even if Tab stopped
    // appending the trailing space and glued the arguments onto the skill name.
    terminal.write(SKILL_ARGS);
    await terminal.flushInput?.();
    await new Promise(resolve => setTimeout(resolve, 200));
    terminal.write(ENTER);

    await runtime.waitForScreenText(/MC skill tab completion response/i, terminal, 15_000);
    runtime.printScreen('after submitting Tab-completed skill', terminal);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 1) {
      throw new Error(`Expected one AIMock request for the Tab-completed skill, received ${requests.length}`);
    }

    const body = JSON.stringify((requests[0] as any).body);
    if (!body.includes(SKILL_INSTRUCTIONS)) {
      throw new Error(`Expected the skill instructions in the AIMock request: ${body.slice(0, 2000)}`);
    }
    if (!body.includes(`ARGUMENTS: ${SKILL_ARGS}`)) {
      throw new Error(`Expected the skill arguments in the AIMock request: ${body.slice(0, 2000)}`);
    }
  },
} satisfies McE2eScenario;

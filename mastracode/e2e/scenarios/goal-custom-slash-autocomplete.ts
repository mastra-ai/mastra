import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const TAB = '\t';
const ENTER = '\r';
const GOAL_OBJECTIVE = 'Run the custom goal slash autocomplete objective.';

export const goalCustomSlashAutocompleteScenario: McE2eScenario = {
  name: 'goal-custom-slash-autocomplete',
  description: 'Autocompletes /goal/<custom-command> and submits it as a goal command, not a user message.',
  testName: 'submits autocompleted custom goal slash commands with the leading slash preserved',
  useOpenAIModel: true,
  aimockFixture: 'goal-custom-slash-autocomplete.json',
  prepare({ projectDir, appDataDir }) {
    const commandsDir = join(projectDir, '.mastracode', 'commands');
    mkdirSync(commandsDir, { recursive: true });
    writeFileSync(
      join(commandsDir, 'custom-goal.md'),
      `---\ndescription: Custom goal autocomplete\ngoal: true\n---\n${GOAL_OBJECTIVE}\n`,
    );

    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.models = {
      ...settings.models,
      goalJudgeModel: 'openai/gpt-5.4-mini',
      goalMaxTurns: 3,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();

    terminal.write('/goal/custom-go');
    await runtime.waitForScreenText(/Custom goal autocomplete/i, terminal, 8_000);
    terminal.write(TAB);
    terminal.write(ENTER);

    await runtime.waitForScreenText(/Custom goal autocomplete e2e acknowledged\./i, terminal, 15_000);
    await runtime.waitForScreenText(/pursuing goal/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length < 1) {
      throw new Error(`Expected at least one AIMock request for custom goal slash command, received ${requests.length}`);
    }

    const body = JSON.stringify(requests);
    expect(body).toContain(GOAL_OBJECTIVE);
    expect(body).not.toContain('goal/custom-go');
  },
};

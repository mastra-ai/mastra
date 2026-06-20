import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const SKILL_NAME = 'skill-activation-e2e';
const GOAL_SKILL_NAME = 'goal-review-e2e';
const HIDDEN_SKILL_NAME = 'hidden-helper-e2e';
const SKILL_INSTRUCTIONS = 'Skill activation e2e instructions. Embedded </skill> boundary should be escaped.';
const GOAL_INSTRUCTIONS = 'Goal skill e2e objective instructions.';
const SKILL_ARGS = 'focus hidden-boundary';
const GOAL_ARGS = 'ship alias path';

function writeSkill(projectDir: string, name: string, frontmatter: string, body: string) {
  const dir = join(projectDir, '.mastracode', 'skills', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name} description\n${frontmatter}---\n${body}\n`,
  );
}

export const skillsCommandActivationScenario: McE2eScenario = {
  name: 'skills-command-activation',
  description: 'Seed workspace skills and verify /skills, /skill/<name>, and /goal/<skill> through the real TUI.',
  testName: 'activates seeded workspace skills and goal-skill aliases in the real TUI',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'skills-command-activation.json',
  prepare({ appDataDir, projectDir }) {
    writeSkill(projectDir, SKILL_NAME, 'user-invocable: true\n', SKILL_INSTRUCTIONS);
    writeSkill(projectDir, GOAL_SKILL_NAME, 'user-invocable: true\nmetadata:\n  goal: true\n', GOAL_INSTRUCTIONS);
    writeSkill(projectDir, HIDDEN_SKILL_NAME, 'user-invocable: false\n', 'Hidden skill instructions must stay hidden.');

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
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Project:|Resource ID:|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('/skills');
    await runtime.waitForScreenText(/Skills \(2\):/i, terminal, 8_000);
    await runtime.waitForScreenText(/skill-activation-e2e description/i, terminal, 8_000);
    await runtime.waitForScreenText(/goal-review-e2e description/i, terminal, 8_000);
    expect(terminal.serialize().view).not.toMatch(/hidden-helper-e2e/i);
    runtime.printScreen('after /skills', terminal);

    terminal.submit(`/skill/${SKILL_NAME} ${SKILL_ARGS}`);
    await runtime.waitForScreenText(/MC skill activation e2e response/i, terminal, 15_000);
    runtime.printScreen('after /skill activation', terminal);

    terminal.submit(`/goal/${GOAL_SKILL_NAME} ${GOAL_ARGS}`);
    await runtime.waitForScreenText(/MC goal skill e2e response/i, terminal, 15_000);
    await runtime.waitForScreenText(/pursuing goal/i, terminal, 8_000);
    runtime.printScreen('after /goal skill alias', terminal);

    terminal.submit('/goal status');
    await runtime.waitForScreenText(/Goal \(active\): "# Skill goal: goal-review-e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/3 turns used \[judge: openai\/gpt-5\.4-mini\]/i, terminal, 8_000);
    runtime.printScreen('after /goal status', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const body = JSON.stringify(requests);
    expect(body).toContain(SKILL_NAME);
    expect(body).toContain('Skill activation e2e instructions');
    expect(body).toContain('&lt;/skill&gt; boundary should be escaped');
    expect(body).toContain(`ARGUMENTS: ${SKILL_ARGS}`);
    expect(body).toContain(`# Skill goal: ${GOAL_SKILL_NAME}`);
    expect(body).toContain(GOAL_INSTRUCTIONS);
    expect(body).toContain(`ARGUMENTS: ${GOAL_ARGS}`);
  },
};

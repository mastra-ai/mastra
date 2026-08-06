import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const SKILL_NAME = 'skill-symlink-e2e';
const HIDDEN_SKILL_NAME = 'hidden-symlink-e2e';
const SKILL_DESCRIPTION = 'Agent Skills symlink e2e description';
const HIDDEN_SKILL_DESCRIPTION = 'Hidden symlink e2e description';

export const skillsSymlinkDedupeScenario: McE2eScenario = {
  name: 'skills-symlink-dedupe',
  description: 'Seed Agent Skills spec symlinks, then verify /skills resolves visible skills and filters hidden ones.',
  testName: 'resolves Agent Skills symlinks in the real TUI /skills catalog',
  projectFixture: 'long-branch',
  prepare({ projectDir }) {
    const externalSkillDir = join(projectDir, '.linked-skill-store', SKILL_NAME);
    mkdirSync(externalSkillDir, { recursive: true });
    writeFileSync(
      join(externalSkillDir, 'SKILL.md'),
      `---\nname: ${SKILL_NAME}\ndescription: ${SKILL_DESCRIPTION}\nuser-invocable: true\n---\nSymlink resolution instructions.\n`,
    );

    const hiddenSkillDir = join(projectDir, '.linked-skill-store', HIDDEN_SKILL_NAME);
    mkdirSync(hiddenSkillDir, { recursive: true });
    writeFileSync(
      join(hiddenSkillDir, 'SKILL.md'),
      `---\nname: ${HIDDEN_SKILL_NAME}\ndescription: ${HIDDEN_SKILL_DESCRIPTION}\nuser-invocable: false\n---\nHidden symlink instructions.\n`,
    );

    const agentSkillsDir = join(projectDir, '.agents', 'skills');
    mkdirSync(agentSkillsDir, { recursive: true });
    symlinkSync(externalSkillDir, join(agentSkillsDir, SKILL_NAME), 'dir');
    symlinkSync(hiddenSkillDir, join(agentSkillsDir, HIDDEN_SKILL_NAME), 'dir');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Project:|Resource ID:|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('/skills');
    await runtime.waitForScreenText(/Skills \(1\):/i, terminal, 8_000);
    await runtime.waitForScreenText(/Agent Skills symlink e2e description/i, terminal, 8_000);

    const screen = terminal.serialize().view;
    expect(screen).not.toMatch(/Skills \(2\):/i);
    expect(screen).not.toMatch(/hidden-symlink-e2e|Hidden symlink e2e description/i);
    expect(screen.match(/skill-symlink-e2e/gi) ?? []).toHaveLength(1);
    runtime.printScreen('after /skills', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};

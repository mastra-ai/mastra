import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

const DEPLOY_CONTENT = 'Deploy using the standard checklist.';
const DEPLOY_ARGS = 'ARGUMENTS: prod blue';
const REVIEW_CONTENT = 'Review src/index.ts src/main.ts';
const REVIEW_DUPLICATE_CONTENT = 'ARGUMENTS: src/index.ts src/main.ts';

export const customSlashCommandScenario: McE2eScenario = {
  name: 'custom-slash-command',
  description: 'Run custom slash commands through the real TUI and verify processed arguments reach the model request.',
  testName: 'preserves custom slash command arguments in real TUI model requests',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'custom-slash-command.json',
  prepare({ projectDir }) {
    const commandsDir = join(projectDir, '.mastracode', 'commands');
    mkdirSync(commandsDir, { recursive: true });
    writeFileSync(
      join(commandsDir, 'deploy.md'),
      `---\ndescription: Deploy checklist\n---\nDeploy using the standard checklist.\n`,
    );
    writeFileSync(join(commandsDir, 'review.md'), `---\ndescription: Review changed files\n---\nReview $1+\n`);
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Project:|Resource ID:|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('//deploy prod blue');
    await runtime.waitForScreenText(/MC deploy command response/i, terminal);
    runtime.printScreen('after deploy command', terminal);

    terminal.submit('//review src/index.ts src/main.ts');
    await runtime.waitForScreenText(/MC review command response/i, terminal);
    runtime.printScreen('after review command', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const body = JSON.stringify(requests);
    expect(body).toContain(DEPLOY_CONTENT);
    expect(body).toContain(DEPLOY_ARGS);
    expect(body).toContain(REVIEW_CONTENT);
    expect(body).not.toContain(REVIEW_DUPLICATE_CONTENT);
  },
};

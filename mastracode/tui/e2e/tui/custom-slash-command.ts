import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';
import { typeTextSlowly } from './typing-utils.js';

const DEPLOY_CONTENT = 'Deploy using the standard checklist.';
const DEPLOY_ARGS = 'ARGUMENTS: prod blue';
const REVIEW_CONTENT = 'Review src/index.ts src/main.ts';
const REVIEW_DUPLICATE_CONTENT = 'ARGUMENTS: src/index.ts src/main.ts';
const PRESENTATION_CONTENT = 'Present the review findings.';
const DEPENDENCY_SENTINEL = 'dependency-readme-sentinel';

export const customSlashCommandScenario: McE2eScenario = {
  name: 'custom-slash-command',
  description: 'Run custom slash commands through the real TUI and verify processed arguments reach the model request.',
  testName: 'excludes dependency READMEs while preserving custom slash commands in the real TUI',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'custom-slash-command.json',
  prepare({ projectDir }) {
    const commandsDir = join(projectDir, '.mastracode', 'commands');
    const commandSourcesDir = join(projectDir, '.mastracode', 'command-sources');
    mkdirSync(commandsDir, { recursive: true });
    mkdirSync(commandSourcesDir, { recursive: true });
    writeFileSync(
      join(commandSourcesDir, 'deploy.md'),
      `---\ndescription: Deploy checklist\n---\nDeploy using the standard checklist.\n`,
    );
    symlinkSync(join(commandSourcesDir, 'deploy.md'), join(commandsDir, 'deploy.md'));
    writeFileSync(join(commandsDir, 'review.md'), `---\ndescription: Review changed files\n---\nReview $1+\n`);

    const presentationDir = join(commandsDir, 'presentation');
    const dependencyReadmeDir = join(
      presentationDir,
      'node_modules',
      '.pnpm',
      'x',
      'node_modules',
      DEPENDENCY_SENTINEL,
    );
    mkdirSync(presentationDir, { recursive: true });
    mkdirSync(dependencyReadmeDir, { recursive: true });
    writeFileSync(
      join(presentationDir, 'review.md'),
      `---\ndescription: Review presentation\n---\n${PRESENTATION_CONTENT}\n`,
    );
    writeFileSync(join(dependencyReadmeDir, 'README.md'), 'Dependency README must not become a command.\n');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Project:|Resource ID:|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    await terminal.flushInput?.();
    await typeTextSlowly(terminal, '/presentation:');
    await runtime.waitForScreenText(/\/presentation:review/i, terminal, 10_000);
    runtime.printScreen('nested command autocomplete', terminal);
    expect(terminal.serialize().view).not.toContain(DEPENDENCY_SENTINEL);
    terminal.write('\x1b');
    terminal.write('\x15');
    await terminal.flushInput?.();

    terminal.submit('//deploy prod blue');
    await runtime.waitForScreenText(/MC deploy command response/i, terminal);
    runtime.printScreen('after deploy command', terminal);

    terminal.submit('//review src/index.ts src/main.ts');
    await runtime.waitForScreenText(/MC review command response/i, terminal);
    runtime.printScreen('after review command', terminal);

    terminal.submit('//presentation:review');
    await runtime.waitForScreenText(/MC presentation command response/i, terminal);
    runtime.printScreen('after nested presentation command', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const body = JSON.stringify(requests);
    expect(body).toContain(DEPLOY_CONTENT);
    expect(body).toContain(DEPLOY_ARGS);
    expect(body).toContain(REVIEW_CONTENT);
    expect(body).not.toContain(REVIEW_DUPLICATE_CONTENT);
    expect(body).toContain(PRESENTATION_CONTENT);
    expect(body).not.toContain(DEPENDENCY_SENTINEL);
  },
};

import { mkdirSync } from 'node:fs';
import {
  enableGithubSignals,
  githubSignalsEnv,
  githubSignalsInProcessApp,
  prepareGithubSignalsMultiFixture,
} from './github-signals-e2e-utils.js';
import type { McE2eScenario } from './types.js';

export const githubSignalsMultiSubscribeScenario = {
  name: 'github-signals-multi-subscribe',
  description: 'subscribes to multiple GitHub PRs through the no-arg /github picker using mocked gh and gitcrawl',
  testName: 'subscribes to multiple PRs through the GitHub picker',
  useOpenAIModel: true,
  aimockFixture: 'github-signals-command.json',
  prepare(context) {
    mkdirSync(context.projectDir, { recursive: true });
    enableGithubSignals(context);
    prepareGithubSignalsMultiFixture(context);
  },
  env({ projectDir }) {
    return githubSignalsEnv(projectDir, process.env.PATH);
  },
  inProcessApp: githubSignalsInProcessApp,
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project: mastra/i, terminal);

    terminal.submit('/new');
    await runtime.waitForScreenText(/Ready for new conversation/i, terminal);

    terminal.submit('Create a GitHub Signals e2e thread.');
    await runtime.waitForScreenText(/GitHub Signals thread ready/i, terminal);

    terminal.submit('/github');
    await runtime.waitForScreenText(/GitHub Signals/i, terminal);
    await runtime.waitForScreenText(/Subscribe.*Select one or more open PRs/i, terminal);
    terminal.write('\r');

    await runtime.waitForScreenText(/Subscribe to GitHub PRs/i, terminal, 30_000);
    await runtime.waitForScreenText(/My open PRs/i, terminal);
    await runtime.waitForScreenText(/mastra-ai\/mastra#17637/i, terminal);
    await runtime.waitForScreenText(/mastra-ai\/mastra#17638/i, terminal);
    terminal.write(' ');
    terminal.write('\x1b[B');
    terminal.write(' ');
    terminal.write('\r');

    await runtime.waitForScreenText(
      /GitHub PR batch complete: .*#1763[78]: subscribed; .*#1763[78]: subscribed/i,
      terminal,
      30_000,
    );

    terminal.submit('/github debug');
    await runtime.waitForScreenText(/GitHub Signals debug for/i, terminal);
    await runtime.waitForScreenText(/2 subscriptions/i, terminal);
    await runtime.waitForScreenText(/mastra-ai\/mastra#17637/i, terminal);
    await runtime.waitForScreenText(/mastra-ai\/mastra#17638/i, terminal);
    runtime.printScreen('github multi-subscribe debug status', terminal);
  },
} satisfies McE2eScenario;

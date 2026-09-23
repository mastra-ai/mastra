import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  githubSignalsEnv,
  githubSignalsInProcessApp,
  prepareGithubSignalsMultiFixture,
} from './github-signals-e2e-utils.js';
import type { McE2eScenario } from './types.js';

let settingsPath = '';

export const githubSignalsLegacyUpgradeScenario = {
  name: 'github-signals-legacy-upgrade',
  description: 'keeps old settings/subscription flows working when using the new GitHub multi-subscribe UI',
  testName: 'preserves old GitHub subscription flow and upgrades poll interval settings',
  useOpenAIModel: true,
  aimockFixture: 'github-signals-command.json',
  prepare(context) {
    mkdirSync(context.projectDir, { recursive: true });
    settingsPath = join(context.appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as { signals?: Record<string, unknown> };
    settings.signals = {
      ...settings.signals,
      experimentalGithubSignals: true,
    };
    delete settings.signals.githubPollIntervalMs;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
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

    terminal.submit('/github subscribe mastra-ai/mastra#17637');
    await runtime.waitForScreenText(/Subscribed to mastra-ai\/mastra#17637/i, terminal, 30_000);

    terminal.submit('/github debug');
    await runtime.waitForScreenText(/1 subscription/i, terminal);
    await runtime.waitForScreenText(/mastra-ai\/mastra#17637/i, terminal);

    terminal.submit('/github');
    await runtime.waitForScreenText(/GitHub Signals/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Subscribe to GitHub PRs/i, terminal, 30_000);
    await runtime.waitForScreenText(/mastra-ai\/mastra#17638/i, terminal, 30_000);
    terminal.write('\x1b[B');
    terminal.write(' ');
    terminal.write('\r');
    await runtime.waitForScreenText(/Subscribed to mastra-ai\/mastra#17638 in working mode/i, terminal, 30_000);

    terminal.submit('/github debug');
    await runtime.waitForScreenText(/2 subscriptions/i, terminal);

    terminal.submit('/github');
    await runtime.waitForScreenText(/GitHub Signals/i, terminal);
    for (let i = 0; i < 5; i++) terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/GitHub polling interval/i, terminal);
    for (let i = 0; i < 3; i++) terminal.write('\x1b[A');
    terminal.write('\r');
    await runtime.waitForScreenText(/GitHub polling interval set to 30s/i, terminal);

    const saved = JSON.parse(readFileSync(settingsPath, 'utf8')) as { signals?: { githubPollIntervalMs?: number } };
    if (saved.signals?.githubPollIntervalMs !== 30_000) {
      throw new Error(`Expected githubPollIntervalMs=30000, received ${saved.signals?.githubPollIntervalMs}`);
    }
    runtime.printScreen('github legacy upgrade debug status', terminal);
  },
} satisfies McE2eScenario;

import { mkdirSync } from 'node:fs';
import {
  enableGithubSignals,
  githubSignalsEnv,
  githubSignalsInProcessApp,
  prepareGithubSignalsMultiFixture,
} from './github-signals-e2e-utils.js';
import type { McE2eScenario } from './types.js';

export const githubSignalsToolMultiSubscribeScenario = {
  name: 'github-signals-tool-multi-subscribe',
  description: 'drives GitHub subscribe/unsubscribe agent tools through AIMock using multi-PR and all modes',
  testName: 'executes GitHub signal tools for multi-subscribe and bulk unsubscribe',
  useOpenAIModel: true,
  aimockFixture: 'github-signals-tool-multi-subscribe.json',
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
    // The AIMock fixture answers every post-tool request with the same text. Waiting for the Nth
    // occurrence in the scrollback guarantees the agent run finished before `/github debug`
    // is submitted, so later assistant output cannot scroll the debug summary off screen.
    const stepComplete = (count: number) =>
      new RegExp(Array.from({ length: count }, () => 'GitHub signal tool step complete\\.').join('[^]*'), 'i');

    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project: mastra/i, terminal);

    terminal.submit('/new');
    await runtime.waitForScreenText(/Ready for new conversation/i, terminal);

    terminal.submit('Subscribe to both GitHub PRs with the tool.');
    await runtime.waitForScreenText(/github_subscribe_pr.*✓/i, terminal, 30_000);
    await runtime.waitForOutputText(stepComplete(1), terminal, 30_000);
    terminal.submit('/github debug');
    await runtime.waitForScreenText(/2 subscriptions/i, terminal);

    terminal.submit('Unsubscribe one GitHub PR with the tool.');
    await runtime.waitForScreenText(/github_unsubscribe_pr.*✓/i, terminal, 30_000);
    await runtime.waitForOutputText(stepComplete(2), terminal, 30_000);
    terminal.submit('/github debug');
    await runtime.waitForScreenText(/1 subscription/i, terminal);
    await runtime.waitForScreenText(/mastra-ai\/mastra#17638/i, terminal);

    terminal.submit('Unsubscribe all GitHub PRs with the tool.');
    await runtime.waitForScreenText(/github_unsubscribe_pr all=true ✓/i, terminal, 30_000);
    await runtime.waitForOutputText(stepComplete(3), terminal, 30_000);
    terminal.submit('/github debug');
    await runtime.waitForScreenText(/no subscribed PRs/i, terminal);
    runtime.printScreen('github tool multi-subscribe final state', terminal);
  },
} satisfies McE2eScenario;

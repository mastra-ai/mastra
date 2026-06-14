import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const notificationSignalRenderingScenario: McE2eScenario = {
  name: 'notification-signal-rendering',
  description: 'Emit a real notification signal into an active TUI thread and verify inline notification rendering.',
  testName: 'renders a live notification signal emitted into the active TUI thread',
  useOpenAIModel: true,
  aimockFixture: 'notification-signal-rendering.json',
  prepare({ mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, '.mc-e2e-notification-signal-entrypoint.ts'),
      `import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const mastracodeDir = ${JSON.stringify(mastracodeDir)};
const { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);
const { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);
const { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const result = await createMastraCode({
  cwd: process.cwd(),
  disableMcp: true,
  disableHooks: true,
  unixSocketPubSub: false,
});

let sent = false;
const timer = setInterval(async () => {
  try {
    const threadId = result.harness.getCurrentThreadId();
    if (sent || !threadId || !result.harness.isCurrentThreadStreamActive()) return;
    sent = true;
    clearInterval(timer);
    const agent = result.harness.getMastra()?.getAgentById('code-agent');
    await agent?.sendNotificationSignal(
      {
        source: 'github',
        kind: 'ci-status',
        priority: 'urgent',
        summary: 'Notification e2e alert: CI failed on main',
        dedupeKey: 'mc-e2e-notification-signal',
      },
      {
        resourceId: result.harness.getResourceId(),
        threadId,
        ifIdle: { behavior: 'wake' },
      },
    );
  } catch (error) {
    process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');
  }
}, 100);

timer.unref?.();

const tui = new MastraTUI({
  harness: result.harness,
  hookManager: result.hookManager,
  authStorage: result.authStorage,
  mcpManager: result.mcpManager,
  version: getCurrentVersion(),
  inlineQuestions: true,
});

void tui.run().catch(error => {
  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');
  process.exit(1);
});
`,
    );
  },
  entrypoint({ projectDir }) {
    return join(projectDir, '.mc-e2e-notification-signal-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    terminal.keyCtrlC();
    await runtime.waitForScreenTextAbsent(/\[WorkspaceSkills\].*Expected string/i, terminal, 8_000);
    runtime.printScreen('after startup', terminal);

    terminal.write('Start notification host run.');
    await runtime.waitForScreenText(/Start notification host run\./i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/notification from github/i, terminal, 10_000);
    await runtime.waitForScreenText(/urgent · ci-status · delivered/i, terminal, 10_000);
    await runtime.waitForScreenText(/Notification e2e alert: CI failed on main/i, terminal, 10_000);
    runtime.printScreen('after notification signal', terminal);
    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests.map((request: any) => request.body));
    expect(serialized).toContain('Start notification host run.');
    expect(serialized).toContain('Notification e2e alert: CI failed on main');
  },
};

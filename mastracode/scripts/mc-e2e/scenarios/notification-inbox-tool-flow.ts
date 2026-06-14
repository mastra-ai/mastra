import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const notificationInboxToolFlowScenario: McE2eScenario = {
  name: 'notification-inbox-tool-flow',
  description: 'Summarize an active notification, then read it through the real notification_inbox tool.',
  testName: 'reads a summarized notification through notification_inbox and renders the delivered details',
  useOpenAIModel: true,
  aimockFixture: 'notification-inbox-tool-flow.json',
  prepare({ mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, '.mc-e2e-notification-inbox-entrypoint.ts'),
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
        priority: 'medium',
        summary: 'Notification inbox e2e detail: CI is queued for review',
        dedupeKey: 'mc-e2e-notification-inbox-tool-flow',
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
    return join(projectDir, '.mc-e2e-notification-inbox-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('Start notification inbox lifecycle host run.');
    await runtime.waitForScreenText(/Notification summary: 1 pending/i, terminal, 10_000);
    await runtime.waitForScreenText(/github: 1/i, terminal, 10_000);
    await runtime.waitForScreenText(/Use notification_inbox to inspect pending notifications/i, terminal, 10_000);
    await runtime.waitForScreenText(/Notification signal follow-up completed/i, terminal, 10_000);
    runtime.printScreen('after notification summary', terminal);

    terminal.submit('Read the pending notification from the inbox.');
    await runtime.waitForScreenText(/notification from github/i, terminal, 15_000);
    await runtime.waitForScreenText(/medium · ci-status · delivered/i, terminal, 15_000);
    await runtime.waitForScreenText(/Notification inbox e2e detail: CI is queued for review/i, terminal, 15_000);
    await runtime.waitForScreenText(/Notification inbox read completed/i, terminal, 15_000);
    runtime.printScreen('after notification inbox read', terminal);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests.map((request: any) => request.body));
    expect(serialized).toContain('Start notification inbox lifecycle host run.');
    expect(serialized).toContain('Notification inbox e2e detail: CI is queued for review');
    expect(serialized).toContain('notification_inbox');
    expect(serialized).toContain('Read the pending notification from the inbox.');
  },
};

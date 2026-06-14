import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const notificationInboxCrudFlowScenario: McE2eScenario = {
  name: 'notification-inbox-crud-flow',
  description: 'Exercise notification_inbox list, markSeen, dismiss, archive, and search through the real TUI.',
  testName: 'manages seeded notification inbox records through CRUD and search actions',
  useOpenAIModel: true,
  aimockFixture: 'notification-inbox-crud-flow.json',
  prepare({ mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, '.mc-e2e-notification-inbox-crud-entrypoint.ts'),
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

let seeded = false;
const seedNotifications = async () => {
  const threadId = result.harness.getCurrentThreadId();
  if (seeded || !threadId || !result.harness.isCurrentThreadStreamActive()) return;
  seeded = true;
  const storage = await result.harness.getMastra()?.getStorage()?.getStore('notifications');
  if (!storage) throw new Error('notification storage unavailable');
  const resourceId = result.harness.getResourceId();
  const agentId = 'code-agent';
  await storage.createNotification({
    id: 'inbox-crud-seen',
    threadId,
    resourceId,
    agentId,
    source: 'github',
    kind: 'ci-status',
    priority: 'medium',
    summary: 'Notification CRUD markSeen target: flaky CI warning',
  });
  await storage.createNotification({
    id: 'inbox-crud-dismiss',
    threadId,
    resourceId,
    agentId,
    source: 'github',
    kind: 'review-comment',
    priority: 'high',
    summary: 'Notification CRUD dismiss target: reviewer requested docs',
  });
  await storage.createNotification({
    id: 'inbox-crud-archive',
    threadId,
    resourceId,
    agentId,
    source: 'deploy',
    kind: 'deployment-success',
    priority: 'low',
    summary: 'Notification CRUD archive target: canary deployed',
  });
  await storage.createNotification({
    id: 'inbox-crud-search',
    threadId,
    resourceId,
    agentId,
    source: 'calendar',
    kind: 'release-reminder',
    priority: 'medium',
    summary: 'Notification CRUD search control: roadmap planning reminder',
  });
  await storage.createNotification({
    id: 'inbox-crud-list-only',
    threadId,
    resourceId,
    agentId,
    source: 'linear',
    kind: 'triage-note',
    priority: 'medium',
    summary: 'Notification CRUD list-only target: triage queue visible',
  });
};

const timer = setInterval(() => {
  seedNotifications().catch(error => {
    clearInterval(timer);
    process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');
  });
  if (seeded) clearInterval(timer);
}, 50);

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
    return join(projectDir, '.mc-e2e-notification-inbox-crud-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('Seed notification inbox CRUD fixtures.');
    await runtime.waitForScreenText(/Notification inbox CRUD seed ready/i, terminal, 10_000);
    runtime.printScreen('after seed turn', terminal);

    terminal.submit('Exercise notification inbox CRUD and search.');
    await runtime.waitForScreenText(/Notification CRUD list-only target: triage queue visible/i, terminal, 15_000);
    await runtime.waitForScreenText(/Notification CRUD markSeen target: flaky CI warning/i, terminal, 15_000);
    await runtime.waitForScreenText(/"status": "seen"/i, terminal, 15_000);
    await runtime.waitForScreenText(/Notification CRUD dismiss target: reviewer requested docs/i, terminal, 15_000);
    await runtime.waitForScreenText(/"status": "dismissed"/i, terminal, 15_000);
    await runtime.waitForScreenText(/Notification CRUD archive target: canary deployed/i, terminal, 15_000);
    await runtime.waitForScreenText(/"status": "archived"/i, terminal, 15_000);
    await runtime.waitForScreenText(/Notification inbox CRUD\/search e2e complete/i, terminal, 15_000);
    runtime.printScreen('after notification inbox crud flow', terminal);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests.map((request: any) => request.body));
    expect(serialized).toContain('Seed notification inbox CRUD fixtures.');
    expect(serialized).toContain('Exercise notification inbox CRUD and search.');
    expect(serialized).toContain('call_notification_crud_list');
    expect(serialized).toContain('call_notification_crud_search_seen');
    expect(serialized).toContain('call_notification_crud_search_dismissed');
    expect(serialized).toContain('call_notification_crud_search_archived');
    expect(serialized).toContain('inbox-crud-seen');
    expect(serialized).toContain('inbox-crud-dismiss');
    expect(serialized).toContain('inbox-crud-archive');
    expect(serialized).toContain('flaky');
    expect(serialized).toContain('reviewer');
    expect(serialized).toContain('canary');
  },
};

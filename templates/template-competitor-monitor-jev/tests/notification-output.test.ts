import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Classifier } from '@mastra/core/classifier';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { expect, it, vi } from 'vitest';

import { loadConfig, TIMING } from '../src/mastra/config';
import { dailyMonitorSchedules, scheduledMonitorInputs } from '../src/mastra/config/scheduled-monitors';
import { CLASSIFIER_ID, COMPETITOR_CHANGE_QUESTIONS, QUESTION_SET_VERSION } from '../src/mastra/lib/classification';
import { EVALUATION_FIXTURES } from './fixtures/evaluation-dataset';
import { MonitorStore } from '../src/mastra/lib/store';
import { createNotifyStep } from '../src/mastra/workflows/competitor-monitor-steps/notify';
import { createStepContext } from '../src/mastra/workflows/competitor-monitor-steps/workflow-context';
import type { ChangeNotification } from '../src/mastra/notifications';
import { formatMarkdownReport, MarkdownReportProvider } from '../src/mastra/notifications/markdown-report';
import { createCompetitorMonitorWorkflow } from '../src/mastra/workflows/competitor-monitor-workflow';

const input = {
  monitorId: 'example-competitor',
  profile: { name: 'Example competitor', interests: ['pricing'] },
  sources: [{ id: 'pricing', label: 'Pricing', url: 'https://public.example/pricing', kind: 'pricing' }],
};

it('reads only enabled monitor files and creates stable daily declarative schedules', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'competitor-schedule-config-'));
  const file = join(directory, 'scheduled-monitors.json');
  try {
    expect(scheduledMonitorInputs({ enabled: false, file }, 3)).toEqual([]);
    expect(() => scheduledMonitorInputs({ enabled: true, file }, 3)).toThrow('Missing scheduled-monitors.json');
    await writeFile(file, JSON.stringify([input]));
    const configured = scheduledMonitorInputs({ enabled: true, file }, 3);
    const schedules = dailyMonitorSchedules(configured);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toMatchObject({
      cron: '0 9 * * *',
      timezone: 'UTC',
      inputData: { monitorId: input.monitorId, runMode: 'scheduled' },
    });
    expect(dailyMonitorSchedules(configured)[0]?.id).toBe(schedules[0]?.id);
    await writeFile(file, await readFile(new URL('../scheduled-monitors-example.json', import.meta.url), 'utf8'));
    expect(scheduledMonitorInputs({ enabled: true, file }, 3)).toHaveLength(2);
    await writeFile(file, JSON.stringify([input, input]));
    expect(() => scheduledMonitorInputs({ enabled: true, file }, 3)).toThrow('Invalid scheduled-monitors.json');
    await writeFile(file, '[]');
    expect(() => scheduledMonitorInputs({ enabled: true, file }, 3)).toThrow('Invalid scheduled-monitors.json');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('registers configured daily schedules when Mastra starts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'competitor-daily-schedule-'));
  const config = loadConfig({
    MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
    MASTRA_PROJECT_ROOT: directory,
    ENABLE_MONITOR_SCHEDULER: 'true',
  });
  const store = MonitorStore.open(config.storage.monitorUrl);
  const framework = new LibSQLStore({ id: 'daily-framework', url: config.storage.mastraUrl });
  let mastra: Mastra | undefined;
  try {
    await writeFile(config.schedule.file, JSON.stringify([input]));
    const schedules = dailyMonitorSchedules(scheduledMonitorInputs(config.schedule, config.sources.maxSources));
    const workflow = createCompetitorMonitorWorkflow({ store, config }, schedules);
    mastra = new Mastra({ storage: framework, workflows: { competitorMonitor: workflow } });
    await mastra.startWorkers();
    expect(await mastra.schedules.list({ workflowId: 'competitor-monitor' })).toEqual([
      expect.objectContaining({ cron: '0 9 * * *', timezone: 'UTC', metadata: { monitorId: input.monitorId } }),
    ]);
  } finally {
    await mastra?.stopWorkers();
    await store.close();
    await framework.close();
    await rm(directory, { recursive: true, force: true });
  }
});

it('recovered_scheduled_alert_is_delivered_once_with_evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'competitor-notifications-'));
  const config = loadConfig({
    MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
    TYPESAFE_AI_API_KEY: 'synthetic-test-key',
  });
  let store = MonitorStore.open(config.storage.monitorUrl);
  const framework = new LibSQLStore({ id: 'notification-framework', url: config.storage.mastraUrl });
  const reportsDir = join(directory, 'reports');
  const delivered = vi.fn(async (_event: unknown) => {});
  let failClassification = true;
  let failProvider = true;
  const failedDelivery = vi.fn(async (_event: unknown) => {
    if (failProvider) throw new Error('SIMULATED_FAILURE');
  });
  let amount = 19;
  const fixture = EVALUATION_FIXTURES.find(item => item.family === 'pricing')!;
  const classifier = new Classifier({
    id: CLASSIFIER_ID,
    questions: COMPETITOR_CHANGE_QUESTIONS,
    model: {
      specificationVersion: 'v4',
      provider: 'fixture',
      modelId: 'fixture',
      supportedQuestionTypes: ['choice', 'score', 'boolean'],
      doEvaluate: async () => {
        if (failClassification) throw new Error('SIMULATED_CLASSIFIER_FAILURE');
        return {
          answers: {
            ...fixture.answers!,
            change_type: {
              ...fixture.answers!.change_type,
              probabilities: Object.fromEntries(
                Object.keys(COMPETITOR_CHANGE_QUESTIONS.change_type.criteria).map(choice => [
                  choice,
                  choice === 'pricing' ? 1 : 0,
                ]),
              ),
            },
          },
          usage: {},
          warnings: [],
          rounding: {},
          providerMetadata: fixture.providerMetadata,
          response: { modelId: 'fixture', timestamp: new Date() },
        };
      },
    } as any,
  });
  function runtime() {
    const workflow = createCompetitorMonitorWorkflow({
      store,
      config,
      notificationProviders: [
        { id: 'broken', notify: failedDelivery },
        new MarkdownReportProvider(reportsDir),
        { id: 'second-provider', notify: delivered },
      ],
      resolver: async () => [{ address: '93.184.216.34', family: 4 }],
      transport: async ({ url }: { url: URL }) => ({
        status: 200,
        headers: { 'content-type': url.pathname === '/robots.txt' ? 'text/plain' : 'text/html' },
        body: new TextEncoder().encode(
          url.pathname === '/robots.txt'
            ? 'User-agent: *\nAllow: /'
            : `<main><h1>Pricing</h1><p>Starter costs $${amount} per month. ${'Public pricing information. '.repeat(12)}</p></main>`,
        ),
      }),
    });
    return new Mastra({
      storage: framework,
      workflows: { competitorMonitor: workflow },
      classifiers: { competitorChange: classifier },
    });
  }
  let mastra = runtime();
  const run = async (runMode: 'scheduled' | 'manual' | 'baseline') => {
    const execution = await mastra.getWorkflow('competitorMonitor').createRun();
    const started = await execution.start({
      inputData: { ...input, runMode, options: { generateSummary: false } } as any,
    });
    if (started.status !== 'success') throw new Error('WORKFLOW_FAILED');
    return started.result;
  };
  const files = async () =>
    readdir(reportsDir).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    });
  try {
    await run('scheduled');
    expect(await files()).toEqual([]);
    amount = 29;
    const pending = await run('scheduled');
    expect(pending.changes[0]).toMatchObject({ status: 'failed' });
    expect(delivered).not.toHaveBeenCalled();
    expect((await store.client.execute('SELECT * FROM notification_events')).rows).toHaveLength(0);
    await store.close();
    store = MonitorStore.open(config.storage.monitorUrl);
    mastra = runtime();
    failClassification = false;
    await store.init();
    await store.client.execute(`CREATE TRIGGER reject_notification_test BEFORE INSERT ON notification_events
      BEGIN SELECT RAISE(ABORT, 'SIMULATED_EVENT_COMMIT_FAILURE'); END;`);
    const rollback = await run('scheduled');
    expect(rollback.changes[0]).toMatchObject({ status: 'failed' });
    expect((await store.client.execute('SELECT * FROM classification_decisions')).rows).toHaveLength(0);
    expect((await store.client.execute('SELECT * FROM notification_events')).rows).toHaveLength(0);
    expect((await store.client.execute('SELECT * FROM notification_receipts')).rows).toHaveLength(0);
    expect(await store.pendingCandidatesForSource(input.monitorId, 'pricing')).toHaveLength(1);
    expect(delivered).not.toHaveBeenCalled();
    await store.client.execute('DROP TRIGGER reject_notification_test');
    const recovered = await run('scheduled');
    expect(recovered.changes[0]).toMatchObject({ status: 'classified', route: 'alert' });
    expect(recovered.notificationFailures).toEqual(['broken']);
    expect(delivered).toHaveBeenCalledTimes(1);
    const event = delivered.mock.calls[0]![0] as any;
    expect(event.changes[0].evidence).toMatchObject({ sourceUrl: input.sources[0]!.url });
    expect(event.changes[0].evidence.beforeExcerpt).toContain('Starter costs $19');
    expect(event.changes[0].evidence.afterExcerpt).toContain('Starter costs $29');
    expect(event.changes[0].provenance.questionSetVersion).toBe(QUESTION_SET_VERSION);
    const reportFiles = await files();
    expect(reportFiles).toHaveLength(1);
    const report = await readFile(join(reportsDir, reportFiles[0]!), 'utf8');
    expect(report).toContain(event.eventId);
    expect(report).toContain('Starter costs $19');
    expect(report).toContain('Starter costs $29');
    // Manual and baseline checks cannot drain even a previously failed scheduled delivery.
    await run('manual');
    await run('baseline');
    expect(failedDelivery).toHaveBeenCalledTimes(1);
    await store.close();
    store = MonitorStore.open(config.storage.monitorUrl);
    mastra = runtime();
    failProvider = false;
    const unchanged = await run('scheduled');
    expect(unchanged.status).toBe('no_change');
    expect(failedDelivery).toHaveBeenCalledTimes(2);
    expect(failedDelivery.mock.calls[1]![0]).toEqual(event);
    expect(delivered).toHaveBeenCalledTimes(1);
    expect(await files()).toEqual(reportFiles);
    await run('scheduled');
    expect(failedDelivery).toHaveBeenCalledTimes(2);
    // Simulate an effect completed just before its receipt: Markdown replays the same immutable file.
    await store.client.execute(
      "UPDATE notification_receipts SET delivered_at = NULL WHERE provider_id = 'markdown-report'",
    );
    await writeFile(join(reportsDir, reportFiles[0]!), 'interrupted old file');
    await run('scheduled');
    expect(await files()).toEqual(reportFiles);
    expect(await readFile(join(reportsDir, reportFiles[0]!), 'utf8')).toBe(report);
    amount = 39;
    await run('manual');
    expect(delivered).toHaveBeenCalledTimes(1);
    expect((await store.client.execute('SELECT * FROM notification_events')).rows).toHaveLength(1);
  } finally {
    await store.close();
    await framework.close();
    await rm(directory, { recursive: true, force: true });
  }
});

it.each(['timeout', 'cancel'] as const)(
  'releases a monitor after notification %s without acknowledging late delivery',
  async failure => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-notification-deadline-'));
    const config = loadConfig({ MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}` });
    const store = MonitorStore.open(config.storage.monitorUrl);
    const run = await store.beginRun('deadline-monitor');
    const event: ChangeNotification = {
      eventId: 'pending-event',
      runId: run.id,
      monitorId: run.monitorId,
      monitorName: 'Monitor',
      date: '2026-10-08',
      changes: [],
    };
    const pending = vi.spyOn(store, 'pendingNotifications').mockResolvedValue([event]);
    const acknowledge = vi.spyOn(store, 'acknowledgeNotification');
    let finishDelivery!: () => void;
    let started!: () => void;
    const deliveryStarted = new Promise<void>(resolve => {
      started = resolve;
    });
    let providerSignal: AbortSignal | undefined;
    const notify = vi.fn((_event: ChangeNotification, options?: { abortSignal?: AbortSignal }) => {
      providerSignal = options?.abortSignal;
      started();
      return new Promise<void>(resolve => {
        finishDelivery = resolve;
      });
    });
    const controller = new AbortController();
    const step = createNotifyStep(
      createStepContext({ store, config, notificationProviders: [{ id: 'hung', notify }] }),
    );
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const result = step.execute!({
        inputData: {
          runId: run.id,
          monitorId: run.monitorId,
          status: 'no_change',
          counts: {
            sourcesRequested: 1,
            sourcesChecked: 1,
            sourcesFailed: 0,
            candidatesDetected: 0,
            candidatesClassified: 0,
            candidatesDeferred: 0,
          },
          sources: [],
          changes: [],
          report: {},
        },
        getInitData: () => ({ runMode: 'scheduled', monitorId: run.monitorId }),
        abortSignal: controller.signal,
      } as unknown as Parameters<NonNullable<typeof step.execute>>[0]);
      await deliveryStarted;
      if (failure === 'cancel') controller.abort(new Error('TEST_CANCELED'));
      else await vi.advanceTimersByTimeAsync(TIMING.notificationCallMs);
      expect(await result).toMatchObject({ status: 'partial', notificationFailures: ['hung'] });
      expect(providerSignal?.aborted).toBe(true);
      expect(acknowledge).not.toHaveBeenCalled();
      // A provider that ignores cancellation may finish later; it must not gain a receipt.
      finishDelivery();
      await Promise.resolve();
      expect(acknowledge).not.toHaveBeenCalled();
      const nextRun = await store.beginRun(run.monitorId);
      await store.finishRun(nextRun, 'success', {});
      expect(pending).toHaveBeenCalledWith(run.monitorId, 'hung');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
      pending.mockRestore();
      acknowledge.mockRestore();
      await store.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

it('keeps hostile page excerpts literal inside fences that their content cannot close', () => {
  const excerpt =
    '![tracker](https://attacker.example/pixel)\r```\r\n[link](https://attacker.example/)\n````\n<script>alert(1)</script>';
  const event: ChangeNotification = {
    eventId: 'event',
    runId: 'run',
    monitorId: 'monitor',
    monitorName: 'Monitor',
    date: '2026-10-08',
    changes: [
      {
        id: 'change',
        sourceId: 'pricing',
        status: 'classified',
        route: 'alert',
        evidence: { sourceUrl: 'https://public.example/pricing', beforeExcerpt: excerpt, afterExcerpt: '' },
      },
    ],
  };
  const report = formatMarkdownReport(event);
  expect(report).toContain(['Before:', '`````text', ...excerpt.split(/\r\n|\r|\n/), '`````'].join('\n'));
  expect(report).toContain('After:\n```text\n(empty)\n```');
  expect(event.changes[0]?.evidence?.beforeExcerpt).toBe(excerpt);
});

it('renders report metadata as separate Markdown list items', () => {
  const report = formatMarkdownReport({
    eventId: 'event',
    runId: 'run',
    monitorId: 'monitor',
    monitorName: 'Monitor',
    date: '2026-10-08',
    changes: [
      {
        id: 'change',
        sourceId: 'pricing',
        status: 'classified',
        route: 'alert',
        reason: 'Material price change',
        evidence: { sourceUrl: 'https://public.example/pricing', beforeExcerpt: '$19', afterExcerpt: '$29' },
      },
    ],
  });
  expect(report).toContain('- Date: 2026-10-08\n- Monitor: monitor\n- Run: run\n- Event: event\n');
  expect(report).toContain(
    '- Status: classified\n- Route: alert\n- Reason: Material price change\n- Source: https://public.example/pricing\n',
  );
});

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';

import { Mastra } from '@mastra/core/mastra';
import { Classifier } from '@mastra/core/classifier';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadConfig, MODEL_DEFAULTS, POLICY_DEFAULTS } from '../src/mastra/config';
import {
  buildReport,
  createReportSummaryAgent,
  REPORT_SUMMARY_AGENT_ID,
  type SummaryAgent,
} from '../src/mastra/lib/reporting';
import { ensureDailyMonitorSchedule, monitorScheduleHistory } from '../src/mastra/lib/schedules';
import { MonitorStore } from '../src/mastra/lib/store';
import { createCompetitorMonitorWorkflow } from '../src/mastra/workflows/competitor-monitor-workflow';
import { COMPETITOR_CHANGE_QUESTIONS, QUESTION_SET_VERSION, RULE_VERSION } from '../src/mastra/lib/classification';

let stores: MonitorStore[] = [];
let frameworks: LibSQLStore[] = [];
afterEach(async () => {
  await Promise.all(stores.splice(0).map(store => store.close()));
  await Promise.all(frameworks.splice(0).map(store => store.close()));
});

const classifiedAnswers = {
  change_type: {
    type: 'choice' as const,
    choice: 'pricing',
    probabilities: {
      pricing: 1,
      packaging: 0,
      product_feature: 0,
      availability: 0,
      deprecation: 0,
      policy_terms: 0,
      security_compliance: 0,
      documentation: 0,
      company_announcement: 0,
      cosmetic_navigation: 0,
      mixed: 0,
      unknown: 0,
    },
  },
  relevance: { type: 'score' as const, score: 3 },
  business_impact: { type: 'score' as const, score: 3 },
  is_substantive: { type: 'boolean' as const, probability: 0.9 },
  is_breaking_change: { type: 'boolean' as const, probability: 0.1 },
  is_cosmetic_or_promotional: { type: 'boolean' as const, probability: 0.1 },
};

function fixtureClassifier(onEvaluate?: () => void) {
  return new Classifier({
    id: 'competitor-change-classifier',
    questions: COMPETITOR_CHANGE_QUESTIONS,
    model: {
      specificationVersion: 'v4',
      provider: 'fixture',
      modelId: 'fixture',
      supportedQuestionTypes: ['choice', 'score', 'boolean'],
      doEvaluate: async () => {
        onEvaluate?.();
        return {
          answers: classifiedAnswers,
          usage: {},
          warnings: [],
          rounding: {},
          providerMetadata: { typesafe: { confidence: { change_type: 1, relevance: 1, business_impact: 1 } } },
          response: { modelId: 'fixture', timestamp: new Date() },
        };
      },
    } as any,
  });
}

const input = (options: Record<string, unknown> = {}) => ({
  monitorId: 'report-monitor',
  runMode: 'manual' as const,
  profile: { name: 'Operator', interests: ['pricing'] as const, prioritySignals: [], ignoredSignals: [] },
  sources: [
    {
      id: 'pricing',
      label: 'Pricing',
      url: 'https://public.example/pricing',
      kind: 'pricing' as const,
      ignoreSelectors: [],
    },
  ],
  policy: {},
  options,
});

async function seededReport(options: Record<string, string | undefined> = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-report-'));
  const config = loadConfig({
    MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
    MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    ...options,
  });
  const store = MonitorStore.open(config.storage.monitorUrl);
  stores.push(store);
  const initial = await store.beginRun('report-monitor', 'native-initial');
  const baseline = await store.persistAcceptedSnapshot({
    runId: initial.id,
    monitorId: 'report-monitor',
    sourceId: 'pricing',
    sourceUrl: 'https://public.example/pricing',
    normalizationProfile: 'test',
    content: {
      text: 'Starter costs $19.',
      hash: 'before',
      language: 'english',
      lossRatio: 0,
      truncated: false,
      sections: [],
    },
    evidence: [],
    promoteBaseline: true,
  });
  await store.finishRun(initial, 'success', {});
  const run = await store.beginRun('report-monitor', 'native-report');
  await store.persistAcceptedSnapshot({
    runId: run.id,
    monitorId: 'report-monitor',
    sourceId: 'pricing',
    sourceUrl: 'https://public.example/pricing',
    normalizationProfile: 'test',
    content: {
      text: 'Starter costs $29.',
      hash: 'after',
      language: 'english',
      lossRatio: 0,
      truncated: false,
      sections: [],
    },
    beforeSnapshot: baseline,
    evidence: [
      {
        id: 'price',
        sectionKey: 'pricing',
        beforeText: 'Starter costs $19.',
        afterText: 'Starter costs $29.',
        beforeExcerpt: 'Starter costs $19.',
        afterExcerpt: 'Starter costs $29.',
        excerptTruncated: false,
        kind: 'modified',
      },
    ],
    promoteBaseline: true,
  });
  return { config, store, runId: run.id, candidateId: `${baseline.id}:` };
}

function changes(store: MonitorStore) {
  return store.pendingForRun as never;
}

async function executeMonitor(
  inputData: ReturnType<typeof input>,
  config: ReturnType<typeof loadConfig>,
  store: MonitorStore,
  fail = new Set<string>(),
  page = 'Public pricing and support information. ',
  classifier?: Classifier<any>,
) {
  const framework = new LibSQLStore({ id: `report-framework-${Math.random()}`, url: config.storage.mastraUrl });
  frameworks.push(framework);
  const workflow = createCompetitorMonitorWorkflow({
    store,
    config,
    resolver: async () => [{ address: '93.184.216.34', family: 4 }],
    transport: async ({ url }: { url: URL }) => {
      if (fail.has(url.pathname)) throw new Error('HTTP_500');
      return {
        status: 200,
        headers: { 'content-type': url.pathname === '/robots.txt' ? 'text/plain' : 'text/html' },
        body: new TextEncoder().encode(
          url.pathname === '/robots.txt'
            ? 'User-agent: *\\nAllow: /'
            : `<main><h1>Pricing</h1><p>${page.repeat(12)}</p></main>`,
        ),
      };
    },
  });
  const mastra = new Mastra({
    storage: framework,
    workflows: { competitorMonitor: workflow },
    ...(classifier ? { classifiers: { competitorChange: classifier } } : {}),
  });
  const run = await mastra.getWorkflow('competitorMonitor').createRun();
  const started = await run.start({ inputData: inputData as any });
  if (started.status !== 'success') throw new Error('WORKFLOW_FAILED');
  return started.result;
}

describe('grounded reports and native schedules', () => {
  it('report_preserves_evidence_when_summary_disabled_or_fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-public-report-'));
    const workflowConfig = loadConfig({
      MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
      TYPESAFE_AI_API_KEY: 'fixture',
    });
    const workflowStore = MonitorStore.open(workflowConfig.storage.monitorUrl);
    stores.push(workflowStore);
    await executeMonitor(
      input({ generateSummary: false }),
      workflowConfig,
      workflowStore,
      new Set(),
      'Starter costs $19. ',
    );
    let evaluations = 0;
    const publicResult = await executeMonitor(
      input({ generateSummary: false }),
      workflowConfig,
      workflowStore,
      new Set(),
      'Starter costs $29. ',
      fixtureClassifier(() => {
        evaluations += 1;
      }),
    );
    const nativeProvenance = {
      questionSetVersion: QUESTION_SET_VERSION,
      ruleVersion: RULE_VERSION,
      model: { requested: workflowConfig.models.jev, reported: 'fixture', verified: null },
    };
    expect(publicResult).toMatchObject({
      status: 'success',
      report: { summaryFailure: 'SUMMARY_DISABLED' },
      changes: [
        {
          route: 'alert',
          evidence: {
            sourceUrl: 'https://public.example/pricing',
            beforeExcerpt: expect.stringContaining('$19'),
            afterExcerpt: expect.stringContaining('$29'),
          },
          provenance: nativeProvenance,
        },
      ],
    });
    expect(evaluations).toBe(1);
    const durableRun = await workflowStore.client.execute({
      sql: 'SELECT result_json FROM monitor_runs WHERE id = ?',
      args: [publicResult.runId],
    });
    expect(JSON.parse(String(durableRun.rows[0]!.result_json))).toMatchObject({
      changes: [{ provenance: nativeProvenance }],
    });
    expect(await workflowStore.classification(publicResult.changes[0]!.id)).toMatchObject({
      questionSetVersion: QUESTION_SET_VERSION,
      ruleVersion: RULE_VERSION,
    });
    const { config, store, runId } = await seededReport();
    const pending = await store.pendingForRun(runId);
    const change = { id: pending[0]!.id, sourceId: 'pricing', status: 'classified' as const, route: 'alert' as const };
    const storedProvenance = {
      questionSetVersion: 'stored-question-set-v9',
      ruleVersion: 'stored-routing-v9',
      model: { requested: 'stored-requested', reported: 'stored-reported', verified: null },
    };
    await store.commitClassification({
      candidateId: change.id,
      questionSetVersion: storedProvenance.questionSetVersion,
      decision: {
        route: 'alert',
        reason: 'STORED_HISTORY',
        ruleVersion: storedProvenance.ruleVersion,
        effectivePolicy: POLICY_DEFAULTS,
      },
      audit: {
        requestedModel: storedProvenance.model.requested,
        reportedModel: storedProvenance.model.reported,
      },
    });
    const disabled = await buildReport({
      changes: [change],
      generateSummary: false,
      config,
      store,
    });
    expect(disabled).toMatchObject({
      summaryFailure: 'SUMMARY_DISABLED',
      changes: [{ evidence: { sourceUrl: expect.any(String) }, provenance: storedProvenance }],
    });
    expect(await store.classification(change.id)).toMatchObject({
      questionSetVersion: storedProvenance.questionSetVersion,
      ruleVersion: storedProvenance.ruleVersion,
    });
    const withoutClassification = await buildReport({
      changes: [
        {
          id: 'without-persisted-classification',
          sourceId: 'pricing',
          status: 'deferred',
          reason: 'PENDING',
          provenance: storedProvenance,
        },
      ],
      generateSummary: false,
      config,
      store,
    });
    expect(withoutClassification.changes[0]).not.toHaveProperty('provenance');
    const failingAgent: SummaryAgent = {
      generate: async () => Promise.reject(new Error('provider down')),
    } as SummaryAgent;
    const enabledConfig = loadConfig({
      OPENAI_API_KEY: 'synthetic-key',
      MONITOR_DATABASE_URL: config.storage.monitorUrl,
      MASTRA_DATABASE_URL: config.storage.mastraUrl,
    });
    const failed = await buildReport({
      changes: [change],
      generateSummary: true,
      config: enabledConfig,
      store,
      agent: failingAgent,
    });
    expect(failed).toMatchObject({ summaryFailure: 'SUMMARY_FAILED', changes: disabled.changes });
  });

  it('uses the configured summary model and request bounds with sanitized failures', async () => {
    const liveShape = await seededReport({
      OPENAI_API_KEY: 'synthetic-key',
    });
    const originalFetch = globalThis.fetch;
    const loggedErrors: unknown[][] = [];
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => loggedErrors.push(args));
    let request: { url: string; body: Record<string, unknown>; authorization: string | null } | undefined;
    globalThis.fetch = async (url, init) => {
      request = {
        url: String(url),
        body: JSON.parse(String(init?.body)),
        authorization: new Headers(init?.headers).get('authorization'),
      };
      return new Response('provider-message-marker', { status: 500 });
    };
    try {
      const result = await buildReport({
        changes: [
          {
            id: 'prompt-marker',
            sourceId: 'pricing',
            status: 'classified',
            route: 'review',
            evidence: {
              sourceUrl: 'https://private.example/prompt-marker',
              beforeExcerpt: 'prompt-marker-before',
              afterExcerpt: 'prompt-marker-after',
            },
          },
        ],
        generateSummary: true,
        config: liveShape.config,
        store: liveShape.store,
        agent: createReportSummaryAgent('credential-marker'),
      });
      expect(result.summaryFailure).toBe('SUMMARY_FAILED');
    } finally {
      globalThis.fetch = originalFetch;
      consoleError.mockRestore();
    }
    const renderedErrors = inspect(loggedErrors, { depth: null });
    expect(loggedErrors).toEqual([['SUMMARY_AGENT_REQUEST_FAILED', { agentId: REPORT_SUMMARY_AGENT_ID }]]);
    expect(renderedErrors).not.toContain('prompt-marker');
    expect(renderedErrors).not.toContain('provider-message-marker');
    expect(renderedErrors).not.toContain('credential-marker');
    expect(request).toMatchObject({ url: 'https://api.openai.com/v1/responses' });
    expect(request?.body).toMatchObject({
      model: 'gpt-6-luna',
      max_output_tokens: 800,
      reasoning: { effort: 'none' },
    });
    expect(inspect(request?.body, { depth: null })).toContain('prompt-marker');
    expect(request?.authorization).toContain('credential-marker');
  });

  it('validates summary evidence independently of provider usage availability', async () => {
    const { config, store, runId } = await seededReport({
      OPENAI_API_KEY: 'synthetic-key',
    });
    const pending = await store.pendingForRun(runId);
    const change = { id: pending[0]!.id, sourceId: 'pricing', status: 'classified' as const, route: 'alert' as const };
    const validObject = {
      explanation: 'The price increased.',
      citedChangeIds: [change.id],
      quotedEvidence: ['Starter costs $29.'],
    };

    const successful = await buildReport({
      changes: [change],
      generateSummary: true,
      config,
      store,
      agent: {
        generate: async () => ({
          object: validObject,
          usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
        }),
      } as unknown as SummaryAgent,
    });
    const invalidCitation = await buildReport({
      changes: [change],
      generateSummary: true,
      config,
      store,
      agent: {
        generate: async () => ({
          object: { ...validObject, citedChangeIds: ['not-supplied'] },
          usage: { inputTokens: 50, outputTokens: 4, totalTokens: 54 },
        }),
      } as unknown as SummaryAgent,
    });
    const missingUsage = await buildReport({
      changes: [change],
      generateSummary: true,
      config,
      store,
      agent: { generate: async () => ({ object: validObject }) } as unknown as SummaryAgent,
    });
    expect(successful).toMatchObject({ summary: validObject });
    expect(invalidCitation.summaryFailure).toBe('SUMMARY_INVALID');
    expect(missingUsage).toMatchObject({ summary: validObject });
  });
  it('keeps the native summary agent internal and validates bounded summary evidence before dispatch', async () => {
    const { config, store, runId } = await seededReport({});
    const pending = await store.pendingForRun(runId);
    let unconfiguredCalls = 0;
    const unconfigured = await buildReport({
      changes: [{ id: pending[0]!.id, sourceId: 'pricing', status: 'classified', route: 'alert' }],
      generateSummary: true,
      config,
      store,
      agent: {
        generate: async () => {
          unconfiguredCalls += 1;
          throw new Error('UNEXPECTED_DISPATCH');
        },
      } as unknown as SummaryAgent,
    });
    expect(unconfigured.summaryFailure).toBe('SUMMARY_NOT_CONFIGURED');
    expect(unconfiguredCalls).toBe(0);

    const runtimeFramework = new LibSQLStore({ id: 'internal-summary-framework', url: config.storage.mastraUrl });
    frameworks.push(runtimeFramework);
    const runtime = new Mastra({
      storage: runtimeFramework,
      workflows: { competitorMonitor: createCompetitorMonitorWorkflow({ store, config }) },
    });
    expect(runtime.listAgents()).not.toHaveProperty(REPORT_SUMMARY_AGENT_ID);
    expect(() => runtime.getAgentById(REPORT_SUMMARY_AGENT_ID as never)).toThrow('not found');

    const enabled = loadConfig({
      OPENAI_API_KEY: 'synthetic-key',
      MONITOR_DATABASE_URL: config.storage.monitorUrl,
      MASTRA_DATABASE_URL: config.storage.mastraUrl,
    });
    const change = { id: pending[0]!.id, sourceId: 'pricing', status: 'classified' as const, route: 'alert' as const };
    let calls = 0;
    const validAgent: SummaryAgent = {
      generate: async () => {
        calls += 1;
        return {
          object: {
            explanation: 'The price increased.',
            citedChangeIds: [change.id],
            quotedEvidence: ['Starter costs $29.'],
          },
        } as any;
      },
    } as SummaryAgent;
    const valid = await buildReport({
      changes: [change],
      generateSummary: true,
      config: enabled,
      store,
      agent: validAgent,
    });
    expect(valid.summary).toMatchObject({ citedChangeIds: [change.id], quotedEvidence: ['Starter costs $29.'] });
    expect(calls).toBe(1);

    const invalidId = await buildReport({
      changes: [change],
      generateSummary: true,
      config: enabled,
      store,
      agent: {
        generate: async () => ({
          object: { explanation: 'Untrusted.', citedChangeIds: ['not-supplied'], quotedEvidence: [] },
        }),
      } as unknown as SummaryAgent,
    });
    const invalidQuote = await buildReport({
      changes: [change],
      generateSummary: true,
      config: enabled,
      store,
      agent: {
        generate: async () => ({
          object: { explanation: 'Untrusted.', citedChangeIds: [change.id], quotedEvidence: ['invented quote'] },
        }),
      } as unknown as SummaryAgent,
    });
    expect(invalidId.summaryFailure).toBe('SUMMARY_INVALID');
    expect(invalidQuote.summaryFailure).toBe('SUMMARY_INVALID');

    const ignored = await buildReport({
      changes: [
        { ...change, route: 'ignore' },
        { ...change, id: 'record-only', route: 'record' },
      ],
      generateSummary: true,
      config: enabled,
      store,
      agent: validAgent,
    });
    const tooLarge = await buildReport({
      changes: [
        {
          id: 'oversized',
          sourceId: 'pricing',
          status: 'classified',
          route: 'review',
          evidence: {
            sourceUrl: 'https://public.example/pricing',
            beforeExcerpt: 'before'.repeat(1_000),
            afterExcerpt: 'after'.repeat(1_000),
          },
        },
      ],
      generateSummary: true,
      config: enabled,
      store,
      agent: validAgent,
    });
    const hostileBeforeExcerpt = `English price details ${'\uEFFF'.repeat(3_500)}`;
    const hostilePrompt = JSON.stringify([
      {
        id: 'hostile-unicode',
        route: 'review',
        sourceUrl: 'https://public.example/pricing',
        beforeExcerpt: hostileBeforeExcerpt,
        afterExcerpt: 'Updated price details.',
      },
    ]);
    expect(hostilePrompt.length).toBeLessThan(MODEL_DEFAULTS.summaryEvidenceMaxCharacters);
    expect(new TextEncoder().encode(hostilePrompt).byteLength).toBeGreaterThan(
      MODEL_DEFAULTS.summaryPromptMaxUtf8Bytes,
    );
    expect(MODEL_DEFAULTS.summaryPromptMaxUtf8Bytes + MODEL_DEFAULTS.summaryFixedInputTokenReserve).toBe(
      MODEL_DEFAULTS.summaryMaxInputTokens,
    );
    const hostileUnicode = await buildReport({
      changes: [
        {
          id: 'hostile-unicode',
          sourceId: 'pricing',
          status: 'classified',
          route: 'review',
          evidence: {
            sourceUrl: 'https://public.example/pricing',
            beforeExcerpt: hostileBeforeExcerpt,
            afterExcerpt: 'Updated price details.',
          },
        },
      ],
      generateSummary: true,
      config: enabled,
      store,
      agent: validAgent,
    });
    expect(ignored.summaryFailure).toBe('SUMMARY_NOT_APPLICABLE');
    expect(tooLarge.summaryFailure).toBe('SUMMARY_EVIDENCE_TOO_LARGE');
    expect(hostileUnicode.summaryFailure).toBe('SUMMARY_EVIDENCE_TOO_LARGE');
    expect(calls).toBe(1);
  });

  it('native_schedule_persists_and_runs_same_workflow', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-schedule-'));
    const config = loadConfig({
      MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    });
    const store = MonitorStore.open(config.storage.monitorUrl);
    stores.push(store);
    const framework = new LibSQLStore({ id: 'schedule-framework', url: config.storage.mastraUrl });
    frameworks.push(framework);
    const workflow = createCompetitorMonitorWorkflow({
      store,
      config,
      resolver: async () => [{ address: '93.184.216.34', family: 4 }],
      transport: async ({ url }: { url: URL }) => ({
        status: 200,
        headers: { 'content-type': url.pathname === '/robots.txt' ? 'text/plain' : 'text/html' },
        body: new TextEncoder().encode(
          url.pathname === '/robots.txt'
            ? 'User-agent: *\\nAllow: /'
            : `<main><h1>Pricing</h1><p>${'Public pricing and support information. '.repeat(12)}</p></main>`,
        ),
      }),
    });
    const mastra = new Mastra({ storage: framework, workflows: { competitorMonitor: workflow } });
    const schedule = await ensureDailyMonitorSchedule(mastra, input() as any);
    const repeated = await ensureDailyMonitorSchedule(mastra, input() as any);
    expect(repeated.id).toBe(schedule.id);
    await mastra.schedules.pause(schedule.id);
    expect((await mastra.schedules.get(schedule.id))?.status).toBe('paused');
    if (schedule.workflowId === undefined) throw new Error('WORKFLOW_SCHEDULE_EXPECTED');
    const manual = await mastra.getWorkflow('competitorMonitor').createRun({ runId: 'manual-same-workflow' });
    const manualResult = await manual.start({ inputData: schedule.inputData as any });
    if (manualResult.status !== 'success') throw new Error('SCHEDULED_INPUT_WORKFLOW_FAILED');
    expect(await store.runForNativeWorkflowRunId('manual-same-workflow')).toMatchObject({
      runId: manualResult.result.runId,
    });
    const reopenedStore = MonitorStore.open(config.storage.monitorUrl);
    stores.push(reopenedStore);
    const reopenedFramework = new LibSQLStore({ id: 'schedule-framework-reopened', url: config.storage.mastraUrl });
    frameworks.push(reopenedFramework);
    const reopenedWorkflow = createCompetitorMonitorWorkflow({
      store: reopenedStore,
      config,
      resolver: async () => [{ address: '93.184.216.34', family: 4 }],
      transport: async ({ url }: { url: URL }) => ({
        status: 200,
        headers: { 'content-type': url.pathname === '/robots.txt' ? 'text/plain' : 'text/html' },
        body: new TextEncoder().encode(
          url.pathname === '/robots.txt'
            ? 'User-agent: *\\nAllow: /'
            : `<main><h1>Pricing</h1><p>${'Public pricing and support information. '.repeat(12)}</p></main>`,
        ),
      }),
    });
    const reopenedMastra = new Mastra({
      storage: reopenedFramework,
      workflows: { competitorMonitor: reopenedWorkflow },
    });
    const definitions = await reopenedMastra.schedules.list({ workflowId: 'competitor-monitor' });
    expect(definitions).toEqual([expect.objectContaining({ id: schedule.id, status: 'paused' })]);
    const reopenedSchedulesStore = await reopenedMastra.getStorage()?.getStore('schedules');
    if (!reopenedSchedulesStore) throw new Error('SCHEDULES_STORAGE_MISSING');
    await reopenedSchedulesStore.updateSchedule(schedule.id, { nextFireAt: Date.now() - 1 });
    await reopenedMastra.startWorkers();
    await reopenedMastra.scheduler?.tick();
    expect(await monitorScheduleHistory(reopenedMastra, reopenedStore, schedule.id)).toEqual([]);

    await reopenedMastra.schedules.resume(schedule.id);
    await reopenedSchedulesStore.updateSchedule(schedule.id, { nextFireAt: Date.now() - 1 });
    await reopenedMastra.scheduler?.tick();
    let history = await monitorScheduleHistory(reopenedMastra, reopenedStore, schedule.id);
    for (
      let attempt = 0;
      !history.some(trigger => trigger.domainRun !== undefined && trigger.domainRun.status !== 'running');
      attempt += 1
    ) {
      if (attempt === 20) throw new Error('SCHEDULE_TICK_DID_NOT_COMPLETE');
      await new Promise(resolve => setTimeout(resolve, 25));
      history = await monitorScheduleHistory(reopenedMastra, reopenedStore, schedule.id);
    }
    const scheduled = history.find(
      trigger => trigger.domainRun !== undefined && trigger.domainRun.status !== 'running',
    );
    expect(scheduled).toMatchObject({ runId: expect.any(String), scheduledFireAt: expect.any(Number) });
    expect(scheduled?.domainRun).toMatchObject({ monitorId: 'report-monitor', status: 'success' });
    expect(scheduled?.domainRun?.status).toBe(
      manualResult.result.status === 'no_change' ? 'success' : manualResult.result.status,
    );
    await reopenedMastra.stopWorkers();
  });

  it('overlap_and_retry_do_not_duplicate_changes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-overlap-'));
    const config = loadConfig({
      MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
      TYPESAFE_AI_API_KEY: 'fixture',
    });
    const store = MonitorStore.open(config.storage.monitorUrl);
    stores.push(store);
    const framework = new LibSQLStore({ id: 'overlap-framework', url: config.storage.mastraUrl });
    frameworks.push(framework);
    let page = 'baseline pricing information ';
    let hold = false;
    let release!: () => void;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const workflow = createCompetitorMonitorWorkflow({
      store,
      config,
      resolver: async () => [{ address: '93.184.216.34', family: 4 }],
      transport: async ({ url }: { url: URL }) => {
        if (hold && url.pathname !== '/robots.txt') await held;
        return {
          status: 200,
          headers: { 'content-type': url.pathname === '/robots.txt' ? 'text/plain' : 'text/html' },
          body: new TextEncoder().encode(
            url.pathname === '/robots.txt' ? 'User-agent: *\\nAllow: /' : `<main>${page.repeat(12)}</main>`,
          ),
        };
      },
    });
    const mastra = new Mastra({ storage: framework, workflows: { competitorMonitor: workflow } });
    expect(await executeMonitor(input({ generateSummary: false }), config, store)).toMatchObject({ status: 'success' });
    page = 'changed pricing information ';
    hold = true;
    const first = await mastra.getWorkflow('competitorMonitor').createRun();
    const firstStart = first.start({ inputData: input({ generateSummary: false }) as any });
    await new Promise(resolve => setTimeout(resolve, 10));
    const second = await mastra.getWorkflow('competitorMonitor').createRun();
    const secondResult = await second.start({ inputData: input({ generateSummary: false }) as any });
    expect(secondResult.status).toBe('failed');
    if (secondResult.status !== 'failed') throw new Error('MONITOR_BUSY_NOT_REPORTED');
    expect(secondResult.error.message).toContain('MONITOR_BUSY');
    release();
    const firstResult = await firstStart;
    expect(firstResult.status).toBe('success');
    if (firstResult.status !== 'success') throw new Error('FIRST_WORKFLOW_FAILED');
    expect(firstResult.result).toMatchObject({ status: 'partial', counts: { sourcesRequested: 1, sourcesChecked: 1 } });
    const pending = await store.pendingCandidatesForSource('report-monitor', 'pricing');
    expect(pending.length).toBeGreaterThan(0);

    const reopenedStore = MonitorStore.open(config.storage.monitorUrl);
    stores.push(reopenedStore);
    const reopenedFramework = new LibSQLStore({ id: 'overlap-framework-reopened', url: config.storage.mastraUrl });
    frameworks.push(reopenedFramework);
    const reopenedWorkflow = createCompetitorMonitorWorkflow({
      store: reopenedStore,
      config,
      resolver: async () => [{ address: '93.184.216.34', family: 4 }],
      transport: async ({ url }: { url: URL }) => ({
        status: 200,
        headers: { 'content-type': url.pathname === '/robots.txt' ? 'text/plain' : 'text/html' },
        body: new TextEncoder().encode(
          url.pathname === '/robots.txt' ? 'User-agent: *\\nAllow: /' : `<main>${page.repeat(12)}</main>`,
        ),
      }),
    });
    const reopened = new Mastra({
      storage: reopenedFramework,
      workflows: { competitorMonitor: reopenedWorkflow },
      classifiers: { competitorChange: fixtureClassifier() },
    });
    const retry = await reopened.getWorkflow('competitorMonitor').createRun();
    const retryResult = await retry.start({ inputData: input({ generateSummary: false }) as any });
    expect(retryResult).toMatchObject({
      status: 'success',
      result: { status: 'success', counts: { candidatesClassified: pending.length } },
    });
    expect(await reopenedStore.classification(pending[0]!.candidateId)).toBeDefined();
    const duplicateRetry = await reopened.getWorkflow('competitorMonitor').createRun();
    const duplicateResult = await duplicateRetry.start({ inputData: input({ generateSummary: false }) as any });
    expect(duplicateResult).toMatchObject({
      status: 'success',
      result: { counts: { candidatesDetected: 0, candidatesClassified: 0 } },
    });
    const decisions = await reopenedStore.client.execute({
      sql: 'SELECT COUNT(*) AS count FROM classification_decisions WHERE candidate_id = ?',
      args: [pending[0]!.candidateId],
    });
    expect(Number(decisions.rows[0]?.count)).toBe(1);
  });

  it('aggregates_baseline_unchanged_partial_and_failed_runs', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-aggregate-'));
    const config = loadConfig({
      MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    });
    const store = MonitorStore.open(config.storage.monitorUrl);
    stores.push(store);
    const baseline = await executeMonitor(input({ generateSummary: false }), config, store);
    const unchanged = await executeMonitor(input({ generateSummary: false }), config, store);
    const mixedInput = input({ generateSummary: false });
    mixedInput.sources.push({
      id: 'broken',
      label: 'Broken',
      url: 'https://public.example/broken',
      kind: 'pricing',
      ignoreSelectors: [],
    });
    const partial = await executeMonitor(mixedInput, config, store, new Set(['/broken']));
    const failedInput = input({ generateSummary: false });
    failedInput.monitorId = 'failed-monitor';
    const failed = await executeMonitor(failedInput, config, store, new Set(['/pricing']));
    expect(baseline).toMatchObject({ status: 'success', counts: { sourcesChecked: 1, sourcesFailed: 0 } });
    expect(unchanged).toMatchObject({ status: 'no_change', counts: { sourcesChecked: 1, sourcesFailed: 0 } });
    expect(unchanged.sources).toEqual([]);
    expect(unchanged.counts).toMatchObject({ candidatesDetected: 0, candidatesClassified: 0, candidatesDeferred: 0 });
    expect(partial).toMatchObject({ status: 'partial', counts: { sourcesChecked: 1, sourcesFailed: 1 } });
    expect(failed).toMatchObject({ status: 'failed', counts: { sourcesChecked: 0, sourcesFailed: 1 } });
    const processingFailedInput = input({ generateSummary: false });
    processingFailedInput.monitorId = 'processing-failed-monitor';
    const processingFailed = await executeMonitor(processingFailedInput, config, store, new Set(), '123 '.repeat(100));
    expect(processingFailed).toMatchObject({ status: 'failed', counts: { sourcesChecked: 1, sourcesFailed: 1 } });
    const selectorMissingInput = input({ generateSummary: false });
    selectorMissingInput.monitorId = 'selector-missing-monitor';
    Object.assign(selectorMissingInput.sources[0]!, { fetchMode: 'http', contentSelector: '#missing' });
    const selectorMissing = await executeMonitor(selectorMissingInput, config, store);
    expect(selectorMissing).toMatchObject({
      status: 'failed',
      counts: { sourcesChecked: 1, sourcesFailed: 1 },
      sources: [{ sourceId: 'pricing', status: 'failed', error: { code: 'CONTENT_SELECTOR_MISSING' } }],
    });
  });
});

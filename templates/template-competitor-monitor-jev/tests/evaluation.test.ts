import { TestSpendingLedger } from './provider-spending-ledger';
import { PROJECT_BUDGET_USD } from './provider-spending-config';
import { createScorer } from '@mastra/core/evals';
import { Classifier } from '@mastra/core/classifier';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { expectEvals } from '@mastra/evals/vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { loadConfig } from '../src/mastra/config';
import {
  CLASSIFIER_ID,
  COMPETITOR_CHANGE_QUESTIONS,
  QUESTION_SET_VERSION,
  RULE_VERSION,
} from '../src/mastra/lib/classification';
import { reportEvaluation } from '../src/mastra/lib/evaluation';
import { MonitorStore } from '../src/mastra/lib/store';
import { createCompetitorMonitorWorkflow } from '../src/mastra/workflows/competitor-monitor-workflow';
import { EVALUATION_DATASET_VERSION, EVALUATION_FIXTURES, type EvaluationFixture } from './fixtures/evaluation-dataset';

const routableFixtures = EVALUATION_FIXTURES.filter(
  (fixture): fixture is EvaluationFixture & { expectedRoute: NonNullable<EvaluationFixture['expectedRoute']> } =>
    fixture.expectedRoute !== undefined,
);

type WorkflowProof = {
  classified: number;
  outcomes: Record<string, string>;
  report: ReturnType<typeof reportEvaluation>;
};

let workflowProof: WorkflowProof;

describe('Workflow evaluation dataset and reporting', () => {
  beforeAll(async () => {
    workflowProof = await runWorkflowProof();
  });

  it('evaluation_covers_labeled_change_families', () => {
    expect(new Set(EVALUATION_FIXTURES.map(fixture => fixture.family))).toEqual(
      new Set([
        'unchanged',
        'navigation',
        'promotion',
        'pricing',
        'packaging',
        'feature',
        'deprecation',
        'security',
        'documentation',
        'acquisition-failure',
        'injection',
        'unsupported-language',
      ]),
    );
    expect(EVALUATION_FIXTURES).toHaveLength(24);
    expect(EVALUATION_FIXTURES.filter(fixture => fixture.split === 'calibration')).toHaveLength(12);
    expect(EVALUATION_FIXTURES.filter(fixture => fixture.split === 'held-out')).toHaveLength(12);
    expect(new Set(EVALUATION_FIXTURES.map(fixture => fixture.id)).size).toBe(EVALUATION_FIXTURES.length);
    expect(workflowProof.classified).toBe(routableFixtures.length);
    expect(workflowProof.outcomes).toMatchObject({
      'unchanged-copy': 'no_change',
      'login-page': 'BLOCKED_OR_AUTHENTICATED_CONTENT',
      'anti-bot-challenge-calibration': 'BLOCKED_OR_AUTHENTICATED_CONTENT',
      'server-error-calibration': 'HTTP_401',
      'unsupported-language': 'UNSUPPORTED_LANGUAGE',
    });
  });

  it('evaluation_reports_versions_denominators_and_budget', () => {
    expect(workflowProof.report).toMatchObject({
      datasetVersion: EVALUATION_DATASET_VERSION,
      questionSetVersion: QUESTION_SET_VERSION,
      ruleVersion: RULE_VERSION,
      sampleSize: { total: 24, calibration: 12, heldOut: 12, classified: routableFixtures.length },
      metrics: {
        routeAccuracy: { denominator: routableFixtures.length },
        evidenceAttribution: { numerator: routableFixtures.length, denominator: routableFixtures.length },
        supportedSummaries: { numerator: 0, denominator: 0 },
      },
      provenance: {
        model: { requested: 'fixture', reported: null, verified: null },
        usage: { inputTokens: null, outputTokens: null },
        budget: { provider: 'jev', knownUsd: 0.002 },
      },
    });
    expect(workflowProof.report.provenance.budget?.unresolvedUsd).toBe(0.01);
  });
});

async function runWorkflowProof(): Promise<WorkflowProof> {
  const directory = await mkdtemp(join(tmpdir(), 'product-eval-'));
  const config = loadConfig({
    MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
    MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    TYPESAFE_AI_API_KEY: 'synthetic-key',
  });
  const store = MonitorStore.open(config.storage.monitorUrl);
  let useAfterSnapshots = false;
  const fixtureForState = (state: unknown) =>
    routableFixtures.find(fixture => JSON.stringify(state).includes(fixture.evidence!.afterText));
  const classifier = new Classifier({
    id: CLASSIFIER_ID,
    questions: COMPETITOR_CHANGE_QUESTIONS,
    model: {
      specificationVersion: 'v4',
      provider: 'fixture',
      modelId: 'fixture',
      supportedQuestionTypes: ['choice', 'score', 'boolean'],
      doEvaluate: async (input: any) => {
        const fixture = fixtureForState(input.state ?? input.input?.state ?? input);
        if (!fixture?.answers) throw new Error('FIXTURE_CLASSIFIER_STATE_NOT_FOUND');
        return {
          answers: {
            ...fixture.answers,
            change_type: {
              ...fixture.answers.change_type,
              probabilities: Object.fromEntries(
                Object.keys(COMPETITOR_CHANGE_QUESTIONS.change_type.criteria).map(choice => [
                  choice,
                  choice === fixture.answers!.change_type.choice ? 0.9 : 0.1 / 11,
                ]),
              ),
            },
          },
          usage: {},
          warnings: [],
          rounding: {},
          providerMetadata: { typesafe: { confidence: { change_type: 1, relevance: 1, business_impact: 1 } } },
          response: { modelId: 'fixture', timestamp: new Date() },
        };
      },
    } as any,
  });
  const workflow = createCompetitorMonitorWorkflow({
    store,
    config,
    resolver: async () => [{ address: '93.184.216.34', family: 4 }],
    transport: async ({ url }: { url: URL }) => {
      if (url.pathname === '/robots.txt') {
        return {
          status: 200,
          headers: { 'content-type': 'text/plain' },
          body: new TextEncoder().encode('User-agent: *\nAllow: /'),
        };
      }
      const id = url.pathname.slice(1);
      const fixture = EVALUATION_FIXTURES.find(item => item.id === id)!;
      if (fixture.id === 'login-page') {
        return {
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: new TextEncoder().encode(
            '<main><h1>Sign in</h1><input type="password" /><p>Sign in to continue.</p></main>',
          ),
        };
      }
      if (fixture.id === 'anti-bot-challenge-calibration') {
        return {
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: new TextEncoder().encode(
            '<main><h1>Verify you are human</h1><p>Challenge request blocked. Enable cookies.</p></main>',
          ),
        };
      }
      if (fixture.id === 'server-error-calibration')
        return { status: 401, headers: { 'content-type': 'text/html' }, body: new Uint8Array() };
      if (fixture.family === 'unsupported-language') {
        return {
          status: 200,
          headers: { 'content-type': 'text/html', 'content-language': 'pt' },
          body: new TextEncoder().encode('<main>conteúdo em português suficiente para teste</main>'),
        };
      }
      const text = fixture.evidence
        ? useAfterSnapshots
          ? fixture.evidence.afterText
          : fixture.evidence.beforeText
        : 'Same retained content.';
      const filler =
        ' This public English page contains product pricing support and documentation details for customers. ';
      return {
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: new TextEncoder().encode(`<main><p>${text}</p><p>${filler.repeat(30)}</p></main>`),
      };
    },
  });
  const framework = new LibSQLStore({ id: 'product-eval', url: config.storage.mastraUrl });
  const mastra = new Mastra({
    storage: framework,
    workflows: { competitorMonitor: workflow },
    classifiers: { competitorChange: classifier },
  });
  const inputFor = (fixture: EvaluationFixture) => ({
    monitorId: `product-eval-${fixture.id}`,
    runMode: 'manual' as const,
    profile: {
      name: 'Evaluator',
      interests: ['pricing'] as Array<'pricing'>,
      prioritySignals: [],
      ignoredSignals: [],
    },
    sources: [
      {
        id: fixture.id,
        label: fixture.family,
        url: `https://public.example/${fixture.id}`,
        kind: 'pricing' as const,
        fetchMode: 'auto' as const,
        ignoreSelectors: [],
      },
    ],
    policy: {},
    options: { generateSummary: false },
  });
  try {
    for (const fixture of [
      ...routableFixtures,
      ...EVALUATION_FIXTURES.filter(fixture => fixture.expectedAcquisition === 'unchanged'),
    ]) {
      const baseline = await mastra.getWorkflow('competitorMonitor').createRun();
      const baselineResult = await baseline.start({ inputData: { ...inputFor(fixture), runMode: 'baseline' } });
      expect(baselineResult.status).toBe('success');
      if (baselineResult.status === 'success') {
        expect(baselineResult.result.sources).toEqual([expect.objectContaining({ status: 'baseline_created' })]);
      }
    }
    useAfterSnapshots = true;
    const gate = createScorer({
      id: 'product-workflow-route',
      description: 'The persisted public workflow result reports the labeled alert route.',
      type: { input: z.any(), output: z.any() },
    }).generateScore(({ run }) => {
      const output = run.output?.result ?? run.output;
      return output?.changes?.[0]?.route === run.groundTruth ? 1 : 0;
    });
    const result = await expectEvals({
      target: mastra.getWorkflow('competitorMonitor'),
      data: routableFixtures.map(fixture => ({ input: inputFor(fixture), groundTruth: fixture.expectedRoute })),
      gates: [gate],
      concurrency: 1,
    }).toPass();
    expect(result).toPassGates();
    const nonroutableObservations = [];
    const outcomes: Record<string, string> = {};
    for (const fixture of EVALUATION_FIXTURES.filter(fixture => !fixture.expectedRoute)) {
      const run = await mastra.getWorkflow('competitorMonitor').createRun();
      const outcome = await run.start({ inputData: inputFor(fixture) });
      expect(outcome.status).toBe('success');
      if (outcome.status !== 'success') throw new Error(`FIXTURE_WORKFLOW_${outcome.status.toUpperCase()}`);
      const output = outcome.result;
      if (fixture.expectedAcquisition === 'unchanged') {
        expect(output).toMatchObject({ status: 'no_change', counts: { candidatesDetected: 0 } });
        outcomes[fixture.id] = output.status;
      } else {
        const source = output.sources[0];
        expect(source).toMatchObject({ sourceId: fixture.id, status: 'failed' });
        expect(source?.error?.code).toBe(
          fixture.family === 'unsupported-language'
            ? 'UNSUPPORTED_LANGUAGE'
            : fixture.id === 'server-error-calibration'
              ? 'HTTP_401'
              : 'BLOCKED_OR_AUTHENTICATED_CONTENT',
        );
        outcomes[fixture.id] = source!.error!.code;
      }
      nonroutableObservations.push({ id: fixture.id, split: fixture.split });
    }
    const persisted = await store.client.execute({
      sql: `SELECT p.source_id, p.evidence_json, c.decision_json
              FROM pending_evidence p JOIN classification_decisions c ON c.candidate_id = p.id
              WHERE p.monitor_id LIKE ?`,
      args: ['product-eval-%'],
    });
    expect(persisted.rows).toHaveLength(routableFixtures.length);
    const fixtureById = new Map(routableFixtures.map(fixture => [fixture.id, fixture]));
    const observations = persisted.rows.map(row => {
      const fixture = fixtureById.get(String(row.source_id));
      const evidence = JSON.parse(String(row.evidence_json)) as { beforeText?: string; afterText?: string };
      const decision = JSON.parse(String(row.decision_json)) as { route: string };
      expect(fixture).toBeTruthy();
      return {
        id: fixture!.id,
        split: fixture!.split,
        expectedRoute: fixture!.expectedRoute,
        actualRoute: decision.route as NonNullable<EvaluationFixture['expectedRoute']>,
        evidenceAttributed:
          evidence.beforeText === fixture!.evidence!.beforeText && evidence.afterText === fixture!.evidence!.afterText,
      };
    });
    const spending = new TestSpendingLedger(store.client);
    const knownReservation = await spending.reserveProviderBudget({
      provider: 'jev',
      candidateId: 'report-known',
      amountUsd: 0.01,
      ceilingUsd: PROJECT_BUDGET_USD.jev,
    });
    expect(knownReservation).toBeTruthy();
    expect(
      await spending.settleProviderReservation({ id: knownReservation!, knownAmountUnits: 2_000, unresolvedUnits: 0 }),
    ).toBe(true);
    const unresolvedReservation = await spending.reserveProviderBudget({
      provider: 'jev',
      candidateId: 'report-unresolved',
      amountUsd: 0.01,
      ceilingUsd: PROJECT_BUDGET_USD.jev,
    });
    expect(unresolvedReservation).toBeTruthy();
    const accounting = await spending.providerBudgetAccounting('jev');
    const report = reportEvaluation({
      datasetVersion: EVALUATION_DATASET_VERSION,
      questionSetVersion: QUESTION_SET_VERSION,
      ruleVersion: RULE_VERSION,
      observations: [...observations, ...nonroutableObservations],
      provenance: {
        model: { requested: 'fixture' },
        budget: { provider: 'jev', ceilingUsd: PROJECT_BUDGET_USD.jev, ...accounting },
      },
    });
    expect(report).toMatchObject({
      datasetVersion: EVALUATION_DATASET_VERSION,
      questionSetVersion: QUESTION_SET_VERSION,
      ruleVersion: RULE_VERSION,
      sampleSize: { total: 24, calibration: 12, heldOut: 12, classified: routableFixtures.length },
      metrics: {
        routeAccuracy: { denominator: routableFixtures.length },
        evidenceAttribution: { numerator: routableFixtures.length, denominator: routableFixtures.length },
        supportedSummaries: { numerator: 0, denominator: 0 },
      },
      provenance: {
        model: { requested: 'fixture', reported: null, verified: null },
        usage: { inputTokens: null, outputTokens: null },
        budget: { provider: 'jev', ceilingUsd: PROJECT_BUDGET_USD.jev, knownUsd: 0.002 },
      },
    });
    expect(report.provenance.budget?.unresolvedUsd).toBe(0.01);
    expect(report.provenance.budget?.reservedUsd).toBe(
      (report.provenance.budget?.knownUsd ?? 0) + (report.provenance.budget?.unresolvedUsd ?? 0),
    );
    expect(report.metrics.supportedSummaries.value).toBeUndefined();
    return { classified: persisted.rows.length, outcomes, report };
  } finally {
    await framework.close();
    await store.close();
  }
}

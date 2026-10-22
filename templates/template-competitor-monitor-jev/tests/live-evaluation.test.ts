import {
  CLASSIFICATION_LIMITS,
  PRICING_REFERENCE,
  PROJECT_BUDGET_USD,
  JEV_TEST_CALL_RESERVATION_USD,
} from './provider-spending-config';
import { TestSpendingLedger } from './provider-spending-ledger';
import { createTypeSafeAi } from '@ai-sdk/typesafe-ai';
import { Classifier } from '@mastra/core/classifier';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, describe, expect, it } from 'vitest';

import { SOURCE_LIMITS, TIMING, loadConfig } from '../src/mastra/config';
import {
  classificationState,
  COMPETITOR_CHANGE_QUESTIONS,
  CLASSIFIER_ID,
  QUESTION_SET_VERSION,
  RULE_VERSION,
  routeClassification,
} from '../src/mastra/lib/classification';
import { LIVE_EVALUATION_DATASET_VERSION, reportEvaluation } from '../src/mastra/lib/evaluation';
import { MonitorStore } from '../src/mastra/lib/store';
import { validateMonitorInput, type MonitorInput } from '../src/mastra/schemas';
import { createCompetitorMonitorWorkflow } from '../src/mastra/workflows/competitor-monitor-workflow';

let monitorStore: MonitorStore | undefined;
let frameworkStore: LibSQLStore | undefined;
afterEach(async () => {
  await monitorStore?.close();
  await frameworkStore?.close();
  monitorStore = undefined;
  frameworkStore = undefined;
});

function liveInput(): MonitorInput {
  const raw = process.env.LIVE_MONITOR_INPUT_JSON;
  expect(raw, 'LIVE_MONITOR_INPUT_JSON must contain the documented real-source monitor input').toBeTruthy();
  const input = validateMonitorInput(JSON.parse(raw!));
  expect(new Set(input.sources.map(source => source.kind))).toEqual(new Set(['pricing', 'changelog', 'documentation']));
  expect(input.options.generateSummary, 'Live selectors do not configure a summary agent').toBe(false);
  return input;
}

function createLiveClassifier(config: ReturnType<typeof loadConfig>) {
  const expectedAttestation =
    config.jev.accessMode === 'vercel-gateway'
      ? `vercel-ai-gateway-typesafe-2026-09-29:${config.models.jev}`
      : `typesafe-jev-2026-09-27:${config.models.jev}`;
  expect(process.env.JEV_COST_ATTESTATION, 'Paid tests require a verified tariff').toBe(expectedAttestation);
  const model = createTypeSafeAi({
    apiKey: config.credentials.jevApiKey!,
    baseURL: config.jev.baseURL,
  }).evaluationModel(config.models.jev);
  const spending = new TestSpendingLedger(monitorStore!.client);
  const guardedModel: typeof model = {
    specificationVersion: model.specificationVersion,
    provider: model.provider,
    supportedQuestionTypes: model.supportedQuestionTypes,
    modelId: model.modelId,
    async doEvaluate(options) {
      // Native retries call this method again; each attempted provider call reserves independently.
      const id = await spending.reserveProviderBudget({
        provider: 'jev',
        candidateId: 'live-test-evaluation',
        amountUsd: JEV_TEST_CALL_RESERVATION_USD,
        ceilingUsd: PROJECT_BUDGET_USD.jev,
      });
      if (!id) throw new Error('TEST_JEV_BUDGET_EXHAUSTED');
      const result = await model.doEvaluate(options);
      const { inputTokens, outputTokens } = result.usage ?? {};
      if (
        typeof inputTokens === 'number' &&
        typeof outputTokens === 'number' &&
        Number.isSafeInteger(inputTokens) &&
        Number.isSafeInteger(outputTokens) &&
        inputTokens >= 0 &&
        outputTokens >= 0
      ) {
        await spending.settleProviderReservation({
          id,
          knownAmountUnits: Math.ceil(
            ((inputTokens * PRICING_REFERENCE.jevInputUsdPerMillion +
              outputTokens * PRICING_REFERENCE.jevOutputUsdPerMillion) /
              PRICING_REFERENCE.tokensPerPricingUnit) *
              CLASSIFICATION_LIMITS.usdReservationUnits,
          ),
          unresolvedUnits: 0,
        });
      }
      return result;
    },
  };
  return new Classifier({ id: CLASSIFIER_ID, model: guardedModel, questions: COMPETITOR_CHANGE_QUESTIONS });
}

async function verifyManualStudioSmoke(config: ReturnType<typeof loadConfig>, input: MonitorInput) {
  const raw = process.env.MANUAL_STUDIO_SMOKE_RECORD_JSON;
  expect(raw, 'MANUAL_STUDIO_SMOKE_RECORD_JSON must contain the retained Studio run record').toBeTruthy();
  const record = JSON.parse(raw!) as Record<string, unknown>;
  expect(typeof record.nativeWorkflowRunId).toBe('string');
  expect(typeof record.monitorId).toBe('string');
  expect(typeof record.sourceId).toBe('string');
  expect(typeof record.sourceUrl).toBe('string');
  expect(typeof record.observedAt).toBe('string');
  expect(Date.parse(String(record.observedAt))).toBeLessThanOrEqual(Date.now());
  expect(record.monitorId).toBe(input.monitorId);
  const source = input.sources.find(item => item.id === record.sourceId);
  expect(source, 'Smoke record source must be in LIVE_MONITOR_INPUT_JSON').toBeTruthy();
  expect(record.sourceUrl).toBe(new URL(source!.url).toString());
  const smokeSources = Array.isArray(record.sources) ? record.sources : [];
  const smokeSource = smokeSources.find(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object' && (item as Record<string, unknown>).id === record.sourceId,
  );
  expect(smokeSource, 'Smoke record must retain the recorded source capture').toBeTruthy();
  expect(smokeSource!.url).toBe(record.sourceUrl);
  expect(smokeSource!.status).toBe('accepted');
  expect(typeof smokeSource!.capturedAt).toBe('string');
  expect(Date.parse(String(smokeSource!.capturedAt))).toBeLessThanOrEqual(Date.parse(String(record.observedAt)));
  expect(String(smokeSource!.contentHashPrefix)).toMatch(/^[a-f0-9]{16}$/);

  monitorStore ??= MonitorStore.open(config.storage.monitorUrl);
  await monitorStore.init();
  const storedRun = await monitorStore.runForNativeWorkflowRunId(String(record.nativeWorkflowRunId));
  expect(storedRun, 'Smoke record must name a persisted native Studio workflow run').toBeTruthy();
  expect(storedRun!.monitorId).toBe(input.monitorId);
  // The domain result can be no_change even though the persisted native run completed successfully.
  expect((storedRun!.result as { status?: string } | undefined)?.status ?? storedRun!.status).toMatch(
    /^(success|partial|failed|no_change)$/,
  );
  const captured = await monitorStore.snapshotForRunSource(storedRun!.runId, source!.id);
  expect(captured).toMatchObject({ status: 'accepted' });
  expect(captured?.snapshot, 'Smoke run source outcome must name an immutable snapshot').toBeTruthy();
  expect(captured!.snapshot!.sourceUrl).toBe(new URL(source!.url).toString());
  expect(captured!.snapshot!.createdAt).toBe(String(smokeSource!.capturedAt));
  expect(captured!.snapshot!.content.hash.startsWith(String(smokeSource!.contentHashPrefix))).toBe(true);
}

/**
 * This selector is intentionally separate from offline fixtures. It never substitutes
 * synthetic acquisition, baseline, or classifier output for a live demonstration.
 */
describe('Live evaluation prerequisites', () => {
  it(
    'npm_quickstart_runs_demo_workflow',
    async () => {
      const config = loadConfig();
      const input = liveInput();
      await verifyManualStudioSmoke(config, input);
    },
    TIMING.evalTestTimeoutMs,
  );

  it(
    'live_demo_uses_real_sites_and_genuine_history',
    async () => {
      const config = loadConfig();
      const input = liveInput();
      await verifyManualStudioSmoke(config, input);
      expect(config.credentials.jevApiKey, 'The selected Jev access mode requires its configured API key').toBeTruthy();
      monitorStore ??= MonitorStore.open(config.storage.monitorUrl);
      await monitorStore.init();
      const previousBaselines = new Map(
        await Promise.all(
          input.sources.map(
            async source => [source.id, await monitorStore!.baseline(input.monitorId, source.id)] as const,
          ),
        ),
      );

      const classifier = createLiveClassifier(config);
      const workflow = createCompetitorMonitorWorkflow({ store: monitorStore, config });
      frameworkStore = new LibSQLStore({ id: 'live-evaluation', url: config.storage.mastraUrl });
      const mastra = new Mastra({
        storage: frameworkStore,
        workflows: { competitorMonitor: workflow },
        classifiers: { competitorChange: classifier },
      });
      const run = await mastra.getWorkflow('competitorMonitor').createRun();
      const started = await run.start({ inputData: input });
      if (started.status !== 'success') throw new Error(`LIVE_WORKFLOW_${started.status.toUpperCase()}`);
      const result = started.result;
      expect(result.sources).toHaveLength(input.sources.length);
      expect(result.sources.every(source => source.status !== 'failed' || source.error)).toBe(true);
      for (const source of input.sources) {
        const outcome = result.sources.find(item => item.sourceId === source.id)!;
        if (outcome.status === 'failed') continue;
        expect(outcome.acquisitionCompleted).toBe(true);
        const persisted = await monitorStore.baseline(input.monitorId, source.id);
        expect(persisted).toBeTruthy();
        expect(persisted!.sourceUrl).toBe(new URL(source.url).toString());
        expect(Date.parse(persisted!.createdAt)).toBeLessThanOrEqual(Date.now());
        expect(persisted!.content.hash).toMatch(/^[a-f0-9]{64}$/);
        const previous = previousBaselines.get(source.id);
        if (previous) expect(previous.sourceUrl).toBe(persisted!.sourceUrl);
      }
      expect(result.changes.every(change => change.status !== 'classified' || change.provenance?.model.requested)).toBe(
        true,
      );
    },
    TIMING.evalTestTimeoutMs,
  );

  it(
    'live_jev_evaluation_reports_held_out_examples',
    async () => {
      const config = loadConfig();
      const input = liveInput();
      await verifyManualStudioSmoke(config, input);
      expect(config.credentials.jevApiKey, 'The selected Jev access mode requires its configured API key').toBeTruthy();
      const cases = JSON.parse(process.env.LIVE_EVALUATION_CASES_JSON ?? '[]') as Array<any>;
      expect(
        cases.length,
        'LIVE_EVALUATION_CASES_JSON must contain labeled held-out operator-supplied evidence',
      ).toBeGreaterThan(0);
      expect(cases.length).toBeLessThanOrEqual(SOURCE_LIMITS.maxCandidatesPerSource);
      const seenIds = new Set<string>();
      const validatedCases = cases.map(item => {
        expect(item.split).toBe('held-out');
        expect(typeof item.id).toBe('string');
        expect(item.id.trim()).toBeTruthy();
        expect(seenIds.has(item.id), `Duplicate held-out evaluation ID: ${item.id}`).toBe(false);
        seenIds.add(item.id);
        expect(['alert', 'review', 'record', 'ignore']).toContain(item.expectedRoute);
        expect(item.evidence).toMatchObject({
          id: item.id,
          beforeText: expect.any(String),
          afterText: expect.any(String),
          sectionKey: expect.any(String),
          kind: expect.any(String),
        });
        expect(['operator-supplied-live-jev-experiment', 'synthetic-held-out-live-jev-experiment']).toContain(
          item.provenance?.kind,
        );
        expect(typeof item.provenance?.reviewedAt).toBe('string');
        expect(Date.parse(item.provenance.reviewedAt)).not.toBeNaN();
        const state = classificationState(item.classificationState);
        expect(JSON.stringify(state).length).toBeLessThanOrEqual(SOURCE_LIMITS.maxCandidateStateChars);
        expect(state.evidence.before).toBe(item.evidence.beforeText);
        expect(state.evidence.after).toBe(item.evidence.afterText);
        return { item, state };
      });
      monitorStore ??= MonitorStore.open(config.storage.monitorUrl);
      await monitorStore.init();
      const classifier = createLiveClassifier(config);
      const observations = [];
      const reportedModels = new Set<string>();
      let missingReportedModel = false;
      let inputTokens = 0;
      let outputTokens = 0;
      let completeInputUsage = true;
      let completeOutputUsage = true;
      for (const { item, state } of validatedCases) {
        const evaluated = await classifier.evaluate({
          state,
          abortSignal: AbortSignal.timeout(TIMING.jevCallMs),
          maxRetries: 0,
        });
        const evaluatedInputTokens = evaluated.usage.inputTokens;
        const evaluatedOutputTokens = evaluated.usage.outputTokens;
        if (typeof evaluated.response.modelId === 'string' && evaluated.response.modelId) {
          reportedModels.add(evaluated.response.modelId);
        } else missingReportedModel = true;
        if (
          typeof evaluatedInputTokens === 'number' &&
          Number.isSafeInteger(evaluatedInputTokens) &&
          evaluatedInputTokens >= 0
        ) {
          inputTokens += evaluatedInputTokens;
        } else completeInputUsage = false;
        if (
          typeof evaluatedOutputTokens === 'number' &&
          Number.isSafeInteger(evaluatedOutputTokens) &&
          evaluatedOutputTokens >= 0
        ) {
          outputTokens += evaluatedOutputTokens;
        } else completeOutputUsage = false;
        observations.push({
          id: item.id,
          split: 'held-out' as const,
          expectedRoute: item.expectedRoute,
          actualRoute: routeClassification(item.evidence, evaluated.answers, evaluated.providerMetadata).route,
          evidenceAttributed:
            state.evidence.before === item.evidence.beforeText && state.evidence.after === item.evidence.afterText,
          choiceConfidence: (evaluated.providerMetadata as any)?.typesafe?.confidence?.change_type,
        });
      }
      const accounting = await new TestSpendingLedger(monitorStore.client).providerBudgetAccounting('jev');
      const report = reportEvaluation({
        datasetVersion: LIVE_EVALUATION_DATASET_VERSION,
        questionSetVersion: QUESTION_SET_VERSION,
        ruleVersion: RULE_VERSION,
        observations,
        provenance: {
          model: {
            requested: config.models.jev,
            reported:
              !missingReportedModel && reportedModels.size === 1
                ? [...reportedModels][0]
                : reportedModels.size > 1
                  ? 'mixed'
                  : undefined,
          },
          usage: {
            inputTokens: completeInputUsage ? inputTokens : undefined,
            outputTokens: completeOutputUsage ? outputTokens : undefined,
          },
          budget: {
            provider: 'jev',
            ceilingUsd: PROJECT_BUDGET_USD.jev,
            reservedUsd: accounting.reservedUsd,
            knownUsd: accounting.knownUsd,
            unresolvedUsd: accounting.unresolvedUsd,
          },
        },
      });
      console.info(
        'LIVE_EVALUATION_REPORT',
        JSON.stringify({
          datasetVersion: report.datasetVersion,
          questionSetVersion: report.questionSetVersion,
          ruleVersion: report.ruleVersion,
          sampleSize: report.sampleSize,
          metrics: report.metrics,
          provenance: {
            model: report.provenance.model,
            usageKnown: {
              input: report.provenance.usage.inputTokens !== null,
              output: report.provenance.usage.outputTokens !== null,
            },
            budget: report.provenance.budget,
          },
          limitations: [
            'Held-out evidence is separately labeled and is not live-site provenance.',
            'A null model identity or usage component remains unknown.',
          ],
        }),
      );
      expect(report.sampleSize.heldOut).toBe(validatedCases.length);
      expect(report.provenance.model.requested).toBe(config.models.jev);
      expect(report.provenance.model.reported).toBe(
        !missingReportedModel && reportedModels.size === 1
          ? [...reportedModels][0]
          : reportedModels.size > 1
            ? 'mixed'
            : null,
      );
    },
    TIMING.evalTestTimeoutMs,
  );
});

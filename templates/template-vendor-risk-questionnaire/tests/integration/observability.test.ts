import { canonicalJson, sha256 } from '../../src/mastra/intake/source.ts';
import { questionInterpretationAgent } from '../../src/mastra/agents/question-interpretation.ts';
import { evidenceAnswerAgent } from '../../src/mastra/agents/evidence-answer.ts';
import { supportVerifierAgent } from '../../src/mastra/agents/support-verifier.ts';
import { answerConsistencyAgent } from '../../src/mastra/agents/answer-consistency.ts';
import { it, expect, vi } from 'vitest';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { Mastra } from '@mastra/core';
import { DuckDBStore } from '@mastra/duckdb';
import { createNativeStorage, telemetryPath } from '../../src/mastra/persistence/database.ts';
import { TestExporter } from '@mastra/observability';
import { SpanType } from '@mastra/core/observability';
import { reviewFixture, decision, attachParent } from '../support/review.ts';
import { draftingFixture, controlledProvider } from '../support/drafting.ts';
import { submitReview } from '../../src/mastra/review/service.ts';
import { publishExport } from '../../src/mastra/exports/publication.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { openDatabase } from '../../src/mastra/persistence/database.ts';
import { recoverQuestionnaire } from '../../src/mastra/workflows/vendor-risk-questionnaire.ts';
import { createQuestionnaireWorkflow } from '../../src/mastra/workflows/vendor-risk-questionnaire.ts';
import { readDomainMetrics } from '../../src/mastra/observability/metrics.ts';
import { createLocalObservability, SafeLogger, telemetryId } from '../../src/mastra/observability/privacy.ts';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';
import { defaultExecutionPolicy } from '../../src/mastra/contracts/execution-policy.ts';

it('reports_truthful_domain_metrics_without_duplicate_events', async () => {
  const root = await temporaryDirectory();
  try {
    const f = await reviewFixture(
      root,
      {
        questions: [
          { text: 'Does workforce MFA apply?' },
          { text: 'No evidence?' },
          { text: 'Describe production logs.', kind: 'free_text' },
        ],
      },
      [{ failures: 1, missingUsage: true }, { value: 'unknown' }, { value: 'free_text' }],
    );
    const initial = await readDomainMetrics(f.url, f.runId);
    expect(initial.supportedAnswerRate).toBeNull();
    expect(initial.firstRouting).toMatchObject({ autoDraft: 2, escalated: 1, recorded: 3 });
    expect(initial.usage.physicalCalls).toBe(f.provider.calls.length);
    expect(initial.usage.uncertainCalls).toBeGreaterThan(0);
    expect(initial.usage.inputTokens).toBeNull();
    const d = decision(f),
      original = f.status.results[0]!.draft!;
    d.dispositions[0]!.correction = {
      ...original,
      text: 'Production workforce MFA is required for all workforce administrators.',
      claims: original.claims.map(c => ({
        ...c,
        text: 'Production workforce MFA is required for all workforce administrators.',
      })),
    };
    const approved = (await submitReview(d, f.options))!;
    expect(await submitReview(d, f.options)).toEqual(approved);
    await f.mastra.shutdown();
    const restarted = attachParent(f, f.provider.factory);
    const resumed = await (
      await recoverQuestionnaire(restarted.workflow, f.state.workflowRunId)
    ).run.resume({
      step: 'review-answer-set',
      resumeData: { approvalId: approved.projection!.approvalId, revision: approved.revision, digest: approved.digest },
    });
    expect(resumed.status).toBe('success');
    await publishExport(f.runId, f.options);
    await publishExport(f.runId, f.options);
    const metrics = await readDomainMetrics(f.url, f.runId);
    expect(metrics.quality).toBe('delivered_with_gaps');
    expect(metrics.supportedAnswerRate).toBe(2 / 3);
    expect(metrics.corrections).toEqual({ corrected: 1, reviewed: 3, rate: 1 / 3 });
    expect(metrics.exports).toBe(1);
    expect(metrics.evidenceCoverage).toEqual({ supportedClaims: 2, materialClaims: 2, rate: 1 });
    expect(metrics.firstRouting).toEqual(initial.firstRouting);
    expect(metrics.usage.physicalCalls).toBe(f.provider.calls.length);
    expect(metrics.usage.estimatedUsd).toBeGreaterThan(0);
    expect(metrics.timing.wallMs).toBeGreaterThanOrEqual(metrics.timing.activeProcessingMs!);
    expect(metrics.timing.reviewWaitMs).toBeGreaterThanOrEqual(0);
    expect(metrics.failures.calls).toBe(1);
    expect(metrics.gapsByDomain[telemetryId('access')!]?.unknown).toBe(1);
    const db = await openDatabase(f.url);
    await db.execute({ sql: 'DELETE FROM vrq_events WHERE run_id = ?', args: [f.runId] });
    db.close();
    const incomplete = await readDomainMetrics(f.url, f.runId);
    expect(incomplete.timing.activeProcessingMs).toBeNull();
    expect(incomplete.timing.wallMs).toBeNull();
    expect(incomplete.timing.incompleteTiming).toBe(true);
    await restarted.mastra.shutdown();
  } finally {
    await cleanupDirectory(root);
  }
}, 60000);
it('omits_sensitive_question_document_and_credential_content_from_telemetry', async () => {
  const root = await temporaryDirectory();
  const question = 'PRIVATE_QUESTION_CANARY',
    document = 'PRIVATE_DOCUMENT_CANARY',
    completion = 'PRIVATE_COMPLETION_CANARY',
    credential = 'sk-proj-SYNTHETIC_SECRET_CANARY_0123456789';
  const sinks: unknown[] = [];
  const spies = ['log', 'warn', 'error', 'debug', 'info'].map(name =>
    vi.spyOn(console, name as 'log').mockImplementation((...args) => {
      sinks.push(args);
    }),
  );
  try {
    const f = await draftingFixture(root, {
      questions: [{ text: `Does workforce MFA apply? ${question}` }],
      text: `control Production workforce MFA is required. ${document}`,
    });
    const provider = controlledProvider(f, [{ text: `Production workforce MFA is required. ${completion}` }]);
    const workflow = createQuestionnaireWorkflow({
      databaseUrl: f.url,
      runtimeRoot: f.runtimeRoot,
      models: provider.factory,
    });
    const exporter = new TestExporter(),
      observability = createLocalObservability([exporter]);
    const mastra = new Mastra({
      storage: createNativeStorage('private-local', f.url).storage,
      logger: new SafeLogger(record => sinks.push(record)),
      observability,
      agents: { questionInterpretationAgent, evidenceAnswerAgent, supportVerifierAgent, answerConsistencyAgent },
      workflows: { workflow },
    });
    const native = observability.getDefaultInstance()!;
    const span = native.startSpan({
      type: SpanType.GENERIC,
      name: credential,
      entityId: question,
      entityName: document,
      input: { prompt: credential },
      metadata: {
        runId: credential,
        questionId: document,
        title: question,
        path: root,
        secret: credential,
        resourceId: document,
        sessionId: question,
        threadId: completion,
        userId: credential,
        organizationId: credential,
        rootEntityName: document,
        entityVersionId: credential,
      },
    });
    span
      .createChildSpan({
        type: SpanType.GENERIC,
        name: document,
        input: completion,
        metadata: { rootEntityName: document },
      })
      .error({ error: new Error(credential) });
    span
      .createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: credential,
        attributes: {
          model: 'gpt-6.1-sol',
          provider: 'openai',
          usage: { inputTokens: 120, outputTokens: 30 },
          tools: [{ type: 'function', name: document, description: credential, parameters: {} }],
        },
      })
      .end();
    span.end({ output: completion });
    const result = await (
      await workflow.createRun()
    ).start({
      inputData: {
        runId: f.runId,
        evidenceRoot: resolve(root, 'evidence'),
        manifestPath: f.manifestPath,
        policy: { ...defaultExecutionPolicy, maxPhysicalCalls: 1000, budgetUsd: 100 },
      },
    });
    expect(result.status).toBe('suspended');
    await observability.flush();
    expect(exporter.getAllSpans().length).toBeGreaterThan(2);
    expect(
      exporter
        .getAllSpans()
        .some(s => (s.attributes as { usage?: { inputTokens?: number } })?.usage?.inputTokens === 120),
    ).toBe(true);
    const nativePayload = JSON.stringify(exporter.getAllSpans());
    for (const marker of [question, document, completion, credential, root]) {
      expect(nativePayload).not.toContain(marker);
      expect(JSON.stringify(sinks)).not.toContain(marker);
    }
    expect(exporter.getAllSpans().some(s => s.metadata?.runId === telemetryId(credential))).toBe(true);
    expect(
      exporter.getAllSpans().every(s => s.input === undefined && s.output === undefined && s.errorInfo === undefined),
    ).toBe(true);
    const traceIds = exporter.getTraceIds();
    await mastra.shutdown();
    const reopened = new DuckDBStore({ id: 'privacy-restart', path: telemetryPath(f.url) });
    await reopened.init();
    const traces = await reopened.getStore('observability');
    expect(traces).toBeDefined();
    const stored = await Promise.all(traceIds.map(traceId => traces!.getTrace({ traceId })));
    expect(stored.some(Boolean)).toBe(true);
    for (const marker of [question, document, completion, credential, root])
      expect(JSON.stringify(stored)).not.toContain(marker);
    const processing = await openProcessingStore(f.url);
    expect((await processing.status(f.runId))?.results[0]?.draft?.text).toContain(completion);
    processing.close();
    await reopened.close();
  } finally {
    spies.forEach(s => s.mockRestore());
    await cleanupDirectory(root);
  }
}, 60000);
it('review_resume_exports_one_document_with_bound_projection', async () => {
  const root = await temporaryDirectory();
  try {
    const f = await reviewFixture(
      root,
      { questions: [{ text: 'Does MFA apply?' }, { text: 'Missing operational evidence?' }] },
      [{ delayMs: 30 }, { value: 'unknown' }],
    );
    expect(f.result.status).toBe('suspended');
    expect(f.state.questions).toHaveLength(2);
    expect(f.status.results[1]?.status).toBe('review_required');
    await f.mastra.shutdown();
    const fresh = attachParent(f, f.provider.factory);
    const restored = await recoverQuestionnaire(fresh.workflow, f.state.workflowRunId);
    expect(restored.reader.getStatus()).toBe('suspended');
    const approved = (await submitReview(decision(f), f.options))!;
    expect(
      (
        await restored.run.resume({
          step: 'review-answer-set',
          resumeData: {
            approvalId: approved.projection!.approvalId,
            revision: approved.revision,
            digest: approved.digest,
          },
        })
      ).status,
    ).toBe('success');
    const bundle = await publishExport(f.runId, f.options);
    expect(bundle.manifest.files).toHaveLength(1);
    for (const file of bundle.manifest.files) expect((await readFile(bundle.path)).byteLength).toBe(file.bytes);
    expect(bundle.manifest.projectionDigest).toBe(sha256(canonicalJson(approved.projection)));
    expect(bundle.manifest.quality).toBe('delivered_with_gaps');
    await fresh.mastra.shutdown();
  } finally {
    await cleanupDirectory(root);
  }
}, 60000);

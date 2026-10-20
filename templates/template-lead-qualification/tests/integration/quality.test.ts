import { passageExtractionInstruction } from '../../src/mastra/research/source-passages';
import { mkdtemp, readFile, rm, stat, writeFile, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ModelCollectionGuard,
  modelApprovalSchema,
  modelCollectionCaps,
  prepareModelApproval,
  verifyModelBindings,
  runModelCollection,
} from '../../scripts/model-collection';
import type { ModelApproval } from '../../scripts/model-collection';
import { modelEvaluationConfig } from '../support/model-evaluation';
import { OpenAIEvidenceProvider } from '../../src/mastra/providers/evidence';
import type { ResearchContext } from '../../src/mastra/providers/evidence';
import assert from 'node:assert/strict';
import { SpanType } from '@mastra/core/observability';
import type { PruneResult } from '@mastra/core/storage';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DuckDBStore } from '@mastra/duckdb';
import { evaluationInputSchema, evaluateQualification, textDigest } from '../../src/mastra/evaluation';
import { qualificationReport } from '../../src/mastra/reporting';
import { LeadMaintenance } from '../../src/mastra/maintenance';
import { qualificationConfig } from '../../src/mastra/config/qualification';
import { ResearchError } from '../../src/mastra/research/contracts';
import { safeSpan } from '../../src/mastra/telemetry';
import { AttioStore } from '../../src/mastra/providers/attio/store';
import { qualityFixtures, qualityHarness } from '../support/quality';
import { event, harness } from '../support/application';
import { controlledResearch, recordProvider, proposal } from '../support/research';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const close of cleanup.splice(0).reverse()) await close();
});
const window = { from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z' };

describe('qualification quality and operations', () => {
  it('reports_all_qualification_eval_dimensions', async () => {
    const { profiles, labelText } = await qualityFixtures();
    const app = await qualityHarness();
    cleanup.push(() => app.close());
    const observations = [];
    for (const profile of profiles.cases)
      observations.push({
        id: profile.id,
        assessment: (await app.assess(profile, profiles.assessmentTime)).assessment,
      });
    const input = evaluationInputSchema.parse({
      datasetDigest: textDigest(labelText),
      profilesDigest: '82cece538638f9efcd95a6efe9dc218febb0d0015e5276711ea1ec7fe2e78ea2',
      mode: 'controlled_functional',
      observations,
      semanticReviews: [],
    });
    const report = evaluateQualification(labelText, input);
    expect(report.sampleCount).toBe(24);
    expect(Object.keys(report.dimensions)).toEqual([
      'identity',
      'attributeExtraction',
      'classification',
      'disqualifiers',
      'scoreConsistency',
      'evidenceReferences',
      'unsupportedClaims',
    ]);
    for (const name of [
      'identity',
      'attributeExtraction',
      'classification',
      'disqualifiers',
      'scoreConsistency',
      'evidenceReferences',
    ])
      expect(report.dimensions[name]!.failures).toEqual([]);
    expect(report.dimensions.attributeExtraction!.denominator).toBe(96);
    expect(report.dimensions.unsupportedClaims!.failures).toHaveLength(24);
    expect(report.dimensions.disqualifiers!.denominator).toBe(4);
    expect(report.unsupportedAccepted).toEqual([]);
    expect(report.targetsMet).toBe(false);
    expect(report.qualityClaim).toBe('controlled_functionality_only');
    const corrupted = structuredClone(input);
    corrupted.observations[0]!.assessment.result.score = 0;
    expect(evaluateQualification(labelText, corrupted).dimensions.scoreConsistency!.failures[0]!.id).toBe('qualified');
    expect(() => evaluateQualification(labelText, { ...input, datasetDigest: '0'.repeat(64) })).toThrow('digest');
    expect(evaluateQualification(labelText, { ...input, observations: [] }).dimensions.identity!.failures).toHaveLength(
      24,
    );
  });

  it('reports_deduplicated_metrics_and_observed_conversion', async () => {
    const { profiles } = await qualityFixtures();
    const app = await qualityHarness();
    cleanup.push(() => app.close());
    const qualified = await app.assess(profiles.cases[0]!);
    const nurture = await app.assess(profiles.cases.find(item => item.id === 'nurture')!);
    const uncertain = await app.assess(profiles.cases.find(item => item.id === 'missing-workforce')!);
    for (const item of [qualified, nurture, uncertain]) {
      await app.reviews.advance(item.run.runId);
      await app.store.complete(item.run.runId);
    }
    const cycle = (await app.reviews.read(uncertain.run.runId))!;
    await app.reviews.decide({
      runId: cycle.runId,
      reviewId: cycle.packet!.id,
      revision: 1,
      digest: cycle.packet!.digest,
      decision: 'approved',
      override: { classification: 'qualified', reason: 'SDR confirmed workforce through an independent conversation.' },
    });
    await app.reviews.advance(cycle.runId);
    const inbox = new AttioStore(app.store.client);
    await inbox.init();
    async function outcome(id: string, assessmentId: string, cycleId: string, value: string, at: string) {
      await app.store.client.execute({
        sql: 'INSERT OR IGNORE INTO lead_sales_outcomes VALUES(?,?,?,?,?)',
        args: [id, assessmentId, cycleId, value, at],
      });
    }
    await outcome('old', qualified.assessment.id, qualified.run.runId, 'lost', '2026-10-20T00:00:00Z');
    await outcome('new', qualified.assessment.id, qualified.run.runId, 'won', '2026-10-21T00:00:00Z');
    await outcome('duplicate-semantic', qualified.assessment.id, qualified.run.runId, 'won', '2026-10-21T00:00:00Z');
    await outcome('nurture', nurture.assessment.id, nurture.run.runId, 'lost', '2026-10-21T00:00:00Z');
    await outcome('unrelated', randomUUID(), randomUUID(), 'won', '2026-10-21T00:00:00Z');
    const report = await qualificationReport(app.store.client, window, true);
    expect(report.assessments).toHaveLength(3);
    expect(report.qualification).toMatchObject({ numerator: 1, denominator: 3 });
    expect(report.manualReview).toMatchObject({ numerator: 1, denominator: 3 });
    expect(report.authorization).toEqual({ automatic: 2, human: 1 });
    expect(report.overrides).toHaveLength(1);
    expect(report.overrides[0]!.reason).toContain('independent conversation');
    expect(report.conversion.bands.reduce((sum, band) => sum + band.won + band.lost, 0)).toBe(2);
    expect(report.conversion.bands.find(band => band.band === '80–100')).toMatchObject({ won: 1, lost: 0, rate: 1 });
    expect((await qualificationReport(app.store.client, window, false)).conversion.availability).toBe(
      'source_unmapped',
    );
    expect(
      (await qualificationReport(app.store.client, { from: '2026-10-25T00:00:00Z', to: window.to }, true)).conversion
        .availability,
    ).toBe('no_closed_outcomes');
    expect((await app.http.request('/lead-qualification/report?from=bad&to=bad')).status).toBe(400);
    expect(report.coverage.completeHistoricalCohort).toBe(false);
  });

  it('redacts_diagnostics_and_prunes_only_eligible_records', async () => {
    const { profiles } = await qualityFixtures();
    const app = await qualityHarness();
    cleanup.push(() => app.close());
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));
    const closed = await app.assess(
      { ...profiles.cases[0]!, intentAt: '2026-07-31T12:00:00Z' },
      '2026-08-01T12:00:00Z',
    );
    await app.reviews.advance(closed.run.runId);
    await app.store.complete(closed.run.runId);
    const pending = await app.assess(
      profiles.cases.find(item => item.id === 'missing-workforce')!,
      '2026-08-01T12:00:00Z',
    );
    await app.reviews.advance(pending.run.runId);
    await app.store.complete(pending.run.runId);
    const uncertain = await app.assess(
      { ...profiles.cases[0]!, id: 'uncertain-write', intentAt: '2026-07-31T12:00:00Z' },
      '2026-08-01T12:00:00Z',
    );
    await app.reviews.advance(uncertain.run.runId);
    await app.store.complete(uncertain.run.runId);
    await app.store.client.execute({
      sql: "UPDATE lead_output_operations SET state='uncertain' WHERE run_id=?",
      args: [uncertain.run.runId],
    });
    const workflows = (await app.storage.getStore('workflows'))!;
    await workflows.persistWorkflowSnapshot({
      runId: closed.run.runId,
      workflowName: 'lead-intake',
      snapshot: {
        status: 'success',
        context: { privateContact: 'contact@example.com' },
        activePaths: [],
        runId: closed.run.runId,
      } as never,
    });
    expect(
      await workflows.loadWorkflowSnapshot({ runId: closed.run.runId, workflowName: 'lead-intake' }),
    ).not.toBeNull();
    vi.setSystemTime(new Date('2026-10-19T12:00:00Z'));

    await new AttioStore(app.store.client).init();
    for (const [id, cycleId, receivedAt] of [
      ['expired-sale', closed.run.runId, '2026-08-01T12:00:00Z'],
      ['orphan-sale', randomUUID(), '2026-08-01T12:00:00Z'],
      ['late-sale', closed.run.runId, '2026-10-19T12:00:00Z'],
      ['active-sale', pending.run.runId, '2026-08-01T12:00:00Z'],
      ['uncertain-sale', uncertain.run.runId, '2026-08-01T12:00:00Z'],
    ])
      await app.store.client.batch(
        [
          {
            sql: 'INSERT INTO lead_sales_outcomes VALUES(?,?,?,?,?)',
            args: [id, randomUUID(), cycleId, 'won', '2026-08-01T12:00:00Z'],
          },
          { sql: 'INSERT INTO lead_sales_receipts VALUES(?,?)', args: [id, receivedAt] },
        ],
        'write',
      );
    const maintenance = new LeadMaintenance(app.storage, app.outputs, qualificationConfig.retention);
    let preview = await maintenance.preview({ now: '2026-10-19T12:00:00Z' });
    expect(preview.operational).toEqual([closed.run.runId]);
    expect(preview.salesOutcomes).toEqual(['expired-sale', 'orphan-sale']);
    expect(preview.protectedRuns).toBeGreaterThan(0);
    expect(JSON.stringify(preview)).not.toContain('example.com');
    const before = await app.store.qualifications.get(closed.run.runId);
    expect(before?.assessment).toBeTruthy();
    await expect(maintenance.apply({ ...preview, digest: '0'.repeat(64) })).rejects.toThrow('changed');
    await app.store.client.execute({ sql: 'UPDATE lead_cycles SET active=1 WHERE run_id=?', args: [closed.run.runId] });
    await expect(maintenance.apply(preview)).rejects.toThrow('scope_changed');
    await app.store.client.execute({ sql: 'UPDATE lead_cycles SET active=0 WHERE run_id=?', args: [closed.run.runId] });
    preview = await maintenance.preview(preview.request);
    const result = await maintenance.apply(preview);
    expect(result.operational).toEqual([closed.run.runId]);
    expect(result.salesOutcomes).toBe(2);
    expect(
      (await app.store.client.execute('SELECT event_id FROM lead_sales_outcomes ORDER BY event_id')).rows.map(
        row => row.event_id,
      ),
    ).toEqual(['active-sale', 'late-sale', 'uncertain-sale']);
    expect(
      (await app.store.client.execute('SELECT event_id FROM lead_sales_receipts ORDER BY event_id')).rows.map(
        row => row.event_id,
      ),
    ).toEqual(['active-sale', 'late-sale', 'uncertain-sale']);
    expect(await app.store.qualifications.get(closed.run.runId)).toBeNull();
    expect(await workflows.loadWorkflowSnapshot({ runId: closed.run.runId, workflowName: 'lead-intake' })).toBeNull();
    expect(
      (
        await app.store.client.execute({
          sql: 'SELECT count(*) AS count FROM lead_output_operations WHERE run_id=?',
          args: [closed.run.runId],
        })
      ).rows[0]!.count,
    ).toBe(0);
    expect(
      (
        await app.store.client.execute({
          sql: 'SELECT count(*) AS count FROM lead_local_destinations WHERE reference=?',
          args: [closed.event.destination.reference],
        })
      ).rows[0]!.count,
    ).toBe(0);
    expect(await app.store.qualifications.get(uncertain.run.runId)).not.toBeNull();
    expect((await app.store.reviews.get(pending.run.runId))?.packet).toEqual(
      (await app.reviews.read(pending.run.runId))?.packet,
    );
    expect(await app.store.qualifications.get(pending.run.runId)).not.toBeNull();
    const expired = await app.http.request(`/lead-qualification/runs/${closed.run.runId}`);
    expect(expired.status).toBe(200);
    const replay = await app.store.accept(closed.event, 1000);
    expect(replay.runId).toBe(closed.run.runId);
    await expect(
      app.store.accept(
        { ...closed.event, lead: { ...closed.event.lead, declaredCompanyName: 'Changed payload' } },
        1000,
      ),
    ).rejects.toThrow('different payload');
    const fresh = await app.assess(
      { ...profiles.cases[0]!, id: 'fresh-cycle' },
      '2026-10-19T12:00:00Z',
      closed.event.destination.reference,
      closed.assessment.id,
    );
    expect((await app.store.reviews.get(fresh.run.runId))!.predecessorId).toBe(closed.assessment.id);
    expect(
      (
        await app.store.client.execute({
          sql: 'SELECT count(*) AS count FROM lead_local_destinations WHERE reference=?',
          args: [closed.event.destination.reference],
        })
      ).rows[0]!.count,
    ).toBe(1);
    const span = safeSpan({
      metadata: { runId: randomUUID(), secret: 'private-token' },
      input: 'contact@example.com',
      output: 'private prompt',
      errorInfo: { message: 'Bearer secret' },
      type: 'workflow_run',
      name: 'private-name',
    } as never);
    expect(JSON.stringify(span)).not.toMatch(/private|secret|contact@example/);
  });

  it('persists_separate_observability_without_affecting_business_recovery', async () => {
    const { profiles } = await qualityFixtures();
    const app = await qualityHarness();
    cleanup.push(() => app.close());
    const item = await app.assess(profiles.cases[0]!);
    await app.reviews.advance(item.run.runId);
    await app.store.complete(item.run.runId);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));
    const usageId = randomUUID();
    await app.telemetry.research({
      usageId,
      runId: item.run.runId,
      stage: 'extract',
      durationMs: 25,
      inputTokens: 100,
      outputTokens: 20,
      reasoningTokens: null,
      model: 'openai/gpt-6-luna',
    });
    await app.telemetry.observability.flush();
    const logs = JSON.stringify(await app.duckdb.observability.listLogs({}));
    expect(logs).toContain('research.measurement');
    expect(logs).toContain('unavailable');
    const metrics = JSON.stringify(await app.duckdb.observability.listMetrics({}));
    expect(metrics).toContain('lead_research_duration_ms');
    const tables = await app.store.client.execute("SELECT name FROM sqlite_master WHERE name='mastra_metrics'");
    if (tables.rows.length)
      assert.equal((await app.store.client.execute('SELECT count(*) AS count FROM mastra_metrics')).rows[0]!.count, 0);
    const span = app.telemetry.observability
      .getDefaultInstance()!
      .startSpan({ type: SpanType.GENERIC, name: 'safe fixture', metadata: { runId: item.run.runId } });
    span.end();
    await app.telemetry.observability.flush();
    expect(
      JSON.stringify(await app.duckdb.observability.listTraces({ pagination: { page: 0, perPage: 100 } })),
    ).toContain(item.run.runId);
    const before = JSON.stringify(await app.store.qualifications.get(item.run.runId));
    const researchCalls = vi.spyOn(app.evidenceProvider, 'search');
    const outputCalls = vi.spyOn(app.outputs.get('local')!, 'apply');

    const failure = vi.spyOn(app.telemetry.exporter, 'onMetricEvent').mockRejectedValue(new Error('private failure'));
    await app.telemetry.research({
      usageId: randomUUID(),
      runId: item.run.runId,
      stage: 'extract',
      durationMs: 25,
      inputTokens: null,
      outputTokens: null,
      reasoningTokens: null,
      model: 'openai/gpt-6-luna',
    });
    expect(app.telemetry.isDegraded()).toBe(true);
    expect(JSON.stringify(await app.store.qualifications.get(item.run.runId))).toBe(before);
    failure.mockRestore();
    await app.qualification.qualify(item.run.runId, item.event);
    await app.reviews.advance(item.run.runId);
    expect(researchCalls).toHaveBeenCalledTimes(0);
    expect(outputCalls).toHaveBeenCalledTimes(0);
    vi.useRealTimers();
    const pending = await app.assess(profiles.cases.find(profile => profile.id === 'missing-workforce')!);
    await app.reviews.advance(pending.run.runId);
    await app.store.complete(pending.run.runId);
    await app.close(false);
    const reopened = new DuckDBStore({ path: `${app.directory}/observability.duckdb` });
    try {
      await reopened.init();
      expect(JSON.stringify(await reopened.observability.listMetrics({}))).toContain('lead_research_duration_ms');
    } finally {
      await reopened.close();
    }
    const recovered = await harness({ directory: app.directory });
    cleanup.push(() => recovered.close());
    const maintenance = new LeadMaintenance(recovered.storage, recovered.outputs, qualificationConfig.retention);
    const preview = await maintenance.preview({ now: new Date().toISOString() });
    for (const key of ['spans', 'logs', 'metrics'])
      expect(preview.observability.find(table => table.key === key)!.count).toBeGreaterThan(0);
    const pruned = await maintenance.apply(preview);
    expect(pruned.failures).toEqual([]);
    const nativeResults = pruned.observability as PruneResult[];
    for (const table of ['span_events', 'log_events', 'metric_events'])
      expect(nativeResults.find(item => item.table === table)!.deleted).toBeGreaterThan(0);
    expect(JSON.stringify(await recovered.duckdb.observability.listLogs({}))).not.toContain('research.measurement');
    expect(
      JSON.stringify(await recovered.duckdb.observability.listTraces({ pagination: { page: 0, perPage: 100 } })),
    ).not.toContain(span.traceId);
    expect(JSON.stringify(await recovered.duckdb.observability.listMetrics({}))).not.toContain(
      'lead_research_duration_ms',
    );
    const packet = (await recovered.reviews.read(pending.run.runId))!.packet!;
    await recovered.reviews.decide({
      runId: pending.run.runId,
      reviewId: packet.id,
      revision: 1,
      digest: packet.digest,
      decision: 'approved',
      override: {
        classification: 'nurture',
        reason: 'Operator recovery proof with incomplete public workforce evidence.',
      },
    });
    await recovered.reviews.advance(pending.run.runId);
    expect((await recovered.reviews.read(pending.run.runId))!.state).toBe('applied');
  });

  it('extends_evidence_sources_with_provenance_and_shared_limits', async () => {
    const provider = recordProvider(
      'extra-source',
      () => [{ id: 'custom-page', source: 'https://approved.example.org/about', excerpt: 'Headquarters: Brazil.' }],
      () => [proposal('headquartersCountry', 'BR', 'Headquarters: Brazil.', 'custom-page')],
    );
    const conflicting = recordProvider(
      'conflicting-source',
      () => [
        {
          id: 'conflict-page',
          source: 'https://approved.example.org/company',
          excerpt: 'Headquarters: United States.',
        },
      ],
      () => [proposal('headquartersCountry', 'US', 'Headquarters: United States.', 'conflict-page')],
    );
    const blocked = recordProvider('blocked-source', () => [
      { id: 'bad-page', source: 'https://off-policy.example.net/about', excerpt: 'Headquarters: Brazil.' },
    ]);
    const timed = {
      ...recordProvider('timeout-source', () => []),
      search: vi.fn<() => Promise<never>>(async () => {
        throw new ResearchError('provider_timeout');
      }),
    };
    const bounded = [provider, conflicting, blocked].map(adapter => ({
      ...adapter,
      async search(branch: Parameters<typeof adapter.search>[0], context: Parameters<typeof adapter.search>[1]) {
        const reservation = await context.store.reserve(context.runId, 'search', 128);
        const result = await adapter.search(branch, context);
        await context.store.settle(reservation, { outputTokens: 0 });
        return result;
      },
    }));
    const app = await harness({
      qualification: {
        ...qualificationConfig,
        research: { ...qualificationConfig.research, maxSearchCalls: 3 },
        sources: {
          ...qualificationConfig.sources,
          providerIds: ['timeout-source', 'extra-source', 'conflicting-source', 'blocked-source'],
          additionalDomains: ['approved.example.org'],
        },
      },
      evidence: [...bounded, timed],
    });
    cleanup.push(() => app.close());
    const response = await app.post({
      version: 1,
      type: 'lead.received',
      eventId: 'extension',
      lead: { reference: 'extension', domain: 'example.com' },
    });
    const { runId } = await response.json();
    const run = (await app.store.get(runId))!;
    const assessment = (await app.qualification.qualify(runId, run.event))!;
    expect(assessment.facts.headquartersCountry).toMatchObject({ disposition: 'conflicting', value: null });
    expect(
      assessment.evidence.some(
        source => source.providerId === 'extra-source' && source.source === 'https://approved.example.org/about',
      ),
    ).toBe(true);
    expect(assessment.evidence.some(source => source.providerId === 'conflicting-source')).toBe(true);
    expect(assessment.failures.some(failure => failure.code === 'unapproved_source')).toBe(true);
    expect(assessment.failures.some(failure => failure.code === 'provider_timeout')).toBe(true);
    expect(assessment.failures.some(failure => failure.code === 'request_budget_exhausted')).toBe(true);
    expect(assessment.result.classification).toBe('needs_review');
    expect((await app.store.qualifications.get(runId))!.budget.searchCalls).toBe(3);
    expect(timed.search).toHaveBeenCalledTimes(1);
    const saved = JSON.stringify(assessment);
    expect(JSON.stringify(await app.qualification.qualify(runId, run.event))).toBe(saved);
    expect(provider.search).toHaveBeenCalledTimes(1);
    expect(conflicting.search).toHaveBeenCalledTimes(1);
    expect((await app.store.qualifications.get(runId))!.budget.searchCalls).toBe(3);
  });
});

// These transport tests use synthetic requests, never measure the model gold dataset.
describe('once-only model collection controls', () => {
  async function approvalFixture(overrides: Partial<ModelApproval['caps']> = {}) {
    const directory = await mkdtemp(join(tmpdir(), 'model-guard-'));
    cleanup.push(() => rm(directory, { recursive: true, force: true }));
    const caps = { ...modelCollectionCaps, ...overrides };
    return modelApprovalSchema.parse({
      version: 2,
      purpose: 'qualification_model_collection',
      executionId: randomUUID(),
      approved: true,
      approvedBy: 'controlled-test-operator',
      approvedAt: '2026-10-19T12:00:00Z',
      approvalPath: join(directory, 'approval.json'),
      journalPath: join(directory, 'journal.jsonl'),
      projectRoot: join(directory, 'project'),
      outputDirectory: join(directory, 'output'),
      profilesPath: join(directory, 'profiles.json'),
      labelsPath: join(directory, 'labels.json'),
      profilesDigest: 'a'.repeat(64),
      labelsDigest: 'b'.repeat(64),
      sourceRevision: 'c'.repeat(40),
      sourceDigest: 'd'.repeat(64),
      configurationDigest: 'e'.repeat(64),
      promptsDigest: 'f'.repeat(64),
      model: 'openai/gpt-6-luna',
      caseIds: Array.from({ length: 24 }, (_, index) => `case-${index}`),
      caps,
      maximumReservationNanoUsd:
        caps.maxRequests * (caps.maxRequestBytes + caps.inputFramingTokens) * caps.inputNanoUsdPerToken +
        caps.maxOutputTokensTotal * caps.outputNanoUsdPerToken,
      pricing: {
        currency: 'USD',
        modelSource: 'https://developers.openai.com/api/docs/models/gpt-6-luna',
        pricingSource: 'https://developers.openai.com/api/docs/pricing',
        retrievedAt: '2026-10-19',
        assumption:
          'Full UTF8 body bytes as input tokens plus4096 framing; maximum cache-write, Fast2x and regional1.1 rates; not an account or invoice guarantee',
      },
    });
  }
  function payload(stage: 'extract' | 'verify' = 'extract') {
    return {
      model: 'gpt-6-luna',
      max_output_tokens: 128,
      stream: true,
      store: false,
      reasoning: { effort: 'low' },
      include: ['reasoning.encrypted_content'],
      input: [
        {
          role: 'system',
          content:
            stage === 'extract'
              ? passageExtractionInstruction(modelEvaluationConfig.prompts.extraction)
              : modelEvaluationConfig.prompts.verification,
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({ companyDomain: 'example.com', excerpt: '40 employees. São Paulo.' }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'response',
          strict: true,
          schema: { type: 'object', properties: {}, additionalProperties: false, required: [] },
        },
      },
    };
  }
  function measurement(
    runId: string,
    stage: 'extract' | 'verify' = 'extract',
  ): Parameters<ModelCollectionGuard['measurement']>[0] {
    return {
      usageId: randomUUID(),
      runId,
      stage,
      inputTokens: 100,
      outputTokens: 20,
      reasoningTokens: null,
      durationMs: 1,
      model: 'openai/gpt-6-luna',
    };
  }
  async function bind(guard: ModelCollectionGuard) {
    const runId = randomUUID();
    await guard.beginCase('case-0', 'domain');
    await guard.admitted(runId);
    return runId;
  }
  async function invoke(
    guard: ModelCollectionGuard,
    runId: string,
    options: {
      payload?: unknown;
      measured?: Partial<ReturnType<typeof measurement>> | false;
      swallow?: boolean;
      stage?: 'extract' | 'verify';
    } = {},
  ) {
    const stage = options.stage ?? 'extract';
    return guard.stage(stage, { runId } as ResearchContext, async () => {
      const response = await guard.fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        body: JSON.stringify(options.payload ?? payload(stage)),
      });
      if (options.measured !== false) {
        const work = guard.measurement({ ...measurement(runId, stage), ...options.measured });
        if (options.swallow) await work.catch(() => {});
        else await work;
      }
      return response;
    });
  }
  it('refuses_unapproved_stale_and_exclusively_consumed_collection_before_transport', async () => {
    const approval = await approvalFixture();
    const transport = vi.fn<typeof fetch>(async () => new Response('{}'));
    await expect(ModelCollectionGuard.consume({ ...approval, approved: false }, transport)).rejects.toThrow(
      'not_approved',
    );
    await expect(
      ModelCollectionGuard.consume({ ...approval, version: 1 } as unknown as ModelApproval, transport),
    ).rejects.toThrow(/Invalid input/);
    expect(transport).toHaveBeenCalledTimes(0);
    await expect(stat(approval.journalPath)).rejects.toMatchObject({ code: 'ENOENT' });
    const results = await Promise.allSettled([
      ModelCollectionGuard.consume(approval, transport),
      ModelCollectionGuard.consume(approval, transport),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const guards = results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []));
    const failures = results.flatMap(result => (result.status === 'rejected' ? [result.reason] : []));
    await guards[0]!.close(false);
    expect(failures).toMatchObject([{ code: 'EEXIST' }]);
    await expect(
      ModelCollectionGuard.consume(
        { ...approval, outputDirectory: approval.outputDirectory + '-different' },
        transport,
      ),
    ).rejects.toMatchObject({ code: 'EEXIST' });
    expect(transport).toHaveBeenCalledTimes(0);
  });
  it('validates_integer_safe_currency_and_cross_field_reservation_limits', async () => {
    const approval = await approvalFixture();
    expect(approval.maximumReservationNanoUsd).toBe(4724544000);
    expect(approval.maximumReservationNanoUsd).toBeLessThan(approval.caps.costNanoUsd);
    for (const caps of [
      { costNanoUsd: Number.MAX_SAFE_INTEGER + 1 },
      { costNanoUsd: 1.5 },
      { costNanoUsd: 0 },
      { inputNanoUsdPerToken: 274 },
      { outputNanoUsdPerToken: 1099 },
      { inputFramingTokens: 0 },
      { maxRequestsPerCase: 1 },
      { maxOutputTokensTotal: 128 },
    ])
      expect(modelApprovalSchema.safeParse({ ...approval, caps: { ...approval.caps, ...caps } }).success).toBe(false);
    expect(modelApprovalSchema.safeParse({ ...approval, maximumReservationNanoUsd: 1 }).success).toBe(false);
  });
  it('enforces_actual_request_cap_before_a_second_dispatch', async () => {
    const approval = await approvalFixture({
      maxRequests: 1,
      maxRequestsPerCase: 1,
      maxOutputTokensPerCase: 2000,
      maxOutputTokensTotal: 2000,
    });
    const transport = vi.fn<typeof fetch>(async () => new Response('{}'));
    const guard = await ModelCollectionGuard.consume(approval, transport);
    try {
      const runId = await bind(guard);
      await invoke(guard, runId);
      await expect(invoke(guard, runId)).rejects.toThrow('limit_exhausted');
      expect(transport).toHaveBeenCalledTimes(1);
      expect(transport.mock.calls[0]![0]).toBe('https://api.openai.com/v1/responses');
      expect(transport.mock.calls[0]![1]).toMatchObject({ redirect: 'error' });
      expect(guard.provenance()).toMatchObject({
        requestsReserved: 1,
        confirmedTransportAttempts: 1,
        observedInputTokens: 100,
        observedOutputTokens: 20,
        outputTokensReserved: 128,
      });
    } finally {
      await guard.close(false);
    }
  });
  it('fsyncs_full_utf8_input_output_and_currency_reservations_before_transport_without_refunds', async () => {
    const body = JSON.stringify(payload());
    const cost = (Buffer.byteLength(body) + 4096) * 275 + 128 * 1100;
    const approval = await approvalFixture({ costNanoUsd: cost });
    const transport = vi.fn<typeof fetch>(async () => {
      const records = (await readFile(approval.journalPath, 'utf8'))
        .trim()
        .split('\n')
        .map(line => JSON.parse(line));
      expect(records.at(-1)).toMatchObject({
        type: 'request.reserved',
        data: {
          inputBound: Buffer.byteLength(body) + 4096,
          outputReserved: 128,
          costReservedNanoUsd: cost,
          costReservedNanoUsdTotal: cost,
        },
      });
      return new Response('{}');
    });
    const guard = await ModelCollectionGuard.consume(approval, transport);
    try {
      const runId = await bind(guard);
      await invoke(guard, runId);
      await expect(invoke(guard, runId)).rejects.toThrow('cost_exhausted');
      expect(transport).toHaveBeenCalledTimes(1);
      expect(guard.provenance()).toMatchObject({
        requestsReserved: 1,
        costReservedNanoUsd: cost,
        bytesReserved: Buffer.byteLength(body),
        observedOutputTokens: 20,
      });
    } finally {
      await guard.close(false);
    }
    const denied = await approvalFixture({ costNanoUsd: cost - 1 });
    const next = await ModelCollectionGuard.consume(denied, transport);
    try {
      await expect(invoke(next, await bind(next))).rejects.toThrow('cost_exhausted');
      expect(next.provenance().requestsReserved).toBe(0);
      expect(transport).toHaveBeenCalledTimes(1);
    } finally {
      await next.close(false);
    }
  });
  it('stops_after_missing_unknown_excess_or_mismatched_usage_even_when_provider_swallows_measurement_failure', async () => {
    for (const measured of [
      false,
      { inputTokens: null },
      { outputTokens: null },
      { inputTokens: 200000 },
      { outputTokens: 129 },
      { reasoningTokens: 21 },
      { model: 'openai/another-model' },
      { runId: randomUUID() },
    ] as const) {
      const approval = await approvalFixture();
      const transport = vi.fn<typeof fetch>(async () => new Response('{}'));
      const guard = await ModelCollectionGuard.consume(approval, transport);
      try {
        const runId = await bind(guard);
        await expect(invoke(guard, runId, { measured, swallow: true })).rejects.toThrow(
          /usage_unknown|usage_exceeds_reservation|measurement_invalid/,
        );
        await expect(invoke(guard, runId)).rejects.toThrow(
          /usage_unknown|usage_exceeds_reservation|measurement_invalid/,
        );
        expect(transport).toHaveBeenCalledTimes(1);
        expect(guard.provenance()).toMatchObject({
          requestsReserved: 1,
          confirmedTransportAttempts: 1,
          outputTokensReserved: 128,
        });
      } finally {
        await guard.close(false);
      }
    }
  });
  it('retains_consumed_reservations_and_stops_after_transport_or_http_failure', async () => {
    for (const fail of [true, false]) {
      const approval = await approvalFixture();
      const transport = vi.fn<typeof fetch>(async () => {
        if (fail) throw new Error('private-provider-text');
        return new Response('{}', { status: 429 });
      });
      const guard = await ModelCollectionGuard.consume(approval, transport);
      try {
        const runId = await bind(guard);
        await expect(invoke(guard, runId)).rejects.toThrow('transport_failed');
        await expect(invoke(guard, runId)).rejects.toThrow('transport_failed');
        expect(transport).toHaveBeenCalledTimes(1);
        expect(guard.provenance()).toMatchObject({
          requestsReserved: 1,
          confirmedTransportAttempts: 1,
          responseCount: fail ? 0 : 1,
          observedInputTokens: null,
          observedOutputTokens: null,
        });
        expect(guard.provenance().costReservedNanoUsd).toBeGreaterThan(0);
      } finally {
        await guard.close(false);
      }
      const journal = await readFile(approval.journalPath, 'utf8');
      expect(journal).toContain('collection.consumed');
      expect(journal).toContain('request.reserved');
      expect(journal).toContain('unknown');
      expect(journal).not.toContain('private-provider-text');
    }
  });
  it('rejects_other_billable_tools_media_context_routes_and_unbound_instructions_before_transport', async () => {
    const mutations = [
      { tools: [] },
      { tools: [{ type: 'web_search' }] },
      { model: 'other-model' },
      { service_tier: 'priority' },
      { previous_response_id: 'resp_previous' },
      { conversation: 'conv_previous' },
      { truncation: 'auto' },
      { background: true },
      { stream: false },
      { store: true },
      { reasoning: { effort: 'high' } },
      { include: ['web_search_call.action.sources'] },
      {
        input: [
          { role: 'system', content: modelEvaluationConfig.prompts.extraction },
          { role: 'user', content: [{ type: 'input_file', file_id: 'file_remote' }] },
        ],
      },
      {
        input: [
          { role: 'system', content: 'unbound instruction' },
          { role: 'user', content: '{}' },
        ],
      },
      { text: { format: { type: 'text' } } },
    ];
    for (const mutation of mutations) {
      const approval = await approvalFixture();
      const transport = vi.fn<typeof fetch>(async () => new Response('{}'));
      const guard = await ModelCollectionGuard.consume(approval, transport);
      try {
        await expect(invoke(guard, await bind(guard), { payload: { ...payload(), ...mutation } })).rejects.toThrow(
          /request_forbidden|instruction_mismatch/,
        );
        expect(transport).toHaveBeenCalledTimes(0);
        expect(guard.provenance().costReservedNanoUsd).toBe(0);
      } finally {
        await guard.close(false);
      }
    }
  });
  it('rejects_stale_or_modified_extraction_instructions_before_reservation', async () => {
    for (const instruction of [
      modelEvaluationConfig.prompts.extraction,
      passageExtractionInstruction(modelEvaluationConfig.prompts.extraction) + ' ',
    ]) {
      const approval = await approvalFixture();
      const transport = vi.fn<typeof fetch>(async () => new Response('{}'));
      const guard = await ModelCollectionGuard.consume(approval, transport);
      const request = payload();
      request.input[0]!.content = instruction;
      try {
        await expect(invoke(guard, await bind(guard), { payload: request })).rejects.toThrow(
          'model_collection_instruction_mismatch',
        );
        expect(transport).not.toHaveBeenCalled();
        expect(guard.provenance()).toMatchObject({
          requestsReserved: 0,
          costReservedNanoUsd: 0,
          failureCode: 'model_collection_instruction_mismatch',
        });
      } finally {
        await guard.close(false);
      }
    }
  });
  it('stops_before_transport_if_source_or_dataset_binding_changes_and_rejects_old_execution_manifests', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'model-binding-'));
    cleanup.push(() => rm(directory, { recursive: true, force: true }));
    const profiles = join(directory, 'profiles.json'),
      labels = join(directory, 'labels.json');
    const profileText = await readFile('tests/fixtures/qualification/model-profiles.v1.json', 'utf8');
    const labelText = await readFile('tests/fixtures/qualification/model-expected.v1.json', 'utf8');
    await writeFile(profiles, profileText);
    await writeFile(labels, labelText);
    const paths = { profiles, labels, approval: join(directory, 'approval.json'), output: join(directory, 'output') };
    const prepared = await prepareModelApproval(paths);
    await verifyModelBindings(prepared.manifest);
    await expect(verifyModelBindings({ ...prepared.manifest, sourceDigest: '0'.repeat(64) })).rejects.toThrow(
      'source_changed',
    );
    for (const [path, text] of [
      [profiles, profileText],
      [labels, labelText],
    ]) {
      await writeFile(path!, text! + ' ');
      await expect(verifyModelBindings(prepared.manifest)).rejects.toThrow('dataset_changed');
      await writeFile(path!, text!);
    }
    await writeFile(paths.approval, JSON.stringify({ ...prepared.manifest, version: 1 }));
    await expect(runModelCollection(paths)).rejects.toThrow('approval_version_unsupported');
    const transport = vi.fn<typeof fetch>(async () => new Response('{}'));
    let changed = false;
    const guard = await ModelCollectionGuard.consume(
      { ...prepared.manifest, approved: true, approvedBy: 'test', approvedAt: '2026-10-19T12:00:00Z' },
      transport,
      async () => {
        if (changed) throw new Error('model_collection_dataset_changed');
      },
    );
    try {
      const runId = randomUUID();
      await guard.beginCase(prepared.profiles.cases[0]!.id, 'domain');
      await guard.admitted(runId);
      await invoke(guard, runId);
      changed = true;
      await expect(invoke(guard, runId)).rejects.toThrow('dataset_changed');
      expect(transport).toHaveBeenCalledTimes(1);
    } finally {
      await guard.close(false);
    }
  });
  it('fails_closed_when_a_reservation_cannot_be_durably_journaled', async () => {
    const approval = await approvalFixture();
    const transport = vi.fn<typeof fetch>(async () => new Response('{}'));
    const guard = await ModelCollectionGuard.consume(approval, transport);
    const runId = await bind(guard);
    const probe = await open(approval.approvalPath, 'w');
    const failure = vi.spyOn(Object.getPrototypeOf(probe), 'sync').mockRejectedValue(new Error('private IO failure'));
    try {
      await expect(invoke(guard, runId)).rejects.toThrow('journal_unavailable');
      await expect(invoke(guard, runId)).rejects.toThrow('journal_unavailable');
      expect(transport).toHaveBeenCalledTimes(0);
      expect(guard.provenance().costReservedNanoUsd).toBeGreaterThan(0);
    } finally {
      failure.mockRestore();
      await probe.close();
      await guard.close(false);
    }
  });
  it('allows_only_one_dispatch_when_concurrent_fetches_compete_inside_a_stage', async () => {
    const approval = await approvalFixture();
    const transport = vi.fn<typeof fetch>(async () => new Response('{}'));
    const guard = await ModelCollectionGuard.consume(approval, transport);
    try {
      const runId = await bind(guard);
      await expect(
        guard.stage('extract', { runId } as ResearchContext, async () => {
          await Promise.allSettled(
            Array.from({ length: 2 }, async () => {
              await guard.fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                body: JSON.stringify(payload()),
              });
              await guard.measurement(measurement(runId));
            }),
          );
        }),
      ).rejects.toThrow('retry_forbidden');
      expect(transport.mock.calls.length).toBeLessThanOrEqual(1);
      expect(guard.provenance().requestsReserved).toBe(1);
    } finally {
      await guard.close(false);
    }
  });
  it('round_trips_actual_guard_accounting_through_the_evaluator_and_preserves_legacy_collections', async () => {
    const { profiles, labelText } = await qualityFixtures();
    const app = await qualityHarness();
    cleanup.push(() => app.close());
    const observations = [];
    for (const profile of profiles.cases)
      observations.push({
        id: profile.id,
        assessment: (await app.assess(profile, profiles.assessmentTime)).assessment,
      });
    const approval = await approvalFixture();
    const transport = vi.fn<typeof fetch>(async () => new Response('{}'));
    const guard = await ModelCollectionGuard.consume(approval, transport);
    try {
      await invoke(guard, await bind(guard));
      const collection = guard.provenance();
      const input = {
        datasetDigest: textDigest(labelText),
        profilesDigest: '82cece538638f9efcd95a6efe9dc218febb0d0015e5276711ea1ec7fe2e78ea2',
        mode: 'controlled_functional' as const,
        collection,
        observations,
        semanticReviews: [],
      };
      const report = evaluateQualification(labelText, JSON.parse(JSON.stringify(input)));
      expect(report.sampleCount).toBe(24);
      expect(report.collection).toEqual(collection);
      expect(report.targetsMet).toBe(false);
      expect(transport).toHaveBeenCalledTimes(1);
      const legacy = { ...collection };
      for (const key of ['bytesReserved', 'costReservedNanoUsd', 'costCeilingNanoUsd', 'failureCode'] as const)
        delete (legacy as Partial<typeof collection>)[key];
      expect(evaluateQualification(labelText, { ...input, collection: legacy }).sampleCount).toBe(24);
      for (const change of [
        { costReservedNanoUsd: collection.costCeilingNanoUsd + 1 },
        { costReservedNanoUsd: 1.5 },
        { costCeilingNanoUsd: 5000000001 },
        { bytesReserved: 131073 },
        { failureCode: 'private unbounded error' },
        { costCeilingNanoUsd: undefined },
      ])
        expect(evaluationInputSchema.safeParse({ ...input, collection: { ...collection, ...change } }).success).toBe(
          false,
        );
    } finally {
      await guard.close(false);
    }
  });
  it('admits_real_extraction_and_verification_serializers_with_mock_transport', async () => {
    const app = await harness();
    cleanup.push(() => app.close());
    const { runId } = await (await app.post(event('collection-serializer'))).json();
    const { snapshot } = (await app.store.qualifications.get(runId))!;
    const context: ResearchContext = {
      runId,
      snapshot,
      store: app.store.qualifications,
      deadline: await app.store.qualifications.start(runId, snapshot),
      domain: 'example.com',
      domains: ['example.com'],
      round: {
        index: 0,
        target: 'employeeCount',
        query: 'workforce',
        gap: 'unresolved',
        year: 2026,
        searchDomains: ['example.com'],
        previousEvidence: [],
        consultedUrls: [],
        missingAttributes: ['employeeCount'],
        supportedFacts: {},
        counters: { discoveredUrls: 0, retrievedPages: 0, extractedCandidates: 1, selectedCandidates: 1, urls: [] },
      },
    };
    const controlled = controlledResearch(),
      approval = await approvalFixture();
    const guard = await ModelCollectionGuard.consume(approval, controlled.fetch);
    app.store.qualifications.measurement = guard.measurement;
    vi.stubEnv('OPENAI_API_KEY', 'controlled-functional-key');
    vi.stubGlobal('fetch', guard.fetch);
    const sources = [
      {
        id: 'public',
        kind: 'website' as const,
        source: 'https://example.com/about',
        title: 'Public',
        retrievedAt: snapshot.assessmentTime,
        publishedAt: null,
        excerpt: 'The company has 40 employees.',
        digest: textDigest('The company has 40 employees.'),
        providerId: 'openai-web',
        retrieval: 'api' as const,
      },
    ];
    try {
      await guard.beginCase('case-0', 'domain');
      await guard.admitted(runId);
      const provider = new OpenAIEvidenceProvider();
      const extracted = await guard.stage('extract', context, () =>
        provider.extract('firmographics', sources, context),
      );
      const verified = await guard.stage('verify', context, () =>
        provider.verify('firmographics', extracted.candidates, sources, context),
      );
      expect(extracted.candidates.length).toBeGreaterThan(0);
      expect(verified.supportedCandidateIds.length).toBeGreaterThan(0);
      await guard.finishCase((await app.store.qualifications.get(runId))!.budget);
      expect(controlled.fetch).toHaveBeenCalledTimes(2);
      expect(guard.provenance()).toMatchObject({
        requestsReserved: 2,
        responseCount: 2,
        observedInputTokens: 200,
        observedOutputTokens: 200,
        failureCode: null,
      });
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      await guard.close(false);
    }
  });
});

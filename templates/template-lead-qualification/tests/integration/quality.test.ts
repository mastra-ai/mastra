import { SpanType } from '@mastra/core/observability';
import type { PruneResult } from '@mastra/core/storage';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DuckDBStore } from '@mastra/duckdb';
import { evaluationInputSchema, evaluateQualification, textDigest } from '../../src/mastra/observability/evaluation';
import { qualificationReport } from '../../src/mastra/observability/reporting';
import { LeadMaintenance } from '../../src/mastra/observability/maintenance';
import { qualificationConfig } from '../../src/mastra/config/qualification';
import { ResearchError } from '../../src/mastra/research/contracts';
import { safeSpan } from '../../src/mastra/observability/telemetry';
import { AttioStore } from '../../src/mastra/providers/attio/store';
import { qualityFixtures, qualityHarness } from '../support/quality';
import { event, harness } from '../support/application';
import { recordProvider, proposal } from '../support/research';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const close of cleanup.splice(0).reverse()) await close();
});
const window = { from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z' };

describe('qualification quality and operations', () => {
  it('runs_maintenance_preview_and_apply_after_shutdown_but_refuses_an_active_application', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lead-maintenance-cli-'));
    cleanup.push(() => rm(directory, { recursive: true, force: true }));
    await writeFile(join(directory, 'package.json'), '{}');
    const app = await harness({ directory: join(directory, 'data') });
    cleanup.push(() => app.close());
    const accepted = await (await app.post(event('retained-during-maintenance'))).json();
    const run = (mode: string, path: string) =>
      promisify(execFile)(
        process.execPath,
        [
          '--import',
          'tsx',
          fileURLToPath(new URL('../../scripts/observability/maintenance.ts', import.meta.url)),
          mode,
          path,
        ],
        {
          cwd: fileURLToPath(new URL('../../', import.meta.url)),
          env: {
            ...process.env,
            MASTRA_PROJECT_ROOT: directory,
            LEAD_QUALIFICATION_MODE: 'local',
            LEAD_INPUT_PROVIDER: 'local',
            LEAD_OUTPUT_PROVIDER: 'local',
          },
          timeout: 20_000,
        },
      );
    // PR #27839: maintenance must acquire the native lock once, before operational mutation.
    const blocked = join(directory, 'blocked.json');
    await expect(run('--preview', blocked)).rejects.toThrow(/lock/i);
    await expect(readFile(blocked)).rejects.toThrow('ENOENT');
    expect((await app.store.get(accepted.runId))!.status).toBe('accepted');
    await app.close(false);
    const preview = join(directory, 'preview.json');
    await run('--preview', preview);
    expect(JSON.parse(await readFile(preview, 'utf8')).observability).toEqual(
      expect.arrayContaining(['spans', 'logs', 'metrics'].map(key => expect.objectContaining({ key }))),
    );
    const applied = await run('--apply', preview);
    expect(JSON.parse(applied.stdout.trim().split('\n').at(-1)!).failures).toEqual([]);
    const reopened = await harness({ directory: join(directory, 'data') });
    cleanup.push(() => reopened.close());
    expect((await reopened.store.get(accepted.runId))!.status).toBe('accepted');
  });

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
    const operationalMetrics = tables.rows.length
      ? (await app.store.client.execute('SELECT count(*) AS count FROM mastra_metrics')).rows[0]!.count
      : 0;
    expect(operationalMetrics).toBe(0);
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

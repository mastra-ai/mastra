import assert from 'node:assert/strict';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canonical,
  digest,
  diagnosticCaps,
  diagnosticApprovalSchema,
  diagnosticFixturesSchema,
  prepareDiagnostic,
  fixtureContext,
  VerifierDiagnosticGuard,
} from '../../scripts/verifier-diagnostic-runner';
import { qualificationConfig, snapshotConfiguration } from '../../src/mastra/config/qualification';
import { OpenAIEvidenceProvider, interpretationInput } from '../../src/mastra/providers/evidence';
import type { ResearchContext, EvidenceProvider } from '../../src/mastra/providers/evidence';
import { verificationWireSchema, verifierLedgerSchema } from '../../src/mastra/research/contracts';
import { createEvidenceBatch, validateCandidates } from '../../src/mastra/research/evidence-validation';
import { verifierDiagnostics } from '../../src/mastra/research/verifier-diagnostics';
import { event, harness } from '../support/application';
import { controlledResearch, recordProvider, proposal } from '../support/research';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  for (const close of cleanup.splice(0).reverse()) await close();
});
const scope = { providerId: 'records', branch: 'firmographics' as const, roundIndex: 0 };
const decision = (candidateId: string, supported = true) => ({
  candidateId,
  decision: supported ? 'supported' : 'rejected',
  reasonCode: supported ? 'supported_observation' : 'value_not_supported',
  passageIndexes: [0],
});

describe('verifier diagnostic evidence', () => {
  it('persists_accepted_and_rejected_diagnostics_across_resume_reopen_and_legacy_reads', async () => {
    const records = recordProvider(
      'records',
      () => [
        {
          id: 'record-1',
          source: 'https://example.com/about',
          excerpt: 'There are19 employees. This company sells furniture. Headquarters: United States.',
        },
      ],
      () => [
        proposal('employeeCount', { min: 19, max: 19 }, '19 employees'),
        proposal('businessModel', 'b2b_saas', 'sells furniture'),
        proposal('headquartersCountry', 'US', 'invented headquarters quote'),
      ],
    );
    const verify = vi.fn<EvidenceProvider['verify']>(async (_branch, candidates) => ({
      supportedCandidateIds: candidates.filter(item => item.attribute !== 'businessModel').map(item => item.id),
      intentCoverageComplete: false,
      diagnostics: candidates.map(item => decision(item.id, item.attribute !== 'businessModel')),
    }));
    const provider = { ...records, verify };
    const config: typeof qualificationConfig = {
      ...qualificationConfig,
      sources: { ...qualificationConfig.sources, providerIds: ['records'] },
      research: {
        ...qualificationConfig.research,
        targeted: { ...qualificationConfig.research.targeted, order: ['employeeCount'] },
      },
    };
    const app = await harness({ evidence: [provider], qualification: config });
    const { runId } = await (await app.post(event('diagnostic-persist'))).json();
    const run = (await app.store.get(runId))!;
    vi.spyOn(app.store.qualifications, 'finish').mockRejectedValueOnce(
      new Error('controlled interruption before final assessment'),
    );
    await expect(app.qualification.qualify(runId, run.event)).rejects.toThrow('controlled interruption');
    const round = (await app.store.qualifications.round(runId, 0))!;
    expect(round.result.verifierDiagnostics).toHaveLength(2);
    expect(verify.mock.calls[0]![1].map(candidate => candidate.attribute)).toEqual(['employeeCount', 'businessModel']);
    expect(
      round.result.rejections.find(rejection => rejection.reason === 'exact_quote_absent')!.checks.semanticSupported,
    ).toBe(false);
    expect(round.result.candidates.map(item => item.attribute)).toEqual(['employeeCount']);
    expect(round.result.rejections.map(item => item.reason)).toEqual([
      'exact_quote_absent',
      'semantic_verification_rejected',
    ]);
    expect(round.result.verifierDiagnostics!.map(item => [item.verifierSupported, item.status])).toEqual([
      [true, 'reported'],
      [false, 'reported'],
    ]);
    expect(round.result.verifierDiagnostics![0]).toMatchObject({
      candidateInferred: false,
      modelReport: { decision: 'supported', reasonCode: 'supported_observation' },
    });
    const directory = app.directory;
    await app.close(false);
    const reopened = await harness({ directory, evidence: [provider], qualification: config });
    cleanup.push(() => reopened.close());
    const assessment = (await reopened.qualification.qualify(runId, run.event))!;
    expect(verify).toHaveBeenCalledTimes(1);
    expect(assessment.verifierDiagnostics).toEqual(round.result.verifierDiagnostics);
    expect(assessment.facts.employeeCount.value).toEqual({ min: 19, max: 19 });
    expect(assessment.facts.businessModel.disposition).toBe('unsupported');
    expect(assessment.facts.headquartersCountry.disposition).toBe('unsupported');
    expect(assessment.verifierDiagnostics![0]!.passages[0]).toMatchObject({
      quoteDigest: digest('19 employees'),
      evidenceDigest: digest('There are19 employees. This company sells furniture. Headquarters: United States.'),
    });
    const saved = (await reopened.store.qualifications.get(runId))!.assessment!;
    expect(await reopened.qualification.qualify(runId, run.event)).toEqual(saved);
    expect(verify).toHaveBeenCalledTimes(1);
    const legacyLedger = structuredClone(saved);
    for (const item of legacyLedger.verifierDiagnostics!) {
      delete item.candidateInferred;
      delete item.modelReport;
    }
    await reopened.store.client.execute({
      sql: 'UPDATE lead_qualifications SET assessment_json=? WHERE run_id=?',
      args: [JSON.stringify(legacyLedger), runId],
    });
    expect((await reopened.store.qualifications.get(runId))!.assessment).toEqual(legacyLedger);
    const legacy = structuredClone(saved);
    delete legacy.verifierDiagnostics;
    await reopened.store.client.execute({
      sql: 'UPDATE lead_qualifications SET assessment_json=? WHERE run_id=?',
      args: [JSON.stringify(legacy), runId],
    });
    expect((await reopened.store.qualifications.get(runId))!.assessment!.verifierDiagnostics).toBeUndefined();
    expect(
      (
        await reopened.store.client.execute({
          sql: 'SELECT assessment_json FROM lead_qualifications WHERE run_id=?',
          args: [runId],
        })
      ).rows[0]!.assessment_json,
    ).toBe(JSON.stringify(legacy));
  });

  it('isolates_missing_invalid_inconsistent_and_private_metadata_without_granting_support', async () => {
    const material = [
      {
        id: 'public',
        kind: 'website' as const,
        source: 'https://example.com/about?private-marker',
        title: 'public',
        retrievedAt: '2026-10-19T00:00:00Z',
        publishedAt: null,
        excerpt: '40 employees',
        digest: digest('40 employees'),
        providerId: 'records',
        retrieval: 'api' as const,
      },
    ];
    const batch = createEvidenceBatch([]);
    batch.add(material[0]!);
    const prepared = batch.prepare();
    const candidate = proposal('employeeCount', { min: 40, max: 40 }, '40 employees', 'public');
    const cases: Array<[unknown, string, string | null]> = [
      [undefined, 'missing', null],
      [null, 'not_reported', null],
      [[decision(candidate.id), decision(candidate.id)], 'invalid', 'schema_invalid'],
      [[decision('unknown-private-candidate')], 'invalid', 'coverage_mismatch'],
      [[{ ...decision(candidate.id), passageIndexes: [0, 0] }], 'invalid', 'schema_invalid'],
      [[{ ...decision(candidate.id), passageIndexes: [1] }], 'invalid', 'passage_invalid'],
      [[{ ...decision(candidate.id), reasonCode: 'arbitrary-private-reason' }], 'invalid', 'schema_invalid'],
      [[decision(candidate.id, false)], 'invalid', 'support_membership_mismatch'],
    ];
    for (const [raw, status, invalidCode] of cases) {
      const ledger = verifierDiagnostics(raw, [candidate], [candidate.id], prepared, scope);
      expect(ledger[0]).toMatchObject({ status, invalidCode, verifierSupported: true });
      expect(ledger[0]!.modelReport === null).toBe(
        status === 'missing' ||
          status === 'not_reported' ||
          invalidCode === 'schema_invalid' ||
          invalidCode === 'coverage_mismatch',
      );
      expect(JSON.stringify(ledger)).not.toMatch(/private-marker|unknown-private-candidate|arbitrary-private-reason/);
    }
    const lies = verifierDiagnostics([decision(candidate.id)], [candidate], [], prepared, scope);
    expect(
      verifierDiagnostics(
        [decision(candidate.id)],
        [{ ...candidate, inference: null }],
        [candidate.id],
        prepared,
        scope,
      )[0],
    ).toMatchObject({ status: 'reported', candidateInferred: false });
    expect(lies[0]).toMatchObject({
      status: 'invalid',
      verifierSupported: false,
      invalidCode: 'support_membership_mismatch',
      modelReport: { decision: 'supported', reasonCode: 'supported_observation' },
    });
    const inferred = { ...candidate, inference: { rationale: 'Grounded workforce estimate', additionalPassages: [] } };
    const inferredMismatch = verifierDiagnostics(
      [decision(inferred.id)],
      [inferred],
      [inferred.id],
      prepared,
      scope,
    )[0]!;
    expect(inferredMismatch).toMatchObject({
      status: 'invalid',
      invalidCode: 'inference_kind_mismatch',
      verifierSupported: true,
      candidateInferred: true,
      modelReport: { decision: 'supported', reasonCode: 'supported_observation' },
      decision: null,
      reasonCode: null,
      passages: [],
    });
    expect(
      verifierDiagnostics(
        [{ ...decision(candidate.id), reasonCode: 'supported_inference' }],
        [candidate],
        [candidate.id],
        prepared,
        scope,
      )[0],
    ).toMatchObject({
      invalidCode: 'inference_kind_mismatch',
      candidateInferred: false,
      modelReport: { decision: 'supported', reasonCode: 'supported_inference' },
    });
    expect(
      verifierLedgerSchema.safeParse({ ...inferredMismatch, invalidCode: 'support_membership_mismatch' }).success,
    ).toBe(false);
    expect(
      verifierLedgerSchema.safeParse({
        ...inferredMismatch,
        modelReport: { decision: 'supported', reasonCode: 'private arbitrary reason' },
      }).success,
    ).toBe(false);
    const legacyMismatch = { ...inferredMismatch, invalidCode: 'decision_mismatch' as const };
    delete legacyMismatch.modelReport;
    delete legacyMismatch.candidateInferred;
    expect(verifierLedgerSchema.parse(legacyMismatch)).toEqual(legacyMismatch);
    expect(
      validateCandidates([candidate], [], prepared, { ...scope, businessModelLabels: ['b2b_saas'] }).candidates,
    ).toEqual([]);
    const unknown = { ...candidate, evidenceId: 'unknown-private-reference' };
    expect(verifierDiagnostics([decision(candidate.id)], [unknown], [candidate.id], prepared, scope)[0]).toMatchObject({
      status: 'invalid',
      invalidCode: 'passage_invalid',
    });
    const privateSource = {
      ...material[0]!,
      id: 'private',
      kind: 'submitted' as const,
      excerpt: 'private contact@example.net',
      digest: digest('private contact@example.net'),
      retrieval: 'submitted' as const,
    };
    const privateCandidate = { ...candidate, evidenceId: privateSource.id, quote: privateSource.excerpt };
    const privateLedger = verifierDiagnostics(
      [decision(candidate.id)],
      [privateCandidate],
      [candidate.id],
      { material: [privateSource], aliases: new Map() },
      scope,
    );
    expect(privateLedger[0]).toMatchObject({ status: 'reported', passages: [], privatePassagesOmitted: 1 });
    expect(JSON.stringify(privateLedger)).not.toMatch(/contact@|private-marker|unknown-private-reference/);
    expect(JSON.stringify(privateLedger[0]).length).toBeLessThanOrEqual(4096);
    expect(verifierLedgerSchema.safeParse({ ...privateLedger[0], rawReason: 'private text' }).success).toBe(false);
  });
});

describe('bounded verifier-only admission', () => {
  it('preserves_fact_dates_in_bound_inputs_and_rejects_temporally_inconsistent_probes_offline', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'verifier-dates-'));
    cleanup.push(() => rm(directory, { recursive: true, force: true }));
    const transport = vi.fn<typeof fetch>(() => {
      throw new Error('Unexpected network access');
    });
    vi.stubGlobal('fetch', transport);
    const prepared = await prepareDiagnostic({
      fixtures: 'tests/fixtures/qualification/verifier-diagnostic.v2.json',
      approval: join(directory, 'approval.json'),
      output: join(directory, 'results'),
    });
    expect(prepared.approval.approved).toBe(false);
    const changedPolicy = structuredClone(qualificationConfig);
    changedPolicy.policy.rules.employeeCount.min = 1;
    changedPolicy.policy.rules.employeeCount.max = 1000;
    changedPolicy.policy.rules.businessModel.accepted = ['other'];
    for (const [index, item] of prepared.fixtures.cases.entries()) {
      const candidate = prepared.inputs[index]!.candidates![0]!;
      expect(candidate.asOf).toBe(item.candidates[0]!.attribute === 'employeeCount' ? '2026-10-18T00:00:00Z' : null);
      expect(candidate.asOf).not.toBe(prepared.fixtures.assessmentTime);
      expect(item.evidence[0]!.excerpt).toContain(candidate.quote);
      const context = fixtureContext(prepared.fixtures, item, randomUUID(), {} as ResearchContext['store']);
      context.snapshot = snapshotConfiguration(changedPolicy, prepared.fixtures.assessmentTime);
      expect(interpretationInput(item.branch, item.evidence, context, item.candidates)).toEqual(prepared.inputs[index]);
      const extraction = interpretationInput(item.branch, item.evidence, context);
      expect(extraction.employeeCount).toEqual(changedPolicy.policy.rules.employeeCount);
      expect(extraction.businessModel).toEqual(changedPolicy.policy.rules.businessModel);
    }
    for (const asOf of [null, '2026-10-17T00:00:00Z', prepared.fixtures.assessmentTime]) {
      const invalid = structuredClone(prepared.fixtures);
      invalid.cases[0]!.candidates[0]!.asOf = asOf;
      expect(() => diagnosticFixturesSchema.parse(invalid)).toThrow('diagnostic_claim_date_mismatch');
    }
    const published = structuredClone(prepared.fixtures);
    published.cases[2]!.candidates[0]!.asOf = published.cases[2]!.evidence[0]!.publishedAt;
    expect(() => diagnosticFixturesSchema.parse(published)).toThrow('diagnostic_claim_date_mismatch');
    const future = structuredClone(prepared.fixtures);
    future.assessmentTime = '2026-10-17T12:00:00Z';
    expect(() => diagnosticFixturesSchema.parse(future)).toThrow('diagnostic_claim_date_future');
    const undated = structuredClone(prepared.fixtures);
    const candidate = undated.cases[0]!.candidates[0]!;
    candidate.quote = 'Company 07 employs exactly 19 people.';
    candidate.asOf = null;
    undated.cases[0]!.evidence[0]!.excerpt = candidate.quote;
    undated.cases[0]!.evidence[0]!.digest = digest(candidate.quote);
    expect(diagnosticFixturesSchema.parse(undated).cases[0]!.candidates[0]!.asOf).toBeNull();
    const invalidDate = structuredClone(prepared.fixtures);
    const source = invalidDate.cases[0]!.evidence[0]!;
    invalidDate.cases[0]!.candidates[0]!.quote = candidate.quote.replace('Company', 'As of 31 February 2026, Company');
    source.excerpt = invalidDate.cases[0]!.candidates[0]!.quote;
    source.digest = digest(source.excerpt);
    expect(() => diagnosticFixturesSchema.parse(invalidDate)).toThrow('diagnostic_claim_date_invalid');
    expect(transport).toHaveBeenCalledTimes(0);
  });
  const inputs = Array.from({ length: 6 }, (_, index) => ({ fixture: index }));
  async function setup(transport: typeof fetch = vi.fn<typeof fetch>(async () => new Response('{}'))) {
    const directory = await mkdtemp(join(tmpdir(), 'verifier-guard-'));
    cleanup.push(() => rm(directory, { recursive: true, force: true }));
    const approval = diagnosticApprovalSchema.parse({
      version: 1,
      purpose: 'verifier_diagnostic',
      executionId: randomUUID(),
      approved: true,
      approvedBy: 'mocked operator',
      approvedAt: '2026-10-19T00:00:00Z',
      projectRoot: directory,
      fixturePath: join(directory, 'fixture.json'),
      approvalPath: join(directory, 'approval.json'),
      journalPath: join(directory, 'journal.jsonl'),
      outputDirectory: join(directory, 'output'),
      sourceRevision: 'a'.repeat(40),
      sourceDigest: 'b'.repeat(64),
      fixtureDigest: 'c'.repeat(64),
      configurationDigest: 'd'.repeat(64),
      schemaDigest: digest(canonical(z.toJSONSchema(verificationWireSchema))),
      inputsDigest: digest(canonical(inputs)),
      caseOrderDigest: 'f'.repeat(64),
      model: 'openai/gpt-6-luna',
      caps: diagnosticCaps,
      pricing: {
        modelSource: 'https://developers.openai.com/api/docs/models/gpt-6-luna',
        pricingSource: 'https://developers.openai.com/api/docs/pricing',
        retrievedAt: '2026-10-19',
        currency: 'USD',
        reservedMaximumUsd: 0.2022768,
        assumption:
          'Full UTF8 body bytes as input tokens plus4096 framing; maximum cache-write, Fast2x and regional1.1 rates; not an account or invoice guarantee',
      },
    });
    return { directory, approval, transport };
  }
  function request(input: unknown, extra: Record<string, unknown> = {}) {
    return {
      method: 'POST',
      body: JSON.stringify({
        model: 'gpt-6-luna',
        stream: true,
        store: false,
        reasoning: { effort: 'low' },
        max_output_tokens: 1000,
        input: [
          { role: 'system', content: 'frozen verification' },
          { role: 'user', content: [{ type: 'input_text', text: JSON.stringify(input) }] },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'response',
            strict: true,
            schema: z.toJSONSchema(verificationWireSchema),
          },
        },
        ...extra,
      }),
    };
  }
  async function measure(
    guard: VerifierDiagnosticGuard,
    runId: string,
    inputTokens: number | null = 10,
    outputTokens: number | null = 10,
  ) {
    await guard.measurement({
      usageId: randomUUID(),
      runId,
      stage: 'verify',
      model: 'openai/gpt-6-luna',
      durationMs: 1,
      inputTokens,
      outputTokens,
      reasoningTokens: null,
    });
  }
  it('refuses_unapproved_reused_changed_inputs_and_unbound_network_without_transport', async () => {
    const { approval, transport } = await setup();
    await expect(
      VerifierDiagnosticGuard.consume({ ...approval, approved: false }, transport, inputs, 'frozen verification'),
    ).rejects.toThrow('not_approved');
    await expect(VerifierDiagnosticGuard.consume(approval, transport, [{}], 'frozen verification')).rejects.toThrow(
      'inputs_mismatch',
    );
    const guard = await VerifierDiagnosticGuard.consume(approval, transport, inputs, 'frozen verification');
    await guard.close(false);
    await expect(
      VerifierDiagnosticGuard.consume(approval, transport, inputs, 'frozen verification'),
    ).rejects.toMatchObject({ code: 'EEXIST' });
    expect(transport).toHaveBeenCalledTimes(0);
    const mutable = structuredClone(inputs),
      mutation = await setup();
    const frozen = await VerifierDiagnosticGuard.consume(
      mutation.approval,
      mutation.transport,
      mutable,
      'frozen verification',
    );
    try {
      mutable[0] = { fixture: 99 };
      await frozen.beginSlot(0, randomUUID());
      await expect(frozen.fetch('https://api.openai.com/v1/responses', request(mutable[0]))).rejects.toThrow(
        'input_mismatch',
      );
      expect(mutation.transport).toHaveBeenCalledTimes(0);
    } finally {
      await frozen.close(false);
    }
    const retry = await setup();
    const single = await VerifierDiagnosticGuard.consume(
      retry.approval,
      retry.transport,
      inputs,
      'frozen verification',
    );
    try {
      await single.beginSlot(0, randomUUID());
      await single.fetch('https://api.openai.com/v1/responses', request(inputs[0]));
      await expect(single.fetch('https://api.openai.com/v1/responses', request(inputs[0]))).rejects.toThrow(
        'retry_invalid',
      );
      expect(retry.transport).toHaveBeenCalledTimes(1);
    } finally {
      await single.close(false);
    }
    for (const mode of [
      'endpoint',
      'model',
      'tools',
      'input',
      'schema',
      'schema_description',
      'source',
      'output',
      'body',
      'slot',
      'deadline',
      'instructions',
      'service_tier',
      'background',
      'reasoning',
      'message',
    ]) {
      const item = await setup();
      let sourceChecks = 0;
      const current = await VerifierDiagnosticGuard.consume(
        item.approval,
        item.transport,
        inputs,
        'frozen verification',
        async () => {
          if (mode === 'source' && ++sourceChecks > 1) throw new Error('changed source');
        },
      );
      try {
        const runId = randomUUID();
        if (mode === 'slot') {
          await assert.rejects(current.beginSlot(1, runId), /slot_invalid/);
          continue;
        }
        await current.beginSlot(0, runId);
        if (mode === 'deadline') {
          vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600001);
        }
        const extra =
          mode === 'schema_description'
            ? {
                text: {
                  format: {
                    type: 'json_schema',
                    name: 'response',
                    strict: true,
                    schema: { ...z.toJSONSchema(verificationWireSchema), description: 'changed model instruction' },
                  },
                },
              }
            : mode === 'instructions'
              ? { instructions: 'changed' }
              : mode === 'service_tier'
                ? { service_tier: 'priority' }
                : mode === 'background'
                  ? { background: true }
                  : mode === 'reasoning'
                    ? { reasoning: { effort: 'high' } }
                    : mode === 'message'
                      ? {
                          input: [
                            { role: 'system', content: 'frozen verification', name: 'other' },
                            { role: 'user', content: JSON.stringify(inputs[0]) },
                          ],
                        }
                      : mode === 'model'
                        ? { model: 'other' }
                        : mode === 'tools'
                          ? { tools: [{ type: 'web_search' }] }
                          : mode === 'schema'
                            ? { text: {} }
                            : mode === 'output'
                              ? { max_output_tokens: 1001 }
                              : mode === 'body'
                                ? { padding: 'x'.repeat(32768) }
                                : {};
        await expect(
          current.fetch(
            mode === 'endpoint' ? 'https://example.net/' : 'https://api.openai.com/v1/responses',
            request(mode === 'input' ? { changed: true } : inputs[0], extra),
          ),
        ).rejects.toThrow('diagnostic_');
        expect(item.transport).toHaveBeenCalledTimes(0);
      } finally {
        vi.restoreAllMocks();
        await current.close(false);
      }
    }
  });
  it('reserves_before_dispatch_enforces18_slots_and_retains_unknown_excess_or_failed_usage', async () => {
    const item = await setup();
    const guard = await VerifierDiagnosticGuard.consume(item.approval, item.transport, inputs, 'frozen verification');
    try {
      for (let index = 0; index < 18; index++) {
        const runId = randomUUID();
        await guard.beginSlot(index, runId);
        await guard.fetch('https://api.openai.com/v1/responses', request(inputs[Math.floor(index / 3)]));
        await measure(guard, runId);
        await guard.finishSlot();
      }
      await expect(guard.beginSlot(18, randomUUID())).rejects.toThrow('slot_invalid');
      expect(item.transport).toHaveBeenCalledTimes(18);
      expect(vi.mocked(item.transport).mock.calls[0]![1]).toMatchObject({ redirect: 'error' });
      expect(guard.accounting()).toMatchObject({
        requestsReserved: 18,
        outputTokensReserved: 18000,
        inputTokens: 180,
        outputTokens: 180,
        usageComplete: true,
      });
      expect(guard.accounting().costReservedNanoUsd).toBeLessThanOrEqual(250000000);
    } finally {
      await guard.close(false);
    }
    for (const mode of ['unknown', 'excess', 'transport']) {
      const transport = vi.fn<typeof fetch>(async () => {
        if (mode === 'transport') throw new Error('private provider error');
        return new Response('{}');
      });
      const next = await setup(transport),
        current = await VerifierDiagnosticGuard.consume(next.approval, transport, inputs, 'frozen verification');
      try {
        const runId = randomUUID();
        await current.beginSlot(0, runId);
        if (mode === 'transport')
          await assert.rejects(
            current.fetch('https://api.openai.com/v1/responses', request(inputs[0])),
            /transport_failed/,
          );
        else {
          await current.fetch('https://api.openai.com/v1/responses', request(inputs[0]));
          await assert.rejects(
            measure(current, runId, mode === 'unknown' ? null : 1000000),
            mode === 'unknown' ? /usage_unknown/ : /usage_exceeds/,
          );
        }
        await expect(current.beginSlot(1, randomUUID())).rejects.toThrow('diagnostic_');
        expect(transport).toHaveBeenCalledTimes(1);
        expect(current.accounting().inputTokens).toBe(mode === 'excess' ? 1000000 : null);
        expect(current.accounting().usageComplete).toBe(mode === 'excess');
      } finally {
        await current.close(false);
      }
      const journal = await readFile(next.approval.journalPath, 'utf8');
      expect(journal.indexOf('request.reserved')).toBeLessThan(
        journal.indexOf(mode === 'transport' ? 'request.failed' : 'request.measurement'),
      );
      expect(journal).not.toContain('private provider error');
    }
  });
  it('fails_closed_on_journal_write_loss_before_any_transport', async () => {
    const item = await setup(),
      probe = await open(join(item.directory, 'probe'), 'w');
    const guard = await VerifierDiagnosticGuard.consume(item.approval, item.transport, inputs, 'frozen verification');
    const fault = vi
      .spyOn(Object.getPrototypeOf(probe), 'appendFile')
      .mockRejectedValue(new Error('private IO failure'));
    try {
      await expect(guard.beginSlot(0, randomUUID())).rejects.toThrow('journal_unavailable');
      await expect(guard.fetch('https://api.openai.com/v1/responses', request(inputs[0]))).rejects.toThrow(
        'journal_unavailable',
      );
      expect(item.transport).toHaveBeenCalledTimes(0);
    } finally {
      fault.mockRestore();
      await probe.close();
      await guard.close(false);
    }
    expect(await readFile(item.approval.journalPath, 'utf8')).toContain('consumed');
  });
  it('admits_the_real_verifier_serializer_with_mock_transport_and_legacy_optional_diagnostics', async () => {
    const app = await harness();
    cleanup.push(() => app.close());
    const { runId } = await (await app.post(event('verifier-serializer'))).json();
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
      item = await setup(controlled.fetch);
    const sources = [
      {
        id: 'public',
        kind: 'website' as const,
        source: 'https://example.com/about',
        title: 'Public',
        retrievedAt: snapshot.assessmentTime,
        publishedAt: null,
        excerpt: '40 employees',
        digest: digest('40 employees'),
        providerId: 'openai-web',
        retrieval: 'api' as const,
      },
    ];
    const candidates = [proposal('employeeCount', { min: 40, max: 40 }, '40 employees', 'public')];
    const input = interpretationInput('firmographics', sources, context, candidates),
      sameInputs = Array.from({ length: 6 }, () => input);
    const wireSchema = JSON.parse(
      await readFile(new URL('../fixtures/qualification/verifier-wire-schema.v1.json', import.meta.url), 'utf8'),
    );
    const guard = await VerifierDiagnosticGuard.consume(
      { ...item.approval, inputsDigest: digest(canonical(sameInputs)), schemaDigest: digest(canonical(wireSchema)) },
      controlled.fetch,
      sameInputs,
      snapshot.config.prompts.verification,
      async () => {},
      wireSchema,
    );
    app.store.qualifications.measurement = guard.measurement;
    vi.stubEnv('OPENAI_API_KEY', 'controlled-functional-key');
    vi.stubGlobal('fetch', guard.fetch);
    try {
      const modes = [
        {},
        { verificationDiagnostics: null },
        {
          verificationDiagnostics: [
            {
              candidateId: candidates[0]!.id,
              decision: 'supported',
              reasonCode: 'private arbitrary reason',
              passageIndexes: [0],
            },
          ],
        },
      ];
      for (const [index, scenario] of modes.entries()) {
        controlled.setScenario(scenario);
        await guard.beginSlot(index, runId);
        const result = await new OpenAIEvidenceProvider().verify('firmographics', candidates, sources, context);
        const payload = JSON.parse(controlled.fetch.mock.calls[index]![1]!.body as string);
        const user = payload.input.find((message: { role: string }) => message.role === 'user');
        const sent = JSON.parse(user.content.map((part: { text: string }) => part.text).join(''));
        expect(sent.businessModel).toEqual({ categories: qualificationConfig.policy.rules.businessModel.categories });
        expect(sent).not.toHaveProperty('employeeCount');
        expect(sent.businessModel).not.toHaveProperty('accepted');
        expect(sent.businessModel).not.toHaveProperty('points');
        expect(sent.businessModel).not.toHaveProperty('onMismatch');
        expect(result.supportedCandidateIds).toEqual([candidates[0]!.id]);
        const batch = createEvidenceBatch([]);
        batch.add(sources[0]!);
        const prepared = batch.prepare();
        expect(
          validateCandidates(candidates, result.supportedCandidateIds, prepared, {
            ...scope,
            providerId: 'openai-web',
            businessModelLabels: ['b2b_saas'],
          }).candidates,
        ).toHaveLength(1);
        const ledger = verifierDiagnostics(result.diagnostics, candidates, result.supportedCandidateIds, prepared, {
          ...scope,
          providerId: 'openai-web',
        });
        expect(ledger[0]!.status).toBe(['missing', 'not_reported', 'invalid'][index]);
        expect(JSON.stringify(ledger)).not.toContain('private arbitrary reason');
        await guard.finishSlot();
      }
      expect(controlled.fetch).toHaveBeenCalledTimes(3);
      expect(guard.accounting()).toMatchObject({ requestsReserved: 3, inputTokens: 300, outputTokens: 300 });
    } finally {
      await guard.close(false);
    }
  });
});

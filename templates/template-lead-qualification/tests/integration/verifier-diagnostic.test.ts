import { createHash } from 'node:crypto';
import { qualificationConfig } from '../../src/mastra/config/qualification';
import { createEvidenceBatch, validateCandidates } from '../../src/mastra/research/evidence-validation';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EvidenceProvider } from '../../src/mastra/providers/evidence';
import { verifierLedgerSchema } from '../../src/mastra/research/contracts';
import { verifierDiagnostics } from '../../src/mastra/observability/verifier-diagnostics';
import { event, harness } from '../support/application';
import { recordProvider, proposal } from '../support/research';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  for (const close of cleanup.splice(0).reverse()) await close();
});
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
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

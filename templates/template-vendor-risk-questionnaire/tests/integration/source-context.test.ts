import { controlledSourceProvider } from '../support/source-provider.ts';
import { fixturePolicy } from '../support/policy.ts';
import { attachDraftWorkflow } from '../support/workflow.ts';
import { draftingFixture, userText } from '../support/drafting.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { modelEnvelope } from '../../src/mastra/processing/model.ts';
import { it, expect } from 'vitest';
import { resolve } from 'node:path';
import { corpusFixture } from '../support/workflow.ts';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';
import { demoQuestions } from '../fixtures/corpus.ts';
import { canonicalJson } from '../../src/mastra/intake/source.ts';
import { validateEvidenceCitation } from '../../src/mastra/evidence/snapshot.ts';
import { context } from '../fixtures/support.ts';

it('retrieves_distinct_authoritative_json_fields_table_relationships_and_the_original_production_conflict', async () => {
  const root = await temporaryDirectory();
  const f = await corpusFixture(root, `file:${resolve(root, 'state.db')}`, () => {
    throw new Error('NO_PROVIDER_IN_RETRIEVAL_PROOF');
  });
  try {
    expect(f.evidence.sources).toHaveLength(7);
    expect(f.evidence.record.denied).toContainEqual(
      expect.objectContaining({ documentId: 'privacy', reason: 'LLM_PROHIBITED' }),
    );
    const cases = [
      [1, 'assurance', '/iso27001Certified', 'false'],
      [2, 'assurance', '/soc2TypeIIReport', 'false'],
      [8, 'data', '/production/inTransit', 'TLS 1.2 or later'],
      [9, 'data', '/production/atRest', 'AES-256 using provider-managed keys'],
      [10, 'data', '/production/customerManagedKeys', 'false'],
      [11, 'data', '/production/regions/0', 'us-east-1'],
    ] as const;
    for (const [question, documentId, pointer, raw] of cases) {
      const hits = await f.evidence.search(demoQuestions[question]![1], 2);
      expect(
        hits.map(hit => hit.excerpt),
        `question-${question + 1}`,
      ).toContainEqual(
        expect.objectContaining({ documentId, text: raw, locator: expect.objectContaining({ pointer }) }),
      );
    }
    const scans = await f.evidence.search(demoQuestions[12]![1], 2);
    expect(scans.map(hit => hit.excerpt.text)).toContain(
      'Weekly dependency scans are scheduled and this record confirms one completed scan',
    );
    const canonical = await f.evidence.search(demoQuestions[17]![1], 3);
    expect(canonical.map(hit => hit.excerpt.text)).toContain('Production security logs are retained for 90 days.');
    // This controlled concept query is not a claim about discarded historical tool arguments.
    const conflict = await f.evidence.search('production log retention', 2);
    expect(conflict.map(hit => hit.excerpt.text)).toContain('90 days');
    expect(conflict.map(hit => hit.excerpt.text)).toContain('60 days');
    const restricted = await f.evidence.search('production restoration exercise backups', 2);
    expect(restricted.some(hit => hit.excerpt.disclosure === 'restricted')).toBe(true);
    for (const hit of [...conflict, ...scans, ...restricted]) {
      const excerpt = hit.excerpt;
      const citation = {
        id: 'citation',
        documentId: excerpt.documentId,
        version: excerpt.version,
        sourceSha256: excerpt.sourceSha256,
        locator: excerpt.locator,
        supportingExcerpt: excerpt.text,
      };
      expect(await validateEvidenceCitation(f.evidence.record, citation, resolve(root, 'evidence'), context())).toEqual(
        citation,
      );
      expect(canonicalJson(f.evidence.record.excerpts.find(e => e.id === excerpt.id))).toBe(canonicalJson(excerpt));
    }
  } finally {
    await f.close();
    await cleanupDirectory(root);
  }
}, 60000);

it('drafts_the_full_demo_with_source_bound_citations_conflicts_and_restricted_gaps', async () => {
  const root = await temporaryDirectory();
  const source = controlledSourceProvider();
  const corpusRoot = root;
  const corpusUrl = `file:${resolve(root, 'state.db')}`;
  const corpus = await corpusFixture(root, corpusUrl, source.factory);
  try {
    await corpus.start(corpus.input);
    const store = await openProcessingStore(corpusUrl);
    try {
      const status = (await store.status(corpus.input.runId))!;
      const diagnostics = await store.diagnostics(corpus.input.runId);
      expect(status.run.stopReason, JSON.stringify(diagnostics)).toBeNull();
      expect(status.results).toHaveLength(24);
      expect(status.usage.every(u => u.status === 'observed')).toBe(true);
      const results = status.results;
      expect(results.filter(r => r.draft && r.draft.value !== 'unknown').length).toBeGreaterThanOrEqual(15);
      for (const [index, pointer, raw] of [
        [1, '/iso27001Certified', 'false'],
        [2, '/soc2TypeIIReport', 'false'],
        [8, '/production/inTransit', 'TLS 1.2 or later'],
        [10, '/production/customerManagedKeys', 'false'],
        [11, '/production/regions/0', 'us-east-1'],
      ] as const)
        expect(results[index]!.draft!.citations).toContainEqual(
          expect.objectContaining({ supportingExcerpt: raw, locator: expect.objectContaining({ pointer }) }),
        );
      expect(results[12]!.draft!.citations.some(c => c.supportingExcerpt.includes('one completed scan'))).toBe(true);
      expect(
        results[17]!.reasons,
        JSON.stringify(
          source.calls.filter(c => c.id === 'VRQ-018' && c.phase === 'draft').map(c => JSON.parse(userText(c.call))),
        ),
      ).toContain('CONFLICTING_EVIDENCE');
      expect(results[17]!.draft!.citations.map(c => c.supportingExcerpt)).toEqual(
        expect.arrayContaining(['90 days', '60 days']),
      );
      for (const index of [18, 19, 20, 21]) expect(results[index]!.draft?.value).toBe('unknown');
      expect(results[23]!.status).toBe('security_review_required');
      expect(status.usage.filter(u => u.questionId.startsWith('consistency-'))).toHaveLength(3);
      expect(results[8]!.interpretation!.equivalenceKey).toBe(results[22]!.interpretation!.equivalenceKey);
      for (const result of results)
        for (const citation of result.draft?.citations ?? [])
          await validateEvidenceCitation(corpus.evidence.record, citation, resolve(corpusRoot, 'evidence'), context());
      expect(source.calls.filter(c => c.phase === 'draft').every(c => (c.call.tools ?? []).length === 0)).toBe(true);
      expect(source.calls.some(c => JSON.stringify(c.call).includes('usefulEligible'))).toBe(false);
    } finally {
      await store.close();
    }
  } finally {
    await corpus.close();
    await cleanupDirectory(root);
  }
}, 60000);

it('keeps_differing_sibling_raw_citations_and_complete_nested_custom_qualifications_separate_after_native_drafting_and_reopen', async () => {
  const root = await temporaryDirectory();
  try {
    const bytes = JSON.stringify({
      scope: {
        deployment: { product: 'tasks', environment: 'production', asOf: 'current' },
        customQualifier: 'Root scope applies only to workforce administrators',
      },
      iso27001Certified: false,
      soc2TypeIIReport: true,
      controls: {
        production: {
          mfa: false,
          qualifications: {
            deployment: { environment: 'production', applicableWindow: 'current', customerTier: 'enterprise' },
            customQualifier: 'Administrators only; café ☕',
          },
        },
        staging: {
          mfa: true,
          qualifications: {
            deployment: { environment: 'staging', applicableWindow: 'last-year', customerTier: 'basic' },
            customQualifier: 'Test accounts only',
          },
        },
      },
    });
    const f = await draftingFixture(root, {
      questions: [{ text: 'Is ISO 27001 certification held?' }, { text: 'Is a SOC 2 type II report held?' }],
      evidence: { format: 'json', bytes },
    });
    const source = controlledSourceProvider();
    const native = await attachDraftWorkflow(f.url, f.runtimeRoot, source.factory);
    try {
      await (
        await native.target.createRun()
      ).start({
        inputData: {
          runId: f.runId,
          evidenceRoot: resolve(root, 'evidence'),
          manifestPath: f.manifestPath,
          policy: fixturePolicy,
        },
      });
    } finally {
      await native.close();
    }
    const reopened = await openProcessingStore(f.url),
      status = (await reopened.status(f.runId))!;
    reopened.close();
    expect(status.results.map(r => r.draft?.value)).toEqual(['no', 'yes']);
    for (const [i, pointer, raw] of [
      [0, '/iso27001Certified', 'false'],
      [1, '/soc2TypeIIReport', 'true'],
    ] as const) {
      const citation = status.results[i]!.draft!.citations[0]!;
      expect(citation).toMatchObject({ locator: { pointer }, supportingExcerpt: raw });
      await validateEvidenceCitation(f.snapshot.record, citation, resolve(root, 'evidence'), context());
      await expect(
        validateEvidenceCitation(
          f.snapshot.record,
          { ...citation, supportingExcerpt: raw === 'false' ? 'true' : 'false' },
          resolve(root, 'evidence'),
          context(),
        ),
      ).rejects.toThrow();
    }
    for (const environment of ['production', 'staging']) {
      const hits = await f.snapshot.search(`${environment} mfa`, 3);
      const hit = hits.find(
        h =>
          h.excerpt.locator.kind === 'json.pointer' &&
          String(h.excerpt.locator.pointer) === `/controls/${environment}/mfa`,
      )!;
      expect(hit).toBeDefined();
      const { modelEvidenceExcerpt } = await import('../../src/mastra/evidence/context.ts');
      const projection = modelEvidenceExcerpt(hit.excerpt);
      expect(projection.context!.relations).toEqual(
        expect.arrayContaining([
          ['/scope/deployment/environment', 'production'],
          ['/scope/customQualifier', 'Root scope applies only to workforce administrators'],
          [`/controls/${environment}/qualifications/deployment/environment`, environment],
          [
            `/controls/${environment}/qualifications/deployment/applicableWindow`,
            environment === 'production' ? 'current' : 'last-year',
          ],
          [
            `/controls/${environment}/qualifications/customQualifier`,
            environment === 'production' ? 'Administrators only; café ☕' : 'Test accounts only',
          ],
        ]),
      );
      expect(projection.text).toBe(environment === 'production' ? 'false' : 'true');
      expect(
        projection.context!.relations.some(([path]) =>
          path.startsWith(`/controls/${environment === 'production' ? 'staging' : 'production'}/`),
        ),
      ).toBe(false);
    }
    expect(source.calls.filter(c => c.phase === 'draft').every(c => modelEnvelope(c.call).inputBytes <= 32000)).toBe(
      true,
    );
    expect(status.usage.every(u => u.status === 'observed')).toBe(true);
    expect(
      source.calls
        .filter(c => c.phase === 'draft')
        .some(c =>
          JSON.parse(userText(c.call)).excerpts.some((e: { context?: { relations: Array<[string, string]> } }) =>
            e.context?.relations.some(
              ([path, value]) =>
                path === '/scope/customQualifier' && value === 'Root scope applies only to workforce administrators',
            ),
          ),
        ),
    ).toBe(true);
  } finally {
    await cleanupDirectory(root);
  }
}, 60000);

it('retains_canonical_intake_and_valid_siblings_when_one_complete_source_context_is_unfit', async () => {
  const root = await temporaryDirectory();
  try {
    const f = await draftingFixture(root, {
      questions: [{ text: 'badbranch' }, { text: 'goodbranch' }],
      evidence: {
        format: 'json',
        bytes: JSON.stringify({
          badbranch: { control: false, qualification: 'x'.repeat(4100) },
          goodbranch: { control: 'control MFA is required for workforce administrative accounts.' },
        }),
      },
    });
    const source = controlledSourceProvider();
    const native = await attachDraftWorkflow(f.url, f.runtimeRoot, source.factory);
    try {
      await (
        await native.target.createRun()
      ).start({
        inputData: {
          runId: f.runId,
          evidenceRoot: resolve(root, 'evidence'),
          manifestPath: f.manifestPath,
          policy: fixturePolicy,
        },
      });
    } finally {
      await native.close();
    }
    const reopened = await openProcessingStore(f.url),
      status = (await reopened.status(f.runId))!;
    reopened.close();
    expect(status.results[0]).toMatchObject({ draft: null, reasons: ['SOURCE_UNAVAILABLE'] });
    expect(status.results[1]!.draft!.citations[0]).toMatchObject({
      supportingExcerpt: 'control MFA is required for workforce administrative accounts.',
      locator: { pointer: '/goodbranch/control' },
    });
    const { openIntakeStore } = await import('../../src/mastra/persistence/store.ts');
    const intake = await openIntakeStore(f.url);
    try {
      expect((await intake.readIntake(f.runId))!.input).toEqual(f.input);
      expect(await intake.readEvidence(f.runId)).toEqual(f.snapshot.record);
    } finally {
      intake.close();
    }
    const raw = f.snapshot.record.excerpts.find(
      e => e.locator.kind === 'json.pointer' && e.locator.pointer === '/badbranch/control',
    )!;
    const humanCitation = {
      id: 'human-citation',
      documentId: raw.documentId,
      version: raw.version,
      sourceSha256: raw.sourceSha256,
      locator: raw.locator,
      supportingExcerpt: raw.text,
    };
    expect(
      await validateEvidenceCitation(f.snapshot.record, humanCitation, resolve(root, 'evidence'), context()),
    ).toEqual(humanCitation);
    expect(source.calls.filter(c => c.phase === 'draft' && c.id === 'Q1')).toHaveLength(0);
    expect(source.calls.filter(c => c.phase === 'verification' && c.id === 'Q1')).toHaveLength(0);
  } finally {
    await cleanupDirectory(root);
  }
}, 60000);

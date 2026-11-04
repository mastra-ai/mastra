import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalJson } from '../../src/mastra/intake/source.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { executionPolicySchema, defaultExecutionPolicy } from '../../src/mastra/contracts/execution-policy.ts';
import { createDraftWorkflow } from '../../src/mastra/workflows/vendor-risk-drafts.ts';
import { draftingFixture, controlledProvider, executeDraft, jsonStream, userText } from '../support/drafting.ts';
import type { CasePlan } from '../support/drafting.ts';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';

let root: string;
beforeEach(async () => {
  root = await temporaryDirectory();
});
afterEach(async () => {
  await cleanupDirectory(root);
});

describe('persisted grounded answer processing', () => {
  it('drafts_supported_positive_negative_and_partial_answers_with_valid_citations', async () => {
    const fixture = await draftingFixture(root, {
      denied: true,
      questions: [
        { text: 'Is MFA required in production?' },
        { text: 'Does the basic tier offer SSO?' },
        { text: 'Is SSO available to every tier?' },
        { text: 'Do you process payment cards?' },
        { text: 'Describe production log retention.', kind: 'free_text' },
        { text: 'Does the basic tier offer SSO?', kind: 'single_choice', choices: 'available|unavailable' },
      ],
    });
    const provider = controlledProvider(fixture, [
      { value: 'yes' },
      { value: 'no' },
      { value: 'partial' },
      { value: 'not_applicable' },
      { value: 'free_text' },
      { value: 'no', draft: d => ({ ...d, responseOption: 'unavailable' }) },
    ]);
    const before = canonicalJson(fixture.input);
    const { result, status } = await executeDraft(fixture, provider);
    expect(result.status).toBe('success');
    expect(status?.security.filter(s => s.status !== 'passed')).toEqual([]);
    expect(status?.run.state).toBe('awaiting_review');
    expect(status?.results.map(r => r.draft?.value)).toEqual([
      'yes',
      'no',
      'partial',
      'not_applicable',
      'free_text',
      'no',
    ]);
    expect(status?.results.every(r => r.status === 'draft_eligible' && r.reasons.length === 0)).toBe(true);
    for (const r of status!.results) {
      expect(r.draft?.citations[0]?.sourceSha256).toBe(fixture.snapshot.record.documents[0]?.sha256);
      expect(r.draft?.citations[0]?.supportingExcerpt).toContain('Production');
      expect(r.draft?.claims[0]?.citationIds).toEqual(['citation']);
    }
    expect(status?.results[2]?.draft?.limitations).toEqual(['Enterprise subscription scope only.']);
    expect(status?.results[4]?.draft?.responseOption).toBeNull();
    expect(status?.results[5]?.draft?.responseOption).toBe('unavailable');
    expect(canonicalJson(fixture.input)).toBe(before);
    expect(provider.calls.filter(c => c.phase === 'interpretation')).toHaveLength(3);
    expect(
      provider.calls.every(
        c =>
          c.call.providerOptions?.openai?.reasoningEffort === 'medium' &&
          c.call.providerOptions.openai.serviceTier === 'default' &&
          c.call.maxOutputTokens === 4000,
      ),
    ).toBe(true);
    const reopened = await openProcessingStore(fixture.url);
    try {
      expect((await reopened.status(fixture.runId))?.results).toEqual(status?.results);
    } finally {
      reopened.close();
    }
  });

  it('limits_parallel_question_execution_and_preserves_input_order', async () => {
    const fixture = await draftingFixture(root, {
      questions: Array.from({ length: 8 }, (_, i) => ({ text: `Does control ${i + 1} require workforce MFA?` })),
    });
    const provider = controlledProvider(
      fixture,
      Array.from({ length: 8 }, (_, i) => ({ delayMs: i === 0 ? 100 : 10 })),
    );
    const { status } = await executeDraft(fixture, provider, { maxPhysicalCalls: 200 });
    expect(provider.maximum).toBeGreaterThan(1);
    expect(provider.maximum).toBeLessThanOrEqual(4);
    expect(provider.finished[0]).not.toBe(fixture.questions[0]?.id);
    expect(status?.results.map(r => r.questionId)).toEqual(fixture.questions.map(q => q.id));
    expect(status?.results.every(r => r.status === 'draft_eligible')).toBe(true);
    expect(new Set(status?.usage.map(u => u.id)).size).toBe(status?.usage.length);
    expect(status?.usage.length).toBe(provider.calls.length);
  });

  it('escalates_missing_partial_conflicting_and_unsupported_claims', async () => {
    const fixture = await draftingFixture(root, {
      questions: Array.from({ length: 7 }, (_, i) => ({ text: `Review control ${i + 1}.` })),
    });
    const plans: CasePlan[] = [
      { value: 'unknown' },
      { draft: d => ({ ...d, coveredSubparts: [] }) },
      { verification: { supportedClaimIds: [], conflictedClaimIds: ['claim'] } },
      { verification: { supportedClaimIds: [] } },
      { verification: { unsupportedCommitment: true } },
      { draft: d => ({ ...d, confidence: 0.3 }) },
      { draft: d => ({ ...d, value: 'partial', responseOption: 'absent' }) },
    ];
    const { status } = await executeDraft(fixture, controlledProvider(fixture, plans), { maxPhysicalCalls: 200 });
    expect(status?.results[0]?.draft?.value).toBe('unknown');
    expect(status?.results[0]?.draft?.claims).toEqual([]);
    for (const [index, reason] of [
      'MISSING_EVIDENCE',
      'PARTIAL_EVIDENCE',
      'CONFLICTING_EVIDENCE',
      'UNSUPPORTED_CLAIM',
      'UNSUPPORTED_COMMITMENT',
      'LOW_CONFIDENCE',
      'INCOMPATIBLE_RESPONSE',
    ].entries()) {
      expect(status?.results[index]?.status).toBe('review_required');
      expect(status?.results[index]?.reasons).toContain(reason);
    }
    expect(status?.results[2]?.draft?.text).toBe('Production workforce MFA is required.');
  });

  it('rejects_invalid_attribution_and_sensitive_disclosure', async () => {
    const fixture = await draftingFixture(root, {
      disclosure: 'restricted',
      questions: [
        { text: 'Is workforce MFA required?' },
        { text: 'Is production MFA required?' },
        { text: 'Are production controls present?' },
      ],
    });
    const provider = controlledProvider(fixture, [
      {
        draft: d => ({
          ...d,
          citations: d.citations.map(c => ({ ...c, supportingExcerpt: 'Invented unsupported source excerpt' })),
        }),
      },
      {},
      {
        draft: d => ({
          ...d,
          citations: d.citations.map(c => ({
            ...c,
            documentId: 'foreign',
            locator: { ...c.locator, sourceId: 'foreign' },
          })),
        }),
      },
    ]);
    const { status } = await executeDraft(fixture, provider);
    expect(status?.results[0]?.reasons).toContain('INVALID_ATTRIBUTION');
    expect(status?.results[1]?.reasons).toContain('SENSITIVE_DISCLOSURE');
    expect(status?.results[2]?.reasons).toContain('INVALID_ATTRIBUTION');
    expect(status?.results.every(r => r.status === 'review_required')).toBe(true);
    expect(provider.calls.filter(c => c.phase === 'verification').map(c => c.questionId)).toEqual([
      fixture.questions[1]!.id,
    ]);
    expect(status?.run.state).toBe('awaiting_review');
  });

  it('flags_inconsistent_equivalent_answers_without_overwriting_them', async () => {
    const fixture = await draftingFixture(root, {
      questions: [
        { text: 'Is production MFA required currently?' },
        { text: 'Do current production workforce accounts require MFA?' },
        { text: 'Was production MFA required last year?' },
      ],
    });
    const provider = controlledProvider(fixture, [
      { value: 'yes', interpretation: { equivalenceKey: 'workforce-mfa', timeQualifier: 'current' } },
      { value: 'no', interpretation: { equivalenceKey: 'workforce-mfa', timeQualifier: 'current' } },
      { value: 'no', interpretation: { equivalenceKey: 'workforce-mfa', timeQualifier: 'last-year' } },
    ]);
    const { status } = await executeDraft(fixture, provider);
    expect(status?.results.map(r => r.draft?.value)).toEqual(['yes', 'no', 'no']);
    expect(status?.results[0]?.reasons).toContain('INCONSISTENT_ANSWERS');
    expect(status?.results[1]?.reasons).toContain('INCONSISTENT_ANSWERS');
    expect(status?.results[2]?.reasons).not.toContain('INCONSISTENT_ANSWERS');
    expect(status?.results[2]?.status).toBe('draft_eligible');
  });

  it('compares_material_facts_in_free_text_yes_and_partial_without_flagging_paraphrases_or_other_scope', async () => {
    const texts = [
      'Production logs are retained for ninety days.',
      'Production logs are retained for thirty days.',
      'The retention period for production logs is ninety days.',
      'Last year production logs were kept for thirty days.',
      'Staging logs are retained for thirty days.',
      'Yes, production logs are retained for ninety days.',
      'Yes, production logs are retained for thirty days.',
      'Partial: production logs are retained for ninety days for enterprise accounts.',
      'Partial: production logs are retained for thirty days for enterprise accounts.',
    ];
    const fixture = await draftingFixture(root, {
      text: `control ${texts.join(' ')}`,
      questions: texts.map((_, i) => ({
        text: `Describe ${i === 3 ? 'last year' : 'current'} ${i === 4 ? 'staging' : 'production'} log retention ${i + 1}.`,
        kind: i < 5 ? 'free_text' : 'boolean',
      })),
    });
    const plans: CasePlan[] = texts.map((text, i) => ({
      text,
      value: i < 5 ? 'free_text' : i < 7 ? 'yes' : 'partial',
      interpretation: {
        equivalenceKey: i < 5 ? 'log-retention' : i < 7 ? 'log-retention-yes' : 'log-retention-partial',
        timeQualifier: i === 3 ? 'last-year' : 'current',
        environment: i === 4 ? 'staging' : 'production',
      },
    }));
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [5, 6],
      [7, 8],
    ])
      (plans[a!]!.inconsistentWith ??= []).push(fixture.questions[b!]!.id);
    const provider = controlledProvider(fixture, plans);
    const { status } = await executeDraft(fixture, provider, { maxPhysicalCalls: 300 });
    expect(status?.results.map(r => r.draft?.text)).toEqual(texts);
    for (const i of [0, 1, 2, 5, 6, 7, 8]) {
      expect(status?.results[i]?.status).toBe('review_required');
      expect(status?.results[i]?.reasons).toContain('INCONSISTENT_ANSWERS');
    }
    for (const i of [3, 4]) expect(status?.results[i]?.reasons).not.toContain('INCONSISTENT_ANSWERS');
    const comparisons = provider.calls.filter(
      c => c.phase === 'verification' && c.questionId.startsWith('consistency-'),
    );
    expect(comparisons).toHaveLength(5);
    const comparedIds = comparisons.map(c =>
      JSON.parse(userText(c.call)).answers.map((a: { questionId: string }) => a.questionId),
    );
    expect(comparedIds).toContainEqual([fixture.questions[0]!.id, fixture.questions[2]!.id]);
    expect(comparedIds.flat()).not.toContain(fixture.questions[3]!.id);
    expect(comparedIds.flat()).not.toContain(fixture.questions[4]!.id);
    expect(status?.usage).toHaveLength(provider.calls.length);
    expect(status?.usage.filter(u => u.questionId.startsWith('consistency-'))).toHaveLength(15);
    const reopened = await openProcessingStore(fixture.url);
    try {
      expect((await reopened.status(fixture.runId))?.results).toEqual(status?.results);
    } finally {
      reopened.close();
    }

    // A separate benign pair remains eligible: wording differences alone never trigger escalation.
    const benignRoot = resolve(root, 'benign');
    await mkdir(benignRoot);
    const benign = await draftingFixture(benignRoot, {
      questions: [
        { text: 'Describe current production log retention.', kind: 'free_text' },
        { text: 'How long are current production logs kept?', kind: 'free_text' },
      ],
    });
    const benignProvider = controlledProvider(
      benign,
      [0, 2].map(i => ({ value: 'free_text', text: texts[i], interpretation: { equivalenceKey: 'log-retention' } })),
    );
    const benignStatus = (await executeDraft(benign, benignProvider)).status;
    expect(benignStatus?.results.every(r => r.status === 'draft_eligible' && r.reasons.length === 0)).toBe(true);
    expect(benignStatus?.results.map(r => r.draft?.text)).toEqual([texts[0], texts[2]]);
  });

  it('preserves_prior_drafts_and_unrelated_siblings_when_consistency_checks_fail', async () => {
    for (const mode of ['provider', 'security'] as const) {
      const dir = resolve(root, mode);
      await mkdir(dir);
      const fixture = await draftingFixture(dir, {
        questions: [
          { text: 'First equivalent production logs?', kind: 'free_text' },
          { text: 'Second equivalent production logs?', kind: 'free_text' },
          { text: 'Does workforce MFA apply?' },
        ],
      });
      const provider = controlledProvider(
        fixture,
        [
          { value: 'free_text', interpretation: { equivalenceKey: 'retention' } },
          { value: 'free_text', interpretation: { equivalenceKey: 'retention' } },
          { value: 'yes' },
        ],
        (phase, text) =>
          mode === 'security' && phase === 'injection' && text.includes('"answers":[')
            ? jsonStream({ categories: [{ type: 'injection', score: 1 }], reason: 'PROTECTED_COMPARISON_CANARY' })
            : undefined,
      );
      if (mode === 'provider') {
        const original = provider.factory;
        provider.factory = (phase, questionId) => {
          if (phase !== 'verification' || !questionId.startsWith('consistency-')) return original(phase, questionId);
          const doStream = async () => {
            throw Object.assign(new Error('PROTECTED_PROVIDER_COMPARISON_CANARY'), { statusCode: 503 });
          };
          return { doStream, doGenerate: doStream };
        };
      }
      const { status } = await executeDraft(fixture, provider);
      const reason = mode === 'provider' ? 'PROVIDER_FAILURE' : 'SECURITY_BLOCKED';
      for (const i of [0, 1]) {
        expect(status?.results[i]?.reasons).toContain(reason);
        expect(status?.results[i]?.draft?.text ?? null).toBe(
          mode === 'security' ? null : 'Production logs are retained for ninety days.',
        );
      }
      expect(status?.results[2]?.status).toBe('draft_eligible');
      expect(status?.results[2]?.draft?.text).toBe('Production workforce MFA is required.');
      expect(JSON.stringify(status)).not.toContain('PROTECTED_');
      expect(status?.usage.filter(u => !u.questionId.startsWith('consistency-'))).toHaveLength(30);
      const usage = status?.usage.filter(u => u.questionId.startsWith('consistency-')) ?? [];
      expect(usage).toHaveLength(mode === 'provider' ? 5 : mode === 'security' ? 1 : 2);
      if (mode === 'provider') expect(usage.filter(u => u.status === 'uncertain')).toHaveLength(3);
      const reopened = await openProcessingStore(fixture.url);
      try {
        expect((await reopened.status(fixture.runId))?.results).toEqual(status?.results);
      } finally {
        reopened.close();
      }
    }
  });

  it('preserves_successful_siblings_after_bounded_provider_failure', async () => {
    const fixture = await draftingFixture(root, {
      questions: [
        { text: 'First workforce control?' },
        { text: 'Second workforce control?' },
        { text: 'Third workforce control?' },
      ],
    });
    const provider = controlledProvider(fixture, [
      {},
      { failures: 3, missingUsage: true },
      { failures: 1, missingUsage: true },
    ]);
    const { result, status } = await executeDraft(fixture, provider, { concurrency: 1 });
    expect(result.status).toBe('success');
    expect(status?.results.map(r => r.status)).toEqual(['draft_eligible', 'review_required', 'draft_eligible']);
    expect(status?.results[1]?.reasons).toContain('PROVIDER_FAILURE');
    expect(provider.calls.filter(c => c.phase === 'draft' && c.questionId === fixture.questions[1]?.id)).toHaveLength(
      3,
    );
    expect(
      status?.usage
        .filter(u => u.questionId === fixture.questions[1]?.id && u.phase === 'draft')
        .every(u => u.status === 'uncertain' && u.estimatedUsd > 0),
    ).toBe(true);
    expect(
      status?.usage
        .filter(u => u.questionId === fixture.questions[2]?.id)
        .some(u => u.status === 'uncertain' && u.inputTokens === null && u.outputTokens === null && u.estimatedUsd > 0),
    ).toBe(true);
    expect(status?.usage.length).toBe(provider.calls.length);
    const store = await openProcessingStore(fixture.url);
    try {
      expect((await store.status(fixture.runId))?.results[0]).toEqual(status?.results[0]);
    } finally {
      store.close();
    }
  });

  it('stops_new_calls_when_global_authentication_fails', async () => {
    const fixture = await draftingFixture(root, {
      questions: [{ text: 'First control?' }, { text: 'Second control?' }],
    });
    const provider = controlledProvider(fixture, [{ failures: 3, status: 401 }]);
    const { status } = await executeDraft(fixture, provider, { concurrency: 1 });
    expect(status?.run.state).toBe('failed');
    expect(status?.run.stopReason).toBe('AUTHENTICATION_FAILURE');
    expect(status?.results).toHaveLength(2);
    expect(status?.results.every(r => r.status === 'review_required')).toBe(true);
    expect(provider.calls.filter(c => c.phase === 'draft')).toHaveLength(1);
    expect(status?.usage.length).toBe(provider.calls.length);
  });

  it('rejects_unavailable_model_without_silent_fallback', async () => {
    for (const code of [404, 400, 422]) {
      const dir = resolve(root, String(code));
      await (await import('node:fs/promises')).mkdir(dir);
      const fixture = await draftingFixture(dir, {
        questions: [{ text: 'First control?' }, { text: 'Second control?' }],
      });
      const provider = controlledProvider(fixture, [{ failures: 3, status: code }]);
      const { status } = await executeDraft(fixture, provider, { concurrency: 1 });
      expect(status?.run.stopReason).toBe('MODEL_UNAVAILABLE');
      expect(status?.results.every(r => r.reasons.includes('MODEL_UNAVAILABLE'))).toBe(true);
      expect(provider.calls.filter(c => c.phase === 'draft')).toHaveLength(1);
      expect(status?.run.policy.model).toBe('openai/gpt-6.1-sol');
    }
    expect(executionPolicySchema.safeParse({ ...defaultExecutionPolicy, model: 'unsupported/fallback' }).success).toBe(
      false,
    );
  });

  it('rejects_changed_sources_before_external_work_and_preserves_identity', async () => {
    const fixture = await draftingFixture(root),
      provider = controlledProvider(fixture);
    await writeFile(resolve(root, 'evidence', 'control.md'), 'Changed source bytes');
    const { status } = await executeDraft(fixture, provider);
    expect(provider.calls).toHaveLength(0);
    expect(status?.run.stopReason).toBe('SOURCE_UNAVAILABLE');
    expect(status?.results[0]?.reasons).toEqual(['SOURCE_UNAVAILABLE']);
    expect(status?.run.intakeDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(status?.run.policyDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects_concurrent_duplicate_start_without_disrupting_first_run', async () => {
    const fixture = await draftingFixture(root),
      provider = controlledProvider(fixture, [{ delayMs: 100 }]);
    const workflow = createDraftWorkflow({
      databaseUrl: fixture.url,
      runtimeRoot: resolve(root, 'runtime'),
      models: provider.factory,
    });
    const first = await workflow.createRun(),
      second = await workflow.createRun();
    const inputData = {
      runId: fixture.runId,
      evidenceRoot: resolve(root, 'evidence'),
      manifestPath: fixture.manifestPath,
      policy: defaultExecutionPolicy,
    };
    const pending = first.start({ inputData });
    const duplicate = await second.start({ inputData });
    const result = await pending;
    expect(duplicate.status).toBe('failed');
    expect(result.status).toBe('success');
    const store = await openProcessingStore(fixture.url);
    try {
      expect((await store.status(fixture.runId))?.results[0]?.status).toBe('draft_eligible');
    } finally {
      store.close();
    }
  });
});

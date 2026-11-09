import { expect, it, vi } from 'vitest';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { draftingFixture, controlledProvider, executeDraft, userText, jsonStream } from '../support/drafting.ts';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';
import { processQuestion } from '../../src/mastra/processing/answers.ts';
import { modelEvidenceExcerpt } from '../../src/mastra/evidence/context.ts';
import { modelEnvelope } from '../../src/mastra/processing/model.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { defaultExecutionPolicy } from '../../src/mastra/contracts/execution-policy.ts';
import { context } from '../fixtures/support.ts';
import { canonicalJson } from '../../src/mastra/intake/source.ts';

it('retrieves_two_source_bound_queries_deduplicates_and_screens_the_exact_complete_answer_input', async () => {
  const root = await temporaryDirectory();
  try {
    const f = await draftingFixture(root, {
      questions: [
        { text: 'Does production require MFA? Describe SSO availability.', instructions: 'Retain basic tier limit.' },
      ],
    });
    const q = f.questions[0]!;
    const provider = controlledProvider(f);
    const store = await openProcessingStore(f.url);
    try {
      await store.begin(f.runId, defaultExecutionPolicy);
      const queries: Array<[string, number | undefined]> = [];
      const evidence = {
        ...f.snapshot,
        search: async (query: string, topK?: number) => {
          queries.push([query, topK]);
          return f.snapshot.search(query, topK);
        },
      };
      const interpretation = {
        domain: 'access',
        query: 'Does production require MFA? ',
        subparts: ['Does production require MFA? ', 'Describe SSO availability.', 'Retain basic tier limit.'],
        equivalenceKey: '',
        product: 'tasks',
        environment: 'production',
        timeQualifier: 'unspecified',
      };
      const result = await processQuestion(
        q,
        {
          runId: f.runId,
          policy: defaultExecutionPolicy,
          store,
          models: provider.factory,
          evidence,
          evidenceRoot: resolve(root, 'evidence'),
          context: context(),
        },
        interpretation,
      );
      expect(result.status).toBe('draft_eligible');
      expect(queries).toEqual([
        [interpretation.query, 3],
        ['production require MFA SSO availability. Retain basic tier limit.', 3],
      ]);
      const drafts = provider.calls.filter(c => c.phase === 'draft');
      expect(drafts).toHaveLength(1);
      expect(drafts[0]!.call.tools ?? []).toHaveLength(0);
      const input = userText(drafts[0]!.call),
        payload = JSON.parse(input);
      expect(payload.question.text).toBe(q.originalText);
      expect(payload.question.instructions).toBe(q.instructions);
      expect(payload.interpretation).toEqual(interpretation);
      expect(new Set(payload.excerpts.map((e: { id: string }) => e.id)).size).toBe(payload.excerpts.length);
      for (const phase of ['injection', 'pii']) {
        const checks = provider.calls.filter(c => c.phase === phase && userText(c.call).includes('"excerpts"'));
        expect(checks).toHaveLength(1);
        expect(userText(checks[0]!.call)).toContain(input);
      }
      expect(provider.calls.every(c => modelEnvelope(c.call).inputBytes <= 32000)).toBe(true);
    } finally {
      store.close();
    }
  } finally {
    await cleanupDirectory(root);
  }
});

it.each(['repeated', 'distinct'] as const)(
  'bounds_%s_long_source_queries_without_stopping_native_fit_questions_or_healthy_siblings',
  async mode => {
    const root = await temporaryDirectory();
    try {
      const text =
        mode === 'repeated'
          ? `Describe ${'workforce MFA authentication administrative accounts require protection '.repeat(15)}`
          : `Describe workforce MFA ${Array.from({ length: 5 }, (_, i) => String.fromCharCode(98 + i).repeat(205)).join(' ')}`;
      const f = await draftingFixture(root, {
        questions: [{ text, kind: 'free_text' }, { text: 'Does workforce MFA authentication apply?' }],
        text: 'control Workforce MFA authentication administrative accounts require protection.',
      });
      expect(text.length).toBeGreaterThan(1000);
      const provider = controlledProvider(f);
      const { status } = await executeDraft(f, provider, { concurrency: 1 });
      expect(status!.run.stopReason).toBeNull();
      expect(status!.results.map(result => result.status)).toEqual(['draft_eligible', 'draft_eligible']);
      const draft = provider.calls.find(call => call.phase === 'draft' && call.questionId === f.questions[0]!.id)!;
      const input = userText(draft.call),
        payload = JSON.parse(input);
      expect(payload.question.text).toBe(text);
      expect(payload.required.subparts.join('')).toBe(text);
      expect(payload.interpretation.subparts).toEqual(payload.required.subparts);
      expect(payload.excerpts).toEqual(
        (await f.snapshot.search('workforce MFA authentication', 3)).map(hit => modelEvidenceExcerpt(hit.excerpt)),
      );
      for (const phase of ['injection', 'pii'])
        expect(provider.calls.some(call => call.phase === phase && userText(call.call).includes(input))).toBe(true);
      expect(provider.calls.every(call => modelEnvelope(call.call).inputBytes <= 32000)).toBe(true);
      // executeDraft closes the workflow runtime before this fresh operational connection opens.
      const store = await openProcessingStore(f.url);
      try {
        const persisted = await store.status(f.runId);
        expect(persisted!.results).toEqual(status!.results);
        expect(persisted!.usage).toHaveLength(provider.calls.length);
        expect(persisted!.usage.every(usage => usage.status === 'observed')).toBe(true);
        expect(await store.diagnostics(f.runId)).toEqual([]);
      } finally {
        store.close();
      }
    } finally {
      await cleanupDirectory(root);
    }
  },
);

it('blocks_the_same_native_injection_and_pii_canaries_alone_and_among_benign_contradictory_complete_source_relations', async () => {
  const root = await temporaryDirectory();
  try {
    for (const phase of ['injection', 'pii'] as const)
      for (const mixed of [false, true]) {
        const dir = resolve(root, `${phase}-${mixed}`);
        await mkdir(dir);
        const marker = phase === 'injection' ? 'UNTRUSTED_INSTRUCTION_OVERRIDE_REVIEW' : 'PROTECTED_PERSON_CANARY';
        const f = await draftingFixture(dir, {
          questions: [{ text: 'Does control MFA apply?' }],
          evidence: {
            format: 'json',
            bytes: JSON.stringify({
              scope: { environment: 'production', customQualifier: 'Workforce administrators only' },
              controls: {
                controlMfa: marker,
                ...(mixed ? { controlMfaRequired: 'yes', controlMfaException: 'no; contractor exception' } : {}),
              },
            }),
          },
        });
        const inputs: string[] = [];
        const provider = controlledProvider(f, [], (current, text) => {
          if (current !== phase || !text.includes(marker)) return undefined;
          inputs.push(text);
          return jsonStream(
            phase === 'injection'
              ? { categories: [{ type: 'injection', score: 1 }], reason: 'CONTROLLED_ATTACK' }
              : {
                  categories: [{ type: 'name', score: 1 }],
                  detections: [{ type: 'name', value: marker, confidence: 1, start: 0, end: 1 }],
                },
          );
        });
        const { status } = await executeDraft(f, provider);
        expect(status!.results[0]).toMatchObject({
          draft: null,
          status: 'security_review_required',
          reasons: ['SECURITY_BLOCKED'],
        });
        expect(inputs).toHaveLength(1);
        const projected = (await f.snapshot.search(f.questions[0]!.originalText, 3)).map(h =>
          modelEvidenceExcerpt(h.excerpt),
        );
        for (const e of projected) expect(inputs[0]).toContain(canonicalJson(e));
        expect(inputs[0]).toContain('Workforce administrators only');
        if (mixed) {
          expect(inputs[0]).toContain('yes');
          expect(inputs[0]).toContain('no; contractor exception');
        }
        expect(provider.calls.some(c => c.phase === 'draft' || c.phase === 'verification')).toBe(false);
        expect(status!.security.some(s => s.boundary === 'tool_result' && s.status === 'blocked')).toBe(true);
      }
  } finally {
    vi.restoreAllMocks();
    await cleanupDirectory(root);
  }
});

it('preserves_access_business_status_and_literal_security_obligations_in_source_bound_queries', async () => {
  const root = await temporaryDirectory();
  try {
    const text = 'What is the access business status? Describe security policy and operational evidence.';
    const f = await draftingFixture(root, { questions: [{ text }] });
    const provider = controlledProvider(f),
      store = await openProcessingStore(f.url);
    try {
      await store.begin(f.runId, defaultExecutionPolicy);
      const queries: string[] = [];
      const result = await processQuestion(
        f.questions[0]!,
        {
          runId: f.runId,
          policy: defaultExecutionPolicy,
          store,
          models: provider.factory,
          evidence: {
            ...f.snapshot,
            search: async query => {
              queries.push(query);
              return [];
            },
          },
          evidenceRoot: resolve(root, 'evidence'),
          context: context(),
        },
        {
          domain: 'access',
          query: text,
          subparts: [text],
          equivalenceKey: '',
          product: 'tasks',
          environment: 'production',
          timeQualifier: 'unspecified',
        },
      );
      expect(queries[0]).toBe(text);
      expect(queries[1]).toMatch(/\baccess business status\b/);
      for (const obligation of ['security', 'policy', 'operational', 'evidence'])
        expect(queries[0]).toContain(obligation);
      expect(result.interpretation!.subparts).toEqual([text]);
      expect(result.draft!.value).toBe('unknown');
      expect(provider.calls.some(c => c.phase === 'draft')).toBe(false);
    } finally {
      store.close();
    }
  } finally {
    await cleanupDirectory(root);
  }
});

it('fails_closed_on_complete_context_detector_failure_and_cancellation_before_any_answer_transfer', async () => {
  const root = await temporaryDirectory();
  try {
    for (const phase of ['injection', 'pii'] as const)
      for (const failure of ['throw', 'cancel'] as const) {
        const dir = resolve(root, `${phase}-${failure}`);
        await mkdir(dir);
        const f = await draftingFixture(dir);
        let cancelled = false;
        const provider = controlledProvider(f, [], (current, text, call) => {
          if (current !== phase || !text.includes('"excerpts":[')) return undefined;
          if (failure === 'throw') throw Object.assign(new Error('PRIVATE_DETECTOR_FAILURE'), { statusCode: 503 });
          call.abortSignal?.addEventListener(
            'abort',
            () => {
              cancelled = true;
            },
            { once: true },
          );
          return { stream: new ReadableStream() };
        });
        const { status } = await executeDraft(f, provider, { callTimeoutMs: 30 });
        expect(status!.results[0]).toMatchObject({
          draft: null,
          status: 'security_review_required',
          reasons: ['DETECTOR_FAILED'],
        });
        expect(provider.calls.some(c => c.phase === 'draft' || c.phase === 'verification')).toBe(false);
        expect(status!.security.some(s => s.boundary === 'tool_result' && s.status === 'failed')).toBe(true);
        expect(status!.usage.length).toBe(provider.calls.length);
        if (failure === 'cancel') expect(cancelled).toBe(true);
      }
  } finally {
    await cleanupDirectory(root);
  }
});

it('fails_explicitly_on_a_complete_context_overflow_without_dropping_selected_evidence_or_transferring_it', async () => {
  const root = await temporaryDirectory();
  try {
    const paragraphs = Array.from(
      { length: 3 },
      (_, i) => `control MFA record ${String.fromCharCode(65 + i)} ${'Complete original qualification '.repeat(95)}`,
    );
    const f = await draftingFixture(root, {
      questions: [{ text: 'Does control MFA apply?' }],
      text: paragraphs.join('\n\n'),
    });
    expect(await f.snapshot.search(f.questions[0]!.originalText, 3)).toHaveLength(3);
    const provider = controlledProvider(f);
    const { status } = await executeDraft(f, provider, { maxInputTokens: 2000 });
    expect(status!.run.stopReason).toBeNull();
    expect(status!.results[0]).toMatchObject({ draft: null, reasons: ['DETECTOR_FAILED'] });
    expect(
      provider.calls.some(
        c =>
          c.phase === 'draft' ||
          c.phase === 'verification' ||
          userText(c.call).includes('Complete original qualification'),
      ),
    ).toBe(false);
    const store = await openProcessingStore(f.url);
    try {
      expect(
        (await store.diagnostics(f.runId)).some(
          d => d.category === 'INPUT_ENVELOPE' && d.boundary === 'tool_result' && d.inputBytes! > 8000,
        ),
      ).toBe(true);
    } finally {
      store.close();
    }
  } finally {
    await cleanupDirectory(root);
  }
});

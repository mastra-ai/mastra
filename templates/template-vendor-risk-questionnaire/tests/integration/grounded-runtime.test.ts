import { demoDomains, questionnaireRows } from '../fixtures/corpus.ts';
import { z } from 'zod';
import { it, expect, vi } from 'vitest';
import type { AgentExecutionOptionsBase } from '@mastra/core/agent';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  nativeWireChoices,
  draftingFixture,
  draftFor,
  controlledProvider,
  executeDraft,
  stream,
  userText,
  jsonStream,
} from '../support/drafting.ts';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';
import { modelEnvelope } from '../../src/mastra/processing/model.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { evidenceAnswerAgent } from '../../src/mastra/agents/evidence-answer.ts';
import { readDomainMetrics } from '../../src/mastra/observability/metrics.ts';
import { processingDiagnosticSchema } from '../../src/mastra/contracts/processing-diagnostic.ts';

it('persists_only_safe_draft_callback_invariant_classes_with_observed_usage_and_no_downstream_factual_answer', async () => {
  const root = await temporaryDirectory();
  const canary = 'PRIVATE_DRAFT_INVARIANT_CANARY';
  try {
    for (const mode of [
      'factual',
      'unknown',
      'claims',
      'citations',
      'coverage',
      'reference',
      'unknown-text',
      'unknown-claims',
      'unknown-citations',
      'unknown-option',
      'factual-text',
      'factual-claims',
      'combined',
    ] as const) {
      const dir = resolve(root, mode);
      await mkdir(dir);
      const f = await draftingFixture(dir);
      const valid = mode === 'factual' || mode === 'unknown';
      const provider = controlledProvider(f, [
        {
          value: mode.startsWith('unknown') ? 'unknown' : 'yes',
          draft: draft => {
            const d = structuredClone(draft);
            if (mode === 'claims') d.claims.push({ ...d.claims[0]!, text: canary });
            if (mode === 'citations') d.citations.push(d.citations[0]!);
            if (mode === 'coverage') d.coveredSubparts.push(d.coveredSubparts[0]!);
            if (mode === 'reference') d.claims[0]!.citationIds = [canary];
            if (mode === 'unknown-text') d.text = canary;
            if (mode === 'unknown-claims' || mode === 'unknown-citations') {
              const factual = draftFor(f.questions[0]!, f.snapshot.record.excerpts[0]!, 'yes', canary);
              d.citations = factual.citations;
              if (mode === 'unknown-claims') d.claims = factual.claims;
            }
            if (mode === 'unknown-option') d.responseOption = canary;
            if (mode === 'factual-text') d.text = '';
            if (mode === 'factual-claims') d.claims = [];
            if (mode === 'combined') {
              d.coveredSubparts.push(d.coveredSubparts[0]!);
              d.claims[0]!.citationIds = [canary];
              d.value = 'unknown';
            }
            return d;
          },
        },
      ]);
      await executeDraft(f, provider);
      const store = await openProcessingStore(f.url);
      const status = (await store.status(f.runId))!,
        diagnostics = await store.diagnostics(f.runId);
      await store.close();
      const callback = diagnostics.filter(d => d.category === 'CALLBACK_SCHEMA');
      expect(callback).toHaveLength(valid ? 0 : 1);
      expect(status.run.stopReason).toBeNull();
      expect(status.usage.every(u => u.status === 'observed')).toBe(true);
      expect(status.usage.filter(u => u.reason === 'INVALID_MODEL_OUTPUT')).toHaveLength(valid ? 0 : 1);
      expect(provider.calls.filter(c => c.phase === 'verification')).toHaveLength(mode === 'factual' ? 1 : 0);
      expect(Math.max(...provider.calls.map(c => modelEnvelope(c.call).inputBytes))).toBeLessThanOrEqual(32000);
      if (!valid) {
        expect(status.results[0]).toMatchObject({
          draft: null,
          status: 'review_required',
          reasons: ['INVALID_MODEL_OUTPUT'],
        });
        const invariants =
          mode === 'combined'
            ? ['DRAFT_UNIQUENESS', 'DRAFT_CITATION_REFERENCE', 'DRAFT_ASSERTION']
            : [
                mode === 'reference'
                  ? 'DRAFT_CITATION_REFERENCE'
                  : ['claims', 'citations', 'coverage'].includes(mode)
                    ? 'DRAFT_UNIQUENESS'
                    : 'DRAFT_ASSERTION',
              ];
        expect(callback[0]).toMatchObject({
          phase: 'draft',
          origin: 'origin',
          schemaInvariants: invariants,
          schemaIssueCount: invariants.length,
        });
        expect(JSON.stringify({ diagnostics, status })).not.toContain(canary);
        for (const unsafe of [
          { schemaInvariants: [canary] },
          { schemaIssueCount: Infinity },
          { schemaIssueCount: 0 },
          { category: 'RESPONSE_SCHEMA' },
          { schemaInvariants: undefined },
          { schemaInvariants: ['DRAFT_ASSERTION', 'DRAFT_ASSERTION'] },
        ])
          expect(processingDiagnosticSchema.safeParse({ ...callback[0], ...unsafe }).success).toBe(false);
      } else expect(status.results[0]?.draft?.value).toBe(mode === 'factual' ? 'yes' : 'unknown');
    }
  } finally {
    await cleanupDirectory(root);
  }
}, 60000);

it('rejects_decoding_schema_question_membership_and_grounding_before_downstream_with_observed_usage_after_reopen', async () => {
  const root = await temporaryDirectory();
  try {
    for (const mode of [
      'json',
      'response',
      'batch-duplicate',
      'batch-reordered',
      'foreign-reference',
      'callback',
    ] as const) {
      const dir = resolve(root, mode);
      await mkdir(dir);
      const multi = mode.startsWith('batch') || mode === 'foreign-reference';
      const f = await draftingFixture(dir, {
        questions: [{ text: 'Does MFA apply?' }, ...(multi ? [{ text: 'Does MFA apply to administrators?' }] : [])],
      });
      const provider = controlledProvider(
        f,
        mode === 'callback' ? [{ verification: { conflictedClaimIds: ['claim'] } }] : [],
      );
      const base = provider.factory;
      provider.factory = (phase, id) => {
        const model = base(phase, id);
        const call: typeof model.doStream = async options => {
          const response = await model.doStream(options);
          if (phase !== 'interpretation' || mode === 'callback') return response;
          if (mode === 'json') return jsonStream('{"PRIVATE_JSON_DIAGNOSTIC_CANARY":');
          let text = '';
          for await (const part of response.stream) if (part.type === 'text-delta') text += part.delta;
          const value = JSON.parse(text);
          const keys = Object.keys(value.interpretations);
          if (mode === 'response')
            value.interpretations[keys[0]!].query = { private: 'PRIVATE_SCHEMA_DIAGNOSTIC_CANARY' };
          if (mode === 'batch-duplicate') {
            delete value.interpretations[keys[1]!];
            value.interpretations.foreign = value.interpretations[keys[0]!];
          }
          if (mode === 'batch-reordered') delete value.interpretations[keys[0]!];
          if (mode === 'foreign-reference')
            value.interpretations[keys[0]!].requests = value.interpretations[keys[1]!].requests;
          return jsonStream(value);
        };
        return { doStream: call, doGenerate: call };
      };
      await executeDraft(f, provider);
      const store = await openProcessingStore(f.url);
      const status = await store.status(f.runId),
        diagnostics = await store.diagnostics(f.runId);
      store.close();
      const category =
        mode === 'json'
          ? 'JSON_DECODE'
          : mode === 'response'
            ? 'RESPONSE_SCHEMA'
            : mode === 'callback'
              ? 'CALLBACK_SCHEMA'
              : 'RESPONSE_SCHEMA';
      expect(diagnostics.filter(d => d.category === category)).toHaveLength(1);
      expect(diagnostics.find(d => d.category === category)).toMatchObject({
        phase: mode === 'callback' ? 'verification' : 'interpretation',
        origin: 'origin',
        reason: 'INVALID_MODEL_OUTPUT',
        turn: 1,
      });
      expect(status!.results.every(r => r.draft === null && r.reasons.includes('INVALID_MODEL_OUTPUT'))).toBe(true);
      expect(status!.run.stopReason).toBeNull();
      expect(status!.usage).toHaveLength(provider.calls.length);
      expect(status!.usage.every(u => u.status === 'observed')).toBe(true);
      expect(status!.usage.filter(u => u.reason === 'INVALID_MODEL_OUTPUT')).toHaveLength(1);
      if (mode !== 'callback')
        expect(provider.calls.filter(c => c.phase === 'draft' || c.phase === 'verification')).toHaveLength(0);
      else expect(provider.calls.at(-1)!.phase).toBe('verification');
      const metrics = await readDomainMetrics(f.url, f.runId);
      expect(metrics.failures.calls).toBe(1);
      expect(Object.values(metrics.gapsByDomain).reduce((sum, b) => sum + b.error, 0)).toBe(f.questions.length);
      expect(JSON.stringify({ diagnostics, metrics, status })).not.toContain('PRIVATE_');
    }
  } finally {
    await cleanupDirectory(root);
  }
}, 60000);

it('grounds_scoped_source_references_with_complete_multipart_unicode_repeated_and_long_wording', async () => {
  const root = await temporaryDirectory();
  try {
    const single = 'Is MFA required for workforce administrative accounts?';
    const multipart = 'Is MFA required? Describe exceptions for café administrators 🔐.';
    const duplicate = 'Is MFA required? Is MFA required? ';
    let previousRef = '';
    for (const mode of [
      'single',
      'multipart',
      'partial',
      'unknown',
      'omitted',
      'duplicate',
      'duplicated-ref',
      'reordered',
      'wrong-field',
      'stale',
      'long',
      'instructions',
    ] as const) {
      const dir = resolve(root, mode);
      await mkdir(dir);
      const text =
        mode === 'single'
          ? single
          : mode === 'duplicate'
            ? duplicate
            : mode === 'long'
              ? `Describe ${'workforce MFA authentication administrative accounts require protection '.repeat(15)}`
              : multipart;
      const instructions = mode === 'instructions' ? 'Only production.\nPreserve Québec  \tapproval?' : undefined;
      const f = await draftingFixture(dir, {
        questions: [{ text, instructions, ...(mode === 'long' ? { kind: 'free_text' } : {}) }],
        ...(mode === 'long'
          ? { text: 'control Workforce MFA authentication administrative accounts require protection.' }
          : {}),
      });
      const provider = controlledProvider(f, [
        {
          requests: spans => {
            const refs = spans.map(({ field, ref }) => ({ field, ref }));
            if (mode === 'single') previousRef = refs[0]!.ref;
            if (mode === 'unknown') refs[0]!.ref = '0'.repeat(24);
            if (mode === 'stale') refs[0]!.ref = previousRef;
            if (mode === 'omitted') refs.pop();
            if (mode === 'duplicated-ref') refs[1] = refs[0]!;
            if (mode === 'reordered') refs.reverse();
            if (mode === 'wrong-field') refs[0]!.field = 'instructions';
            return refs;
          },
          ...(mode === 'partial' ? { draft: d => ({ ...d, coveredSubparts: [d.coveredSubparts[0]!] }) } : {}),
        },
      ]);
      const { status } = await executeDraft(f, provider);
      expect(f.questions[0]!.originalText).toBe(text);
      const request = JSON.parse(userText(provider.calls.find(c => c.phase === 'interpretation')!.call)).questions[0];
      expect(request.text).toBeUndefined();
      expect(request.instructions).toBeUndefined();
      for (const field of ['text', 'instructions'])
        expect(
          request.spans
            .filter((s: { field: string }) => s.field === field)
            .map((s: { text: string }) => s.text)
            .join(''),
        ).toBe(field === 'text' ? text : (instructions ?? ''));
      expect(new Set(request.spans.map((s: { ref: string }) => s.ref)).size).toBe(request.spans.length);
      expect(
        request.spans.every((s: { text: string }) => s.text.length <= 500 && !/[\uD800-\uDBFF]$/u.test(s.text)),
      ).toBe(true);
      for (const c of provider.calls) expect(modelEnvelope(c.call).inputBytes).toBeLessThanOrEqual(32000);
      if (['unknown', 'stale', 'omitted', 'duplicated-ref', 'wrong-field'].includes(mode)) {
        expect(status!.results[0]!.reasons).toContain('INVALID_MODEL_OUTPUT');
        expect(status!.results[0]!.draft).toBeNull();
        expect(provider.calls.some(c => c.phase === 'draft')).toBe(false);
        const store = await openProcessingStore(f.url);
        const diagnostics = await store.diagnostics(f.runId);
        store.close();
        expect(diagnostics.some(d => d.category === 'RESPONSE_SCHEMA')).toBe(true);
      } else {
        expect(status!.results[0]!.interpretation!.subparts).toEqual([
          ...new Set(request.spans.map((s: { text: string }) => s.text)),
        ]);
        expect(status!.results[0]!.status).toBe(mode === 'partial' ? 'review_required' : 'draft_eligible');
        if (mode === 'partial') expect(status!.results[0]!.reasons).toContain('PARTIAL_EVIDENCE');
      }
    }
  } finally {
    await cleanupDirectory(root);
  }
}, 60000);

it('fits_complete_native_multi_excerpt_envelopes_in_one_tool_free_structured_turn', async () => {
  const root = await temporaryDirectory();
  try {
    const paragraph = `control Production workforce MFA is required. ${'Approved access review records describe workforce administration. '.repeat(20)}`;
    const f = await draftingFixture(root, { text: `${paragraph}\n\n${paragraph}Second complete record.` });
    const provider = controlledProvider(f);
    const { status } = await executeDraft(f, provider);
    const store = await openProcessingStore(f.url);
    const diagnostics = await store.diagnostics(f.runId);
    store.close();
    expect(status!.run.stopReason, JSON.stringify(diagnostics)).toBeNull();
    expect(status!.results[0]!.status).toBe('draft_eligible');
    const calls = provider.calls.filter(c => c.phase === 'draft');
    expect(calls).toHaveLength(1);
    expect(calls.at(-1)!.call.toolChoice).toMatchObject({ type: 'none' });
    expect(calls.at(-1)!.call.tools ?? []).toHaveLength(0);
    for (const c of provider.calls) expect(modelEnvelope(c.call).inputBytes).toBeLessThanOrEqual(32000);
    const final = JSON.parse(userText(calls.at(-1)!.call));
    expect(final.excerpts).toHaveLength(2);
    expect(
      provider.calls
        .filter(c => c.phase === 'injection')
        .some(c => final.excerpts.every((e: { text: string }) => userText(c.call).includes(e.text))),
    ).toBe(true);
    for (const excerpt of f.snapshot.record.excerpts.filter(e => e.text.includes('control'))) {
      expect(final.excerpts.find((e: { id: string }) => e.id === excerpt.id).text).toBe(excerpt.text);
      expect(
        provider.calls.filter(c => c.phase === 'injection').some(c => userText(c.call).includes(excerpt.text)),
      ).toBe(true);
      expect(provider.calls.filter(c => c.phase === 'pii').some(c => userText(c.call).includes(excerpt.text))).toBe(
        true,
      );
    }
    const citation = status!.results[0]!.draft!.citations[0]!;
    expect(citation.sourceSha256).toBe(f.snapshot.record.documents[0]!.sha256);
    expect(citation.locator).toEqual(f.snapshot.record.excerpts.find(e => e.text.includes('control'))!.locator);
    expect(diagnostics).toEqual([]);
  } finally {
    await cleanupDirectory(root);
  }
}, 60000);

it('rejects_unexpected_tool_calls_and_records_safe_origin_and_sibling_diagnostics_after_reopen', async () => {
  const root = await temporaryDirectory();
  try {
    for (const mode of ['tool-only', 'native-option-override'] as const) {
      const dir = resolve(root, mode);
      await mkdir(dir);
      const f = await draftingFixture(dir, {
        questions: [{ text: 'Does MFA apply?' }, { text: 'Does MFA apply to administrators?' }],
      });
      const provider = controlledProvider(f);
      {
        const base = provider.factory;
        provider.factory = (phase, id) => {
          const model = base(phase, id);
          const call: typeof model.doStream = async options => {
            if (phase !== 'draft') return model.doStream(options);
            await model.doStream(options);
            return stream([
              {
                type: 'tool-call',
                toolCallId: 'PRIVATE_TOOL_CANARY',
                toolName: 'evidence_search',
                input: '{"query":"control","topK":1}',
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
              },
            ]);
          };
          return { doStream: call, doGenerate: call };
        };
      }
      const generate = evidenceAnswerAgent.generate.bind(evidenceAnswerAgent);
      // The wrapper rejects unexpected tool calls even if public native options permit tool choice.
      const nativeFault =
        mode === 'native-option-override'
          ? vi
              .spyOn(evidenceAnswerAgent, 'generate')
              .mockImplementation(
                (messages: Parameters<typeof generate>[0], options?: AgentExecutionOptionsBase<unknown>) =>
                  generate(messages, { ...options, toolChoice: 'auto', prepareStep: undefined }),
              )
          : undefined;
      let status;
      try {
        ({ status } = await executeDraft(f, provider));
      } finally {
        nativeFault?.mockRestore();
      }
      const store = await openProcessingStore(f.url);
      const diagnostics = await store.diagnostics(f.runId);
      store.close();
      {
        expect(status!.results.every(r => r.draft === null && r.reasons.includes('INVALID_MODEL_OUTPUT'))).toBe(true);
        expect(diagnostics.filter(d => d.category === 'FINAL_TOOL_CALL')).toHaveLength(2);
        expect(
          status!.usage
            .filter(u => u.phase === 'draft')
            .every(u => u.status === 'uncertain' && u.reason === 'INVALID_MODEL_OUTPUT'),
        ).toBe(true);
        expect(provider.calls.filter(c => c.phase === 'verification')).toHaveLength(0);
        expect(provider.calls.filter(c => c.phase === 'draft')).toHaveLength(2);
      }
      expect(JSON.stringify(diagnostics)).not.toContain('PRIVATE_');
      expect(diagnostics.every(d => /^[a-f0-9]{24}$/.test(d.questionId))).toBe(true);
    }
  } finally {
    await cleanupDirectory(root);
  }
}, 60000);

it('native_strict_wire_rejects_invalid_scalar_and_reference_controls_with_observed_accounting_and_no_downstream', async () => {
  const root = await temporaryDirectory();
  try {
    for (const mode of [
      'valid',
      'empty-query',
      'whitespace-domain',
      'empty-product',
      'oversized-domain',
      'empty-batch',
      'foreign-question',
      'foreign-equivalence',
      'foreign-query',
      'duplicate-json-key',
      'escaped-duplicate-json-key',
    ] as const) {
      const dir = resolve(root, mode);
      await mkdir(dir);
      const f = await draftingFixture(dir);
      const provider = controlledProvider(f);
      const base = provider.factory;
      let wire: unknown, nativeSchema: unknown;
      provider.factory = (phase, id) => {
        const model = base(phase, id);
        const call: typeof model.doStream = async options => {
          const response = await model.doStream(options);
          if (phase !== 'interpretation') return response;
          nativeSchema = options.responseFormat?.type === 'json' ? options.responseFormat.schema : undefined;
          let text = '';
          for await (const part of response.stream) if (part.type === 'text-delta') text += part.delta;
          const result = JSON.parse(text),
            key = Object.keys(result.interpretations)[0]!,
            item = result.interpretations[key];
          if (mode === 'empty-query') item.query = '';
          if (mode === 'whitespace-domain') item.domain = ' ';
          if (mode === 'empty-product') item.product = '';
          if (mode === 'oversized-domain') item.domain = 'A'.repeat(161);
          if (mode === 'empty-batch') result.interpretations = {};
          if (mode === 'foreign-question') {
            result.interpretations.PRIVATE_WIRE_CANARY = item;
            delete result.interpretations[key];
          }
          if (mode === 'foreign-equivalence') item.equivalenceKey = 'PRIVATE_WIRE_CANARY';
          if (mode === 'foreign-query') item.query = 'PRIVATE_WIRE_CANARY';
          wire = result;
          if (mode === 'duplicate-json-key' || mode === 'escaped-duplicate-json-key') {
            const repeated =
              mode === 'escaped-duplicate-json-key'
                ? JSON.stringify(key).replace(key[0]!, `\\u${key.charCodeAt(0).toString(16).padStart(4, '0')}`)
                : JSON.stringify(key);
            return jsonStream(
              `{"interpretations":{${JSON.stringify(key)}:${JSON.stringify(item)},${repeated}:${JSON.stringify(item)}}}`,
            );
          }
          return jsonStream(result);
        };
        return { doStream: call, doGenerate: call };
      };
      await executeDraft(f, provider);
      // This is the actual installed Agent.generate responseFormat AFTER OpenAI strict preparation.
      const converted = z.fromJSONSchema(nativeSchema as Parameters<typeof z.fromJSONSchema>[0]);
      expect(converted.safeParse(wire).success).toBe(mode === 'valid' || mode.endsWith('duplicate-json-key'));
      const store = await openProcessingStore(f.url);
      const status = (await store.status(f.runId))!,
        diagnostics = await store.diagnostics(f.runId);
      store.close();
      expect(status.usage).toHaveLength(provider.calls.length);
      expect(status.usage.every(u => u.status === 'observed')).toBe(true);
      for (const c of provider.calls) expect(modelEnvelope(c.call).inputBytes).toBeLessThanOrEqual(32000);
      if (mode === 'valid') {
        expect(status.results[0]!.status).toBe('draft_eligible');
        expect(provider.calls.some(c => c.phase === 'draft')).toBe(true);
        expect(provider.calls.some(c => c.phase === 'verification')).toBe(true);
      } else {
        expect(status.results[0]!.draft).toBeNull();
        expect(status.results[0]!.reasons).toContain('INVALID_MODEL_OUTPUT');
        expect(provider.calls.some(c => c.phase === 'draft' || c.phase === 'verification')).toBe(false);
        expect(
          diagnostics.filter(
            d => d.category === (mode.endsWith('duplicate-json-key') ? 'JSON_DECODE' : 'RESPONSE_SCHEMA'),
          ),
        ).toHaveLength(1);
        const metrics = await readDomainMetrics(f.url, f.runId);
        expect(metrics.failures.calls).toBe(1);
        expect(Object.values(metrics.gapsByDomain).reduce((n, row) => n + row.error, 0)).toBe(1);
      }
      expect(JSON.stringify({ diagnostics, status })).not.toContain('PRIVATE_WIRE_CANARY');
    }
  } finally {
    await cleanupDirectory(root);
  }
}, 60000);

it('preserves_cross_batch_paraphrase_equivalence_and_distinct_source_qualified_product_environment_and_time', async () => {
  const root = await temporaryDirectory();
  try {
    const questions = [
      { text: 'Is MFA required?', instructions: 'Product tasks, current production.' },
      { text: 'Must workforce accounts use MFA?', instructions: 'Current production, product tasks.' },
      { text: 'Is MFA required?', instructions: 'Product tasks, production, last year.' },
      { text: 'Is MFA required?', instructions: 'Product tasks, current staging.' },
      { text: 'Is MFA required?', instructions: 'Product payroll, current production.' },
      { text: 'Is MFA required?', instructions: 'The product is ambiguous; retain this qualifier.' },
    ];
    const f = await draftingFixture(root, { questions });
    const provider = controlledProvider(
      f,
      questions.map((_, i) => ({
        value: i < 2 ? 'yes' : 'no',
        interpretation: {
          equivalenceKey: 'same-obligation',
          timeQualifier: i === 2 ? 'last-year' : i === 5 ? 'unspecified' : 'current',
          environment: i === 3 ? 'staging' : 'production',
          product: i === 4 ? 'payroll' : 'tasks',
        },
      })),
    );
    const base = provider.factory;
    provider.factory = (phase, id) => {
      const model = base(phase, id);
      const call: typeof model.doStream = async options => {
        const response = await model.doStream(options);
        if (phase !== 'interpretation') return response;
        const request = JSON.parse(userText(options));
        let text = '';
        for await (const part of response.stream) if (part.type === 'text-delta') text += part.delta;
        const result = JSON.parse(text),
          ambiguous = request.questions.find((q: { id: string }) => q.id === f.questions[5]!.id);
        if (ambiguous)
          result.interpretations[ambiguous.id].product = nativeWireChoices(options, ambiguous.id, 'product').find(v =>
            v.startsWith('unresolved-'),
          );
        return jsonStream(result);
      };
      return { doStream: call, doGenerate: call };
    };
    const { status } = await executeDraft(f, provider, { maxPhysicalCalls: 500 });
    const reopened = await openProcessingStore(f.url),
      persisted = (await reopened.status(f.runId))!;
    reopened.close();
    expect(persisted.results).toEqual(status!.results);
    expect(persisted.results.map(r => ({ present: r.interpretation !== null, reasons: r.reasons }))).toEqual([
      { present: true, reasons: [] },
      { present: true, reasons: [] },
      { present: true, reasons: [] },
      { present: true, reasons: ['AMBIGUOUS_APPLICABILITY'] },
      { present: true, reasons: ['AMBIGUOUS_APPLICABILITY'] },
      { present: true, reasons: ['AMBIGUOUS_APPLICABILITY'] },
    ]);
    expect(provider.calls.filter(c => c.phase === 'interpretation')).toHaveLength(3);
    expect(persisted.results.map(r => r.interpretation!.equivalenceKey)).toEqual(
      Array(6).fill(persisted.results[0]!.interpretation!.equivalenceKey),
    );
    expect(persisted.results[0]!.interpretation!.equivalenceKey).not.toBe('');
    expect(persisted.results.map(r => r.interpretation!.timeQualifier)).toEqual([
      'current',
      'current',
      'last-year',
      'current',
      'current',
      'unspecified',
    ]);
    expect(persisted.results[3]!.interpretation!.environment).toBe('staging');
    expect(persisted.results[4]!.interpretation!.product).toBe('payroll');
    expect(persisted.results[5]!.interpretation!.product).toMatch(/^unresolved-/);
    for (const [i, question] of questions.entries()) {
      expect(persisted.results[i]!.interpretation!.subparts.join('')).toBe(question.text + question.instructions);
      expect(persisted.results[i]!.reasons).not.toContain('INCONSISTENT_ANSWERS');
    }
    expect(persisted.results.slice(0, 3).every(r => r.status === 'draft_eligible')).toBe(true);
    for (const i of [3, 4, 5]) expect(persisted.results[i]!.reasons).toContain('AMBIGUOUS_APPLICABILITY');
    const comparisons = provider.calls.filter(
      c => c.phase === 'verification' && c.questionId.startsWith('consistency-'),
    );
    expect(comparisons).toHaveLength(1);
    expect(JSON.parse(userText(comparisons[0]!.call)).answers.map((a: { questionId: string }) => a.questionId)).toEqual(
      f.questions.slice(0, 2).map(q => q.id),
    );
    expect(persisted.usage.every(u => u.status === 'observed')).toBe(true);
    for (const c of provider.calls) expect(modelEnvelope(c.call).inputBytes).toBeLessThanOrEqual(32000);
  } finally {
    await cleanupDirectory(root);
  }
}, 60000);

it('preserves_full_24_question_demo_catalogue_in_native_envelopes_with_complete_shared_instructions_and_safe_references', async () => {
  const root = await temporaryDirectory();
  try {
    const rows = questionnaireRows().slice(1);
    const f = await draftingFixture(root, {
      domains: demoDomains,
      questions: rows.map(row => ({
        id: row[0]!,
        text: row[1]!,
        kind: row[2]!,
        choices: row[3]!,
        instructions: row[5]!,
      })),
    });
    const malicious = rows.at(-1)![1]!;
    const provider = controlledProvider(f, [], (phase, text) =>
      phase === 'injection' && text.includes(malicious)
        ? jsonStream({ categories: [{ type: 'injection', score: 1 }], reason: 'QUESTION_INJECTION_DETECTED' })
        : undefined,
    );
    const { status } = await executeDraft(f, provider, { maxPhysicalCalls: 600 });
    const diagnosticsStore = await openProcessingStore(f.url);
    const envelopeDiagnostics = await diagnosticsStore.diagnostics(f.runId);
    diagnosticsStore.close();
    expect(status!.run.stopReason, JSON.stringify(envelopeDiagnostics)).toBeNull();
    expect(status!.results.at(-1)!.status).toBe('security_review_required');
    expect(status!.results.slice(0, -1).every(r => r.interpretation !== null && r.draft !== null)).toBe(true);
    const calls = provider.calls.filter(c => c.phase === 'interpretation');
    expect(calls.length).toBeGreaterThanOrEqual(12);
    expect(calls.length).toBeLessThanOrEqual(23);
    for (const c of calls) {
      const payload = JSON.parse(userText(c.call));
      const complete = new Map<string, { text: string; instructions: string }>();
      for (const [ref, item] of Object.entries(payload.equivalences) as Array<
        [string, [string, number | null] | null]
      >) {
        expect(ref).toMatch(/^[a-p]{24}$/);
        if (item)
          complete.set(ref, {
            text: item[0],
            instructions: item[1] !== null ? payload.instructionSources[item[1]] : '',
          });
      }
      for (const q of payload.questions) {
        for (const span of q.spans) expect(span.ref).toMatch(/^[a-p]{24}$/);
        complete.set(q.equivalenceRef, {
          text: q.spans
            .filter((s: { field: string }) => s.field === 'text')
            .map((s: { text: string }) => s.text)
            .join(''),
          instructions: q.spans
            .filter((s: { field: string }) => s.field === 'instructions')
            .map((s: { text: string }) => s.text)
            .join(''),
        });
      }
      expect(complete.size).toBe(23);
      for (const row of rows.slice(0, -1))
        expect([...complete.values()]).toContainEqual({ text: row[1], instructions: row[5] });
      expect(Object.values(payload.instructionSources)).toEqual([rows[0]![5]]);
      expect(JSON.stringify(c.call)).not.toContain(malicious);
    }
    const maxInputBytes = Math.max(...provider.calls.map(c => modelEnvelope(c.call).inputBytes));
    expect(maxInputBytes).toBeLessThanOrEqual(32000);
    expect(status!.usage).toHaveLength(provider.calls.length);
    expect(status!.usage.every(u => u.status === 'observed')).toBe(true);
  } finally {
    await cleanupDirectory(root);
  }
}, 60000);

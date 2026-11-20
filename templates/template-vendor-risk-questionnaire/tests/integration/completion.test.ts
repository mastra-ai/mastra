import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, readFile, writeFile, readdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { documentFixture } from '../support/completion.ts';
import {
  temporaryDirectory,
  cleanupDirectory,
  alterZip,
  source,
  tableMapping,
  operator,
  context,
} from '../fixtures/support.ts';
import { docxFixture, xlsxFixture } from '../fixtures/office.ts';
import { questionnaireRows } from '../fixtures/corpus.ts';
import { withExcelFormatting } from '../fixtures/excel-formatting.ts';
import { reviewFixture, decision, attachParent } from '../support/review.ts';
import { draftingFixture, controlledProvider, executeDraft, jsonStream, userText } from '../support/drafting.ts';
import * as completionPersistence from '../../src/mastra/persistence/completion.ts';
import { openIntakeStore } from '../../src/mastra/persistence/store.ts';
import { openRespondStore } from '../../src/mastra/persistence/respond.ts';
import { buildWritePlan, preflightPlan } from '../../src/mastra/completion/plan.ts';
import { writeDocument, validateDocument } from '../../src/mastra/completion/document.ts';
import { submitReview } from '../../src/mastra/review/service.ts';
import { publishExport } from '../../src/mastra/exports/publication.ts';
import * as publication from '../../src/mastra/exports/publication.ts';
import { openReviewStore } from '../../src/mastra/persistence/review.ts';
import { openDatabase } from '../../src/mastra/persistence/database.ts';
import { IntakeCoordinator } from '../../src/mastra/intake/adapters.ts';
import { canonicalJson, sha256 } from '../../src/mastra/intake/source.ts';
import { prepareResponse, respond, terminalText } from '../../src/mastra/runtime/respond.ts';

let root: string;
beforeEach(async () => {
  root = await temporaryDirectory();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await cleanupDirectory(root);
});

it('validates_document_targets_before_provider_calls', async () => {
  const f = await draftingFixture(root, {
      transform: b =>
        alterZip(b, 'xl/worksheets/sheet1.xml', s =>
          s.replace('</worksheet>', '<sheetProtection sheet="1"/></worksheet>'),
        ),
    }),
    provider = controlledProvider(f);
  const result = await executeDraft(f, provider);
  expect(provider.calls).toHaveLength(0);
  expect(result.status!.results[0]!.status).toBe('review_required');
  expect(result.status!.run.stopReason).toBe('SOURCE_UNAVAILABLE');
  for (const transform of [
    s => s.replace('<row r="2">', '<row r="3">'),
    s => s.replace('</worksheet>', '<mergeCells><mergeCell ref="F2:G2"/></mergeCells></worksheet>'),
    s => s.replace('<row r="2">', '<row r="2" ht="20" customHeight="1">'),
  ] as Array<(s: string) => string>) {
    await expect(
      (async () => {
        const fixture = await documentFixture('xlsx', b => alterZip(b, 'xl/worksheets/sheet1.xml', transform));
        await fixture.plan();
      })(),
    ).rejects.toThrow();
  }
});
it('requires_explicit_prefilled_target_replacement_and_exact_docx_spans', async () => {
  for (const format of ['xlsx', 'docx'] as const) {
    const f = await documentFixture(format, b => b, 'Unverified buyer answer');
    await expect(f.plan()).rejects.toThrow('PREFILLED_REPLACEMENT_REQUIRED');
    const key = canonicalJson(f.input.questions[0]!.responseTargets![0]!.locator),
      plan = await f.plan([key]);
    expect(plan.questions[0]!.targets[0]!.expectedText).toBe('Unverified buyer answer');
    const output = writeDocument(f.bytes, plan, f.projection);
    expect(sha256(output)).not.toBe(sha256(f.bytes));
  }
  const bytes = docxFixture([
    { paragraph: 'ID: Q1\nQuestion: Describe access controls.\nResponse:Untrusted existing response' },
  ]);
  const s = source(bytes, 'blocks.docx'),
    m = tableMapping(
      s,
      [{ regionId: 'paragraph:0', startRow: 0, endRow: 0, fields: { question: 0 } }],
      [],
      'docx.blocks.v1',
    );
  const imported = await new IntakeCoordinator().import(s, m, operator, context());
  await expect(buildWritePlan(bytes, imported.input, m)).rejects.toThrow('PREFILLED_REPLACEMENT_REQUIRED');
  const plan = await buildWritePlan(bytes, imported.input, m, [
    canonicalJson(imported.input.questions[0]!.responseTargets![0]!.locator),
  ]);
  const f = await documentFixture('docx'),
    output = writeDocument(bytes, plan, f.projection);
  const text = strFromU8(unzipSync(output)['word/document.xml']!);
  expect(text).toContain('Response:Workforce MFA is required.');
  expect(text).toContain('Describe access controls.');
  expect(text).not.toContain('Untrusted existing response');
});
it.each(['xlsx', 'docx'] as const)(
  'requires an explanation field in legacy %s demos and accepts current samples',
  async format => {
    for (const legacy of [true, false]) {
      const rows = questionnaireRows().map(row => (legacy ? row.slice(0, 7) : row));
      const bytes =
        format === 'xlsx' ? xlsxFixture([{ name: 'Vendor inquiry', rows }]) : docxFixture([{ table: rows }]);
      const snapshot = source(bytes, `questionnaire.${format}`);
      const coordinator = new IntakeCoordinator();
      const inspection = await coordinator.inspect(snapshot, context());
      const mapping = inspection.mappingCandidates[0]!;
      const imported = await coordinator.import(snapshot, mapping, operator, context());
      const consent = imported.input.questions.flatMap(
        q => q.untrustedExistingResponse?.map(t => canonicalJson(t.locator)) ?? [],
      );
      const plan = buildWritePlan(bytes, imported.input, mapping, consent);
      if (legacy) {
        await expect(plan).rejects.toMatchObject({
          issues: expect.arrayContaining([
            expect.objectContaining({ code: 'custom', params: { code: 'EXPLANATION_FIELD_REQUIRED' } }),
          ]),
        });
      } else {
        const result = await plan;
        expect(result.questions).toHaveLength(rows.length - 1);
        expect(result.questions.every(q => q.targets.some(t => t.role === 'explanation'))).toBe(true);
        expect(result.questions.every(q => q.targets.some(t => t.role === 'evidence'))).toBe(true);
      }
    }
  },
);
it('preserves_unrelated_xml_properties_and_untouched_package_entries', async () => {
  for (const format of ['xlsx', 'docx'] as const) {
    const part = format === 'xlsx' ? 'xl/worksheets/sheet1.xml' : 'word/document.xml';
    const f = await documentFixture(format, b =>
      alterZip(b, part, s =>
        format === 'xlsx'
          ? s
              .replace('<c r="G2"', '<c s="4" r="G2"')
              .replace(
                '</worksheet>',
                '<pageMargins left="0.8" right="0.8" top="1" bottom="1" header="0.3" footer="0.3"/></worksheet>',
              )
          : s.replace('<w:tbl>', '<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/></w:tblPr>'),
      ),
    );
    const before = unzipSync(f.bytes),
      plan = await f.plan(),
      output = writeDocument(f.bytes, plan, f.projection),
      after = unzipSync(output);
    validateDocument(f.bytes, output, plan, f.projection);
    for (const p of Object.keys(before).filter(p => p !== part)) expect(after[p]).toEqual(before[p]);
    expect(strFromU8(after[part]!)).toContain(format === 'xlsx' ? 's="4"' : 'w:w="9000"');
    expect(sha256(f.bytes)).toBe(f.snapshot.sha256);
  }
  const sparse = await documentFixture('xlsx', b =>
    alterZip(b, 'xl/worksheets/sheet1.xml', s => s.replace(/<c r="[GHI]2"[^]*?<\/c>/g, '')),
  );
  const sparsePlan = await sparse.plan();
  validateDocument(
    sparse.bytes,
    writeDocument(sparse.bytes, sparsePlan, sparse.projection),
    sparsePlan,
    sparse.projection,
  );
  for (const replacement of [
    '<w:p/>',
    '<w:p><w:r><w:t/></w:r></w:p>',
    '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Buyer</w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t> response</w:t></w:r></w:p>',
    '<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:t>Buyer</w:t></w:r></w:p><w:p><w:r><w:rPr><w:i/></w:rPr><w:t> response</w:t></w:r></w:p>',
  ]) {
    const f = await documentFixture('docx', b =>
      alterZip(b, 'word/document.xml', s => {
        let empty = 0;
        return s.replace(/<w:tc><w:p><w:r><w:t xml:space="preserve"><\/w:t><\/w:r><\/w:p><\/w:tc>/g, original =>
          ++empty === 2 ? `<w:tc>${replacement}</w:tc>` : original,
        );
      }),
    );
    const consent = f.input.questions[0]!.untrustedExistingResponse?.map(t => canonicalJson(t.locator)) ?? [];
    const plan = await f.plan(consent),
      output = writeDocument(f.bytes, plan, f.projection);
    validateDocument(f.bytes, output, plan, f.projection);
    if (replacement.includes('w:b')) expect(strFromU8(unzipSync(output)['word/document.xml']!)).toContain('<w:b/>');
  }
});
it('rejects_stale_source_mapping_and_publication_hash_mismatch', async () => {
  const f = await documentFixture('xlsx'),
    plan = await f.plan();
  await expect(
    preflightPlan(
      f.bytes,
      { ...f.input, inputProvenance: { ...f.input.inputProvenance, mappingDigest: 'a'.repeat(64) } },
      f.mapping,
      plan,
    ),
  ).rejects.toThrow('STALE_SOURCE_MAPPING');
  const run = await reviewFixture(root);
  await submitReview(decision(run), run.options);
  const result = await publishExport(run.runId, run.options);
  await writeFile(result.path, 'tampered');
  await expect(publishExport(run.runId, run.options)).rejects.toThrow('ARTIFACT_HASH_MISMATCH');
  await run.mastra.shutdown();
});

async function respondFixture(
  format: 'xlsx' | 'docx',
  name: string = format,
  options: Parameters<typeof draftingFixture>[1] = {},
  plans: Parameters<typeof controlledProvider>[1] = [],
) {
  const dir = resolve(root, name);
  await mkdir(dir);
  const fixture = await draftingFixture(dir, {
      format,
      questions: [{ text: 'Does workforce MFA apply?' }],
      ...options,
    }),
    provider = controlledProvider(fixture, plans),
    attached = attachParent(fixture, provider.factory);
  const f = await documentFixture(format);
  const rows = [
    [
      'Reference',
      'Inquiry',
      'Response kind',
      'Allowed values',
      'Domain',
      'Guidance',
      'Buyer response',
      'Explanation',
      'Evidence',
    ],
    ...fixture.questions.map(q => [
      q.id,
      q.originalText,
      'boolean',
      'yes|no|partial|not_applicable|unknown|withheld',
      'access',
      'Answer from approved records.',
      '',
      '',
      '',
    ]),
  ];
  const { xlsxFixture, docxFixture } = await import('../fixtures/office.ts');
  const bytes = format === 'xlsx' ? xlsxFixture([{ name: 'Questions', rows }]) : docxFixture([{ table: rows }]);
  const sourcePath = resolve(dir, `source.${format}`);
  await writeFile(sourcePath, bytes);
  const profile = {
    schemaVersion: 1 as const,
    evidenceRoot: resolve(dir, 'evidence'),
    manifestPath: fixture.manifestPath,
    scope: fixture.snapshot.record.scope,
    policy: (await import('../support/policy.ts')).fixturePolicy,
  };
  return { ...fixture, ...attached, provider, sourcePath, profile, f };
}
it.each(['REPLACE', 'replace', '  RePlAcE  ', 'yes', '', 'cancel'])(
  'prefilled replacement accepts explicit confirmation regardless of case: %j',
  async confirmation => {
    const f = await respondFixture('xlsx', 'prefilled-confirmation');
    await writeFile(
      f.sourcePath,
      alterZip(await readFile(f.sourcePath), 'xl/worksheets/sheet1.xml', xml =>
        xml.replace(
          '<c r="G2" t="inlineStr"><is><t xml:space="preserve"></t>',
          '<c r="G2" t="inlineStr"><is><t xml:space="preserve">Untrusted prior answer</t>',
        ),
      ),
    );
    const lines: string[] = [];
    const ask = vi.fn(async () => confirmation);
    try {
      const result = prepareResponse({
        ...f,
        databaseUrl: f.url,
        models: f.provider.factory,
        io: { show: s => lines.push(s), ask },
      });
      const accepted = confirmation.trim().toUpperCase() === 'REPLACE';
      if (accepted) {
        const prepared = await result;
        expect(prepared.state.questions).toHaveLength(1);
        expect(f.provider.calls.some(call => call.phase === 'draft')).toBe(true);
      } else {
        await expect(result).rejects.toThrow(
          confirmation === 'cancel' ? 'OPERATOR_CANCELLED' : 'PREFILLED_REPLACEMENT_DECLINED',
        );
        expect(f.provider.calls).toHaveLength(0);
      }
      expect(ask).toHaveBeenCalledTimes(1);
      expect(lines).toContain('Untrusted prefilled target for Q1: Untrusted prior answer');
      const runId = /Run ID: ([^. ]+)/.exec(lines.find(s => s.startsWith('Run ID:'))!)![1]!;
      const checkpoints = await openRespondStore(f.url);
      try {
        expect((await checkpoints.read(runId))!.checkpoint.consent).toHaveLength(accepted ? 1 : 0);
      } finally {
        checkpoints.close();
      }
    } finally {
      await f.mastra.shutdown();
    }
  },
);
it('respond_resumes_missing_initialization_checkpoints_before_provider_work', async () => {
  for (const interruption of ['completion', 'evidence'] as const) {
    const f = await respondFixture('xlsx', `initialize-${interruption}`),
      lines: string[] = [];
    if (interruption === 'completion') {
      await writeFile(
        f.sourcePath,
        alterZip(await readFile(f.sourcePath), 'xl/worksheets/sheet1.xml', xml =>
          xml.replace(
            '<c r="G2" t="inlineStr"><is><t xml:space="preserve"></t>',
            '<c r="G2" t="inlineStr"><is><t xml:space="preserve">Untrusted prior answer</t>',
          ),
        ),
      );
    }
    const fault =
      interruption === 'completion'
        ? vi
            .spyOn(completionPersistence, 'prepareCompletion')
            .mockRejectedValueOnce(new Error('INITIALIZATION_INTERRUPTED'))
        : undefined;
    if (interruption === 'evidence') await rename(f.manifestPath, `${f.manifestPath}.saved`);
    try {
      await expect(
        respond({
          ...f,
          databaseUrl: f.url,
          models: f.provider.factory,
          io: { show: s => lines.push(s), ask: async () => 'REPLACE' },
        }),
      ).rejects.toThrow(interruption === 'completion' ? 'INITIALIZATION_INTERRUPTED' : 'READ_FAILED');
    } finally {
      fault?.mockRestore();
      if (interruption === 'evidence') await rename(`${f.manifestPath}.saved`, f.manifestPath);
    }
    const runId = /Run ID: ([^. ]+)/.exec(lines.find(s => s.startsWith('Run ID:'))!)![1]!;
    const store = await openIntakeStore(f.url);
    expect(await store.readIntake(runId)).toBeDefined();
    expect(await store.readEvidence(runId)).toBeUndefined();
    store.close();
    expect(f.provider.calls).toHaveLength(0);
    const db = await openDatabase(f.url);
    const completion = await db.execute({
      sql: 'SELECT plan_json FROM vrq_document_plans WHERE run_id = ?',
      args: [runId],
    });
    expect(completion.rows).toHaveLength(1);
    if (interruption === 'completion') expect(completion.rows[0]!.plan_json).toBeNull();
    db.close();
    const prompts: string[] = [],
      answers = ['release', 'APPROVE'];
    const output = await respond({
      ...f,
      databaseUrl: f.url,
      resume: runId,
      models: f.provider.factory,
      io: {
        show: () => {},
        ask: async prompt => {
          prompts.push(prompt);
          return answers.shift() ?? null;
        },
      },
    });
    expect(output.manifest.schemaVersion).toBe(2);
    expect(prompts.some(p => p.includes('REPLACE'))).toBe(false);
    expect(f.provider.calls.filter(c => c.phase === 'draft')).toHaveLength(1);
    const resumed = await openIntakeStore(f.url);
    expect(await resumed.readEvidence(runId)).toBeDefined();
    resumed.close();
    await f.mastra.shutdown();
  }
});
it('respond_rejects_a_missing_completion_record_before_provider_work', async () => {
  const f = await respondFixture('xlsx', 'missing-completion'),
    checkpoints = await openRespondStore(f.url);
  await checkpoints.initialize(f.runId, source(await readFile(f.sourcePath), 'source.xlsx'), f.sourcePath);
  checkpoints.close();
  const database = await openDatabase(f.url);
  await database.execute({ sql: 'DELETE FROM vrq_document_plans WHERE run_id = ?', args: [f.runId] });
  database.close();
  await expect(
    respond({
      ...f,
      databaseUrl: f.url,
      resume: f.runId,
      models: f.provider.factory,
      io: {
        show: () => {},
        ask: async () => {
          throw new Error('MISSING_COMPLETION_MUST_NOT_PROMPT');
        },
      },
    }),
  ).rejects.toThrow('COMPLETION_NOT_INITIALIZED');
  expect(f.provider.calls).toHaveLength(0);
  await f.mastra.shutdown();
});
it.each(['unknown', 'restricted', 'review_required', 'invalid correction'] as const)(
  'respond_can_correct_rejected_%s_proposals_without_repeating_drafts',
  async scenario => {
    const f = await respondFixture(
      'xlsx',
      `retry-${scenario.replace(' ', '-')}`,
      {
        disclosure: scenario === 'restricted' || scenario === 'review_required' ? scenario : 'shareable',
        ...(scenario === 'unknown'
          ? { questions: [{ text: 'Does workforce MFA apply?' }, { text: 'Is workforce MFA required?' }] }
          : {}),
      },
      scenario === 'unknown' ? [{}, { value: 'unknown' }] : [],
    );
    if (scenario === 'restricted')
      await writeFile(
        f.sourcePath,
        alterZip(await readFile(f.sourcePath), 'xl/worksheets/sheet1.xml', xml =>
          xml.replace('Answer from approved records.', 'Use authorized materials.'),
        ),
      );
    const models: typeof f.provider.factory = (phase, id) => {
      const base = f.provider.factory(phase, id);
      if (phase !== 'verification') return base;
      const verify: typeof base.doStream = async call =>
        userText(call).includes('Unsupported new control commitment.')
          ? jsonStream({
              supportedClaimIds: [],
              conflictedClaimIds: [],
              unsupportedCommitment: true,
              applicable: true,
              complete: true,
              sensitive: false,
            })
          : base.doStream(call);
      return { ...base, doStream: verify };
    };
    const lines: string[] = [],
      first =
        scenario === 'unknown'
          ? ['release', 'release']
          : scenario === 'invalid correction'
            ? ['correct', 'Unsupported new control commitment.']
            : scenario === 'review_required'
              ? ['release', 'NO']
              : ['release'];
    await expect(
      respond({
        ...f,
        databaseUrl: f.url,
        models,
        io: { show: s => lines.push(s), ask: async () => first.shift() ?? null },
      }),
    ).rejects.toThrow(
      scenario === 'unknown'
        ? 'UNSUPPORTED_REVIEW'
        : scenario === 'invalid correction'
          ? 'UNSUPPORTED_CORRECTION'
          : 'FORBIDDEN_DISCLOSURE',
    );
    const runId = /Run ID: ([^. ]+)/.exec(lines.find(s => s.startsWith('Run ID:'))!)![1]!;
    const review = await openReviewStore(f.url),
      checkpoints = await openRespondStore(f.url);
    expect((await review.read(runId))!.projection).toBeNull();
    expect((await checkpoints.read(runId))!.checkpoint.reviewIssue).toBeDefined();
    const before = f.provider.calls.filter(c => ['draft', 'interpretation'].includes(c.phase));
    const retry =
      scenario === 'unknown'
        ? ['keep', 'change', 'unknown', null]
        : ['change', scenario === 'invalid correction' ? 'release' : 'withheld', null];
    const prompts: string[] = [],
      retryLines: string[] = [];
    await expect(
      respond({
        ...f,
        databaseUrl: f.url,
        resume: runId,
        models,
        io: {
          show: s => retryLines.push(s),
          ask: async prompt => {
            prompts.push(prompt);
            return retry.shift() ?? null;
          },
        },
      }),
    ).rejects.toThrow('OPERATOR_CANCELLED');
    expect(retryLines.some(s => s.includes('Previous review validation failed:'))).toBe(true);
    expect(prompts.some(p => p.includes('keep this proposal or change'))).toBe(true);
    const pending = (await review.read(runId))!;
    expect(pending.state).toBe('awaiting_review');
    expect(pending.projection).not.toBeNull();
    expect(pending.projection!.answers.at(-1)!.disposition).toBe(
      scenario === 'unknown' ? 'unknown' : scenario === 'invalid correction' ? 'release' : 'withheld',
    );
    if (scenario === 'unknown') expect(pending.projection!.answers[0]!.disposition).toBe('release');
    expect((await checkpoints.read(runId))!.checkpoint.reviewIssue).toBeUndefined();
    const callsAfterValidation = f.provider.calls.length;
    const output = await respond({
      ...f,
      databaseUrl: f.url,
      resume: runId,
      models,
      io: {
        show: () => {},
        ask: async prompt => {
          expect(prompt).toContain('Approve this complete displayed set?');
          return 'APPROVE';
        },
      },
    });
    expect(output.manifest.schemaVersion).toBe(2);
    expect(f.provider.calls.filter(c => ['draft', 'interpretation'].includes(c.phase))).toEqual(before);
    expect(f.provider.calls).toHaveLength(callsAfterValidation);
    expect((await review.read(runId))!.state).toBe('exported');
    review.close();
    checkpoints.close();
    await f.mastra.shutdown();
  },
);
it('retries_failed_publication_of_excel_formatted_withheld_answers_without_model_calls', async () => {
  const f = await respondFixture('xlsx', 'excel-save', {
    questions: [{ text: 'Does workforce MFA apply?' }, { text: 'Is workforce MFA required?' }],
  });
  await writeFile(f.sourcePath, withExcelFormatting(await readFile(f.sourcePath)));
  const lines: string[] = [],
    responses = ['withheld', 'withheld', 'APPROVE'];
  const publish = vi
    .spyOn(publication, 'publishExport')
    .mockRejectedValueOnce(new Error('UNINSPECTABLE_PACKAGE_CONTENT'));
  try {
    await expect(
      respond({
        ...f,
        databaseUrl: f.url,
        models: f.provider.factory,
        io: { show: s => lines.push(s), ask: async () => responses.shift() ?? null },
      }),
    ).rejects.toThrow('UNINSPECTABLE_PACKAGE_CONTENT');
    const runId = /Run ID: ([^. ]+)/.exec(lines.find(s => s.startsWith('Run ID:'))!)![1]!;
    const calls = f.provider.calls.length;
    const saved = await openReviewStore(f.url);
    try {
      const approved = (await saved.read(runId))!;
      expect(approved.state).toBe('approved');
      expect((await f.workflow.getWorkflowRunById(approved.workflowRunId))!.status).toBe('failed');
      const output = await respond({
        ...f,
        databaseUrl: f.url,
        sourcePath: undefined,
        resume: runId,
        models: f.provider.factory,
        io: {
          show: () => {},
          ask: async () => {
            throw new Error('APPROVAL_ALREADY_SAVED');
          },
        },
      });
      expect(output.manifest.quality).toBe('delivered_with_gaps');
      expect((await saved.read(runId))!.state).toBe('exported');
      expect(f.provider.calls).toHaveLength(calls);
      expect(publish).toHaveBeenCalledTimes(2);
      const sheet = strFromU8(unzipSync(await readFile(output.path))['xl/worksheets/sheet1.xml']!);
      expect(sheet).toContain('width="32" customWidth="1"');
      expect(sheet).toContain('withheld');
    } finally {
      saved.close();
    }
  } finally {
    await f.mastra.shutdown();
  }
});

it('respond_reviews_and_completes_xlsx_and_docx_without_json', async () => {
  const publish = vi.spyOn(publication, 'publishExport');
  for (const format of ['xlsx', 'docx'] as const) {
    const f = await respondFixture(format),
      lines: string[] = [],
      responses = ['release', 'APPROVE'];
    const output = await respond({
      ...f,
      databaseUrl: f.url,
      workflow: f.workflow,
      sourcePath: f.sourcePath,
      models: f.provider.factory,
      io: { show: s => lines.push(s), ask: async () => responses.shift() ?? null },
    });
    expect(output.manifest.schemaVersion).toBe(2);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(output.path.endsWith(`answered.${format}`)).toBe(true);
    const resumed = await respond({
      ...f,
      databaseUrl: f.url,
      resume: output.manifest.runId,
      models: f.provider.factory,
      io: {
        show: () => {},
        ask: async () => {
          throw new Error('ALREADY_EXPORTED');
        },
      },
    });
    expect(resumed).toEqual(output);
    expect(publish).toHaveBeenCalledTimes(2);
    publish.mockClear();
    expect(lines.some(s => s.includes('Supported by approved evidence.'))).toBe(true);
    expect(await readdir(resolve(output.path, '..'))).toEqual([`answered.${format}`]);
    expect(f.provider.calls.filter(c => c.phase === 'draft')).toHaveLength(1);
    await f.mastra.shutdown();
  }
});
it('respond_completes_verified_identified_docx_blocks_with_exact_response_spans', async () => {
  const f = await respondFixture('docx', 'identified-blocks');
  await writeFile(f.sourcePath, docxFixture([{ paragraph: 'ID: Q1\nQuestion: Does workforce MFA apply?\nResponse:' }]));
  const provider = controlledProvider(f, [
      {
        value: 'free_text',
        text: 'Production workforce MFA is required.',
        draft: d => ({ ...d, responseOption: null }),
      },
    ]),
    answers = ['release', 'APPROVE'];
  const fresh = attachParent(f, provider.factory);
  const output = await respond({
    ...f,
    workflow: fresh.workflow,
    databaseUrl: f.url,
    models: provider.factory,
    io: { show: () => {}, ask: async () => answers.shift() ?? null },
  });
  const text = strFromU8(unzipSync(await readFile(output.path))['word/document.xml']!);
  expect(text).toContain('Response:Production workforce MFA is required.');
  expect(text).toContain('Does workforce MFA apply?');
  expect(provider.calls.filter(c => c.phase === 'draft')).toHaveLength(1);
  await fresh.mastra.shutdown();
  await f.mastra.shutdown();
});
it('respond_cancellation_and_stale_review_never_imply_approval', async () => {
  const f = await respondFixture('xlsx'),
    lines: string[] = [],
    responses = ['release', null];
  await expect(
    respond({
      ...f,
      databaseUrl: f.url,
      workflow: f.workflow,
      sourcePath: f.sourcePath,
      models: f.provider.factory,
      io: { show: s => lines.push(s), ask: async () => responses.shift() ?? null },
    }),
  ).rejects.toThrow('OPERATOR_CANCELLED');
  const runId = /Run ID: ([^. ]+)/.exec(lines.find(s => s.startsWith('Run ID:'))!)![1]!;
  const review = await openReviewStore(f.url),
    state = (await review.read(runId))!;
  expect(state.state).toBe('awaiting_review');
  expect(state.projection).not.toBeNull();
  const checkpoints = await openRespondStore(f.url);
  expect((await checkpoints.read(runId))!.checkpoint.dispositions).toHaveLength(1);
  checkpoints.close();
  const calls = f.provider.calls.filter(c => c.phase === 'draft').length;
  await expect(
    respond({
      ...f,
      databaseUrl: f.url,
      workflow: f.workflow,
      resume: runId,
      models: f.provider.factory,
      io: {
        show: () => {},
        ask: async () => {
          await submitReview(
            {
              decisionId: 'concurrent-edit',
              runId,
              organizationId: state.organizationId,
              expectedRevision: state.revision + 1,
              expectedDigest: (await review.read(runId))!.digest,
              policyDigest: state.policyDigest,
              dispositions: [
                {
                  questionId: 'Q1',
                  disposition: 'unknown',
                  safeReason: 'No releasable supported answer is available.',
                  releaseDocumentIds: [],
                },
              ],
              finalApproval: false,
            },
            {
              evidenceRoot: f.profile.evidenceRoot,
              manifestPath: f.profile.manifestPath,
              databaseUrl: f.url,
              models: f.provider.factory,
            },
          );
          return 'APPROVE';
        },
      },
    }),
  ).rejects.toThrow('STALE_REVIEW');
  expect(f.provider.calls.filter(c => c.phase === 'draft')).toHaveLength(calls);
  expect((await review.read(runId))!.state).toBe('awaiting_review');
  expect(terminalText('\x1b[2JSecret\u202e')).toBe('Secret');
  review.close();
  await f.mastra.shutdown();
});

it('offline_respond_demos_preserve_readable_long_answers_in_both_formats', async () => {
  const { generateRespondDemo, demoLongAnswer } = await import('../support/completion-demo.ts');
  for (const format of ['xlsx', 'docx'] as const) {
    const output = await generateRespondDemo(resolve(root, 'demos'), format);
    expect(output.draftCalls).toBe(1);
    expect(sha256(await readFile(output.sourcePath))).toBe(output.originalSha256);
    const entries = unzipSync(await readFile(output.outputPath)),
      text = strFromU8(entries[format === 'xlsx' ? 'xl/worksheets/sheet1.xml' : 'word/document.xml']!);
    expect(text).toContain(demoLongAnswer);
    expect(output.manifest.files).toHaveLength(1);
    expect(text).toContain(format === 'xlsx' ? 's="1"' : 'w:orient="landscape"');
    // Office-compatible visual inspection is a delivery gate; this proves local content/readback, not a viewer pass.
  }
});

it('fresh_process_restarts_interrupted_drafting_without_repeating_completed_calls', async () => {
  const { createClient, LibsqlError } = await import('@libsql/client');
  const { controlledClient } = await import('../support/persistence.ts');
  const { attachDraftWorkflow } = await import('../support/workflow.ts');
  const { fixturePolicy } = await import('../support/policy.ts');
  const { execFileSync } = await import('node:child_process');
  const f = await draftingFixture(root, {
      questions: [{ text: 'Does workforce MFA apply?' }, { text: 'Is workforce MFA required?' }],
    }),
    provider = controlledProvider(f, [
      { interpretation: { equivalenceKey: 'access' } },
      { interpretation: { equivalenceKey: 'access' } },
    ]);
  let faults = 0;
  const injected = controlledClient(createClient({ url: f.url }), (method, args) => {
    const statement = args[0] as { sql?: string; args?: unknown[] } | undefined;
    if (
      method === 'execute' &&
      statement?.sql?.startsWith('INSERT INTO mastra_workflow_snapshot') &&
      statement.args?.[0] === 'vendor-risk-drafts' &&
      JSON.parse(String(statement.args[3])).status === 'success'
    ) {
      faults++;
      throw new LibsqlError('CONTROLLED_TERMINAL_INTERRUPTION', 'SQLITE_BUSY');
    }
  });
  const original = await attachDraftWorkflow(f.url, f.runtimeRoot, provider.factory, { native: injected.client }),
    run = await original.target.createRun();
  await expect(
    run.start({
      inputData: {
        runId: f.runId,
        evidenceRoot: resolve(root, 'evidence'),
        manifestPath: f.manifestPath,
        policy: fixturePolicy,
      },
    }),
  ).rejects.toThrow();
  expect(faults).toBe(1);
  expect(provider.calls.filter(c => c.phase === 'draft')).toHaveLength(2);
  await original.close().catch(() => {});
  const script = resolve(root, 'fresh-resume.ts');
  await writeFile(
    script,
    `import {attachDraftWorkflow} from ${JSON.stringify(resolve('tests/support/workflow.ts'))};
let calls=0;const models=()=>({doStream:async()=>{calls++;throw new Error('COMPLETED_WORK_REPEATED');},doGenerate:async()=>{calls++;throw new Error('COMPLETED_WORK_REPEATED');}});const fresh=await attachDraftWorkflow(${JSON.stringify(f.url)},${JSON.stringify(f.runtimeRoot)},models);const run=await fresh.target.createRun({runId:${JSON.stringify(run.runId)}});const result=await run.restart();console.log(JSON.stringify({status:result.status,calls}));await fresh.close();`,
  );
  const stdout = execFileSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...process.env, MASTRA_TELEMETRY_DISABLED: '1' },
  });
  const result = JSON.parse(
    stdout
      .trim()
      .split('\n')
      .find(s => s.startsWith('{'))!,
  );
  expect(result).toEqual({ status: 'success', calls: 0 });
});

it('mapping_cancellation_is_durable_and_source_swaps_stop_before_provider_work', async () => {
  const f = await respondFixture('xlsx', 'mapping'),
    bytes = await readFile(f.sourcePath);
  await writeFile(
    f.sourcePath,
    alterZip(bytes, 'xl/worksheets/sheet1.xml', s => s.replace('Reference', 'Vendor identifier')),
  );
  const lines: string[] = [],
    first = ['map', '1', null];
  await expect(
    respond({
      ...f,
      databaseUrl: f.url,
      models: f.provider.factory,
      io: { show: s => lines.push(s), ask: async () => first.shift() ?? null },
    }),
  ).rejects.toThrow('OPERATOR_CANCELLED');
  expect(f.provider.calls).toHaveLength(0);
  const runId = /Run ID: ([^. ]+)/.exec(lines.find(s => s.startsWith('Run ID:'))!)![1]!;
  const checkpoints = await openRespondStore(f.url),
    saved = (await checkpoints.read(runId))!;
  expect(Object.values(saved.checkpoint.mappingAnswers).sort()).toEqual(['1', 'map']);
  checkpoints.close();
  const remaining = ['1', '1', '0', '2', '3', '5', '6', '7', '8', 'Header row.', 'release', 'APPROVE'];
  const output = await respond({
    ...f,
    databaseUrl: f.url,
    resume: runId,
    models: f.provider.factory,
    io: { show: () => {}, ask: async () => remaining.shift() ?? null },
  });
  expect(output.manifest.schemaVersion).toBe(2);
  expect(f.provider.calls.filter(c => c.phase === 'draft')).toHaveLength(1);
  const before = f.provider.calls.length;
  await writeFile(f.sourcePath, bytes);
  await expect(
    respond({
      ...f,
      databaseUrl: f.url,
      resume: runId,
      models: f.provider.factory,
      io: { show: () => {}, ask: async () => null },
    }),
  ).rejects.toThrow('STALE_SOURCE_MAPPING');
  expect(f.provider.calls).toHaveLength(before);
  await f.mastra.shutdown();
});

import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { IntakeCoordinator, officeAdapter } from '../../src/mastra/intake/adapters.ts';
import type { QuestionnaireInputAdapter } from '../../src/mastra/intake/adapters.ts';
import { mappingSchema } from '../../src/mastra/contracts/mapping.ts';
import { sourceLocatorSchema } from '../../src/mastra/contracts/source-locator.ts';
import type { CanonicalQuestion } from '../../src/mastra/contracts/question.ts';
import type { ConfirmedInputMapping } from '../../src/mastra/contracts/mapping.ts';
import type { InputInspection } from '../../src/mastra/contracts/inspection.ts';
import type { NormalizationResult } from '../../src/mastra/contracts/normalization.ts';
import { readSource, runParser, sha256, canonicalJson } from '../../src/mastra/intake/source.ts';
import { openIntakeStore } from '../../src/mastra/persistence/store.ts';
import { generateCorpus, questionnaireRows } from '../fixtures/corpus.ts';
import { xlsxFixture, docxFixture, pdfFixture } from '../fixtures/office.ts';
import {
  source,
  context,
  operator,
  tableMapping,
  alterZip,
  addZipMember,
  dishonestExpandedSizes,
  temporaryDirectory,
  cleanupDirectory,
} from '../fixtures/support.ts';

let root: string;
beforeEach(async () => {
  root = await temporaryDirectory();
});
afterEach(async () => {
  await cleanupDirectory(root);
});
const comparable = (q: CanonicalQuestion) => ({
  id: q.id,
  originalQuestionId: q.originalQuestionId,
  originalText: q.originalText,
  normalizedText: q.normalizedText,
  order: q.order,
  section: q.section,
  instructions: q.instructions,
  answerType: q.answerType,
  answerConstraints: q.answerConstraints,
  existing: q.untrustedExistingResponse?.map(e => e.text),
});
async function autoImport(s: ReturnType<typeof source>, coordinator = new IntakeCoordinator()) {
  const inspected = await coordinator.inspect(s, context());
  expect(inspected.status).toBe('ready');
  return coordinator.import(s, inspected.mappingCandidates[0]!, operator, context());
}
function futureAdapter(change?: (result: NormalizationResult) => NormalizationResult): QuestionnaireInputAdapter {
  const base = officeAdapter('docx');
  const descriptor = {
    ...base.descriptor,
    key: 'test-docx-package',
    adapterVersion: '2.0.0',
    extensions: ['.testdocx'],
    mediaTypes: ['application/x-test-docx'],
    profiles: ['test.docx.table.v1'],
  };
  const ownMapping = mappingSchema.refine(
    m =>
      m.adapterKey === descriptor.key &&
      m.adapterVersion === descriptor.adapterVersion &&
      m.profile === 'test.docx.table.v1',
  );
  const toOriginal = (m: ConfirmedInputMapping) => ({
    ...m,
    adapterKey: 'docx',
    adapterVersion: '1.0.0',
    profile: 'docx.table.v1',
  });
  const fromOriginal = (m: ConfirmedInputMapping) =>
    ownMapping.parse({
      ...m,
      adapterKey: descriptor.key,
      adapterVersion: descriptor.adapterVersion,
      profile: 'test.docx.table.v1',
    });
  return {
    descriptor,
    mappingValidator: ownMapping,
    locatorValidator: sourceLocatorSchema.refine(l => l.kind === 'docx.table_cell' && l.part === 'word/document.xml'),
    resolve: base.resolve,
    async inspect(s, c) {
      const original = await base.inspect(s, c);
      return {
        ...original,
        adapterKey: descriptor.key,
        adapterVersion: descriptor.adapterVersion,
        mappingCandidates: original.mappingCandidates.map(fromOriginal),
      };
    },
    async normalize(s, m, c) {
      ownMapping.parse(m);
      const original = await base.normalize(s, toOriginal(m), c);
      return change ? change(structuredClone(original)) : original;
    },
  };
}

describe('questionnaire intake and registered adapter journeys', () => {
  it('normalizes_xlsx_and_docx_without_losing_question_identity', async () => {
    await generateCorpus(root);
    const originalX = await readFile(resolve(root, 'questionnaire.xlsx')),
      originalD = await readFile(resolve(root, 'questionnaire.docx'));
    const x = await readSource(resolve(root, 'questionnaire.xlsx'), 'paired-xlsx', context().limits),
      d = await readSource(resolve(root, 'questionnaire.docx'), 'paired-docx', context().limits);
    const [a, b] = await Promise.all([autoImport(x), autoImport(d)]);
    expect(a.input.questions).toHaveLength(24);
    expect(a.input.questions.map(comparable)).toEqual(b.input.questions.map(comparable));
    expect(a.input.questions[0]!.id).toBe('VRQ-001');
    expect(a.input.questions[8]!.originalText).toBe(a.input.questions[22]!.originalText);
    expect(a.input.questions[8]!.id).not.toBe(a.input.questions[22]!.id);
    expect(a.input.questions[0]!.sourceLocators[0]).toMatchObject({
      kind: 'xlsx.cell',
      sheet: 'Vendor inquiry',
      cell: 'B2',
      sourceSha256: x.sha256,
    });
    expect(b.input.questions[0]!.sourceLocators[0]).toMatchObject({
      kind: 'docx.table_cell',
      part: 'word/document.xml',
      table: 0,
      row: 1,
      cell: 1,
      sourceSha256: d.sha256,
    });
    expect(a.normalization.coverage).toMatchObject({
      discoveredCandidates: 25,
      emittedQuestions: 24,
      excludedCandidates: 1,
    });
    expect(a.input.questions[0]!.untrustedExistingResponse?.[0]!.text).toBe('Buyer supplied YES, unverified');
    expect(await readFile(resolve(root, 'questionnaire.xlsx'))).toEqual(originalX);
    expect(await readFile(resolve(root, 'questionnaire.docx'))).toEqual(originalD);
    // SheetJS CE writes this default even when the workbook contains no binary parts.
    const unusedDeclaration = alterZip(x.bytes, '[Content_Types].xml', xml =>
      xml.replace(
        '</Types>',
        '<Default Extension="bin" ContentType="application/vnd.ms-excel.sheet.binary.macroEnabled.main"/></Types>',
      ),
    );
    const unusedPath = resolve(root, 'unused-declaration.xlsx');
    await writeFile(unusedPath, unusedDeclaration);
    const ordinary = await readSource(unusedPath, x.sourceId, context().limits);
    const accepted = await autoImport(ordinary);
    expect(accepted.input.questions).toHaveLength(24);
    expect(accepted.input.questions.map(comparable)).toEqual(a.input.questions.map(comparable));
    expect(accepted.input.questions.map(q => q.sourceLocators)).toEqual(
      a.input.questions.map(q => q.sourceLocators.map(locator => ({ ...locator, sourceSha256: ordinary.sha256 }))),
    );
    expect(Buffer.from(ordinary.bytes)).toEqual(Buffer.from(unusedDeclaration));
    expect(await readFile(unusedPath)).toEqual(Buffer.from(unusedDeclaration));
    const punctuation = source(
      alterZip(d.bytes, 'word/document.xml', xml =>
        xml.replace('information security policy', 'information</w:t><w:noBreakHyphen/><w:t>security policy'),
      ),
      'punctuation.docx',
    );
    const preserved = await autoImport(punctuation);
    expect(preserved.input.questions[0]!.originalText).toBe(
      'Do you maintain a documented information\u2011security policy?',
    );
    expect(preserved.input.questions[0]!.normalizedText).toBe(
      'Do you maintain a documented information\u2011security policy?',
    );
    expect(
      await officeAdapter('docx').resolve(punctuation, preserved.input.questions[0]!.sourceLocators[0]!, context()),
    ).toBe('Do you maintain a documented information\u2011security policy?');
  }, 30_000);
  it('maps_xlsx_columns_and_docx_regions_without_fixed_headers', async () => {
    const columns = [
      'Prompt',
      'Ref',
      'Mode',
      'Options',
      'Category',
      'Direction',
      'Existing',
      'Explanation',
      'Proof',
      'Required',
      'Limit',
    ];
    const record = [
      'Keep punctuation: MFA?\nFor privileged roles.',
      'custom-1',
      'boolean',
      'Yes|No|N/A',
      'access',
      'Scope: production only.',
      'Untrusted buyer statement',
      '',
      '',
      'true',
      '120',
    ];
    let bytes = xlsxFixture([
      { name: 'Visible', rows: [['Decorative heading'], columns, record] },
      { name: 'Hidden', hidden: true, rows: [columns, [...record.slice(0, 1), 'custom-2', ...record.slice(2)]] },
    ]);
    bytes = alterZip(bytes, 'xl/worksheets/sheet1.xml', xml => xml.replace('r="3"', 'r="3" hidden="1"'));
    const s = source(bytes);
    const coordinator = new IntakeCoordinator();
    const inspected = await coordinator.inspect(s, context());
    expect(inspected.status).toBe('needs_mapping');
    expect(inspected.regions[1]?.hidden).toBe(true);
    expect(inspected.regions[0]?.candidateRows).toEqual([0, 1, 2]);
    expect(inspected.regions[1]?.candidateRows).toEqual([0, 1]);
    const fields = {
      question: 0,
      id: 1,
      type: 2,
      options: 3,
      section: 4,
      instructions: 5,
      response: 6,
      explanation: 7,
      evidence: 8,
      required: 9,
      maxChars: 10,
    };
    const mapping = tableMapping(
      s,
      [
        { regionId: 'sheet:0', startRow: 2, endRow: 2, fields },
        { regionId: 'sheet:1', startRow: 1, endRow: 1, fields },
      ],
      [
        { regionId: 'sheet:0', startRow: 0, endRow: 1, reason: 'Decorative heading and table header' },
        { regionId: 'sheet:1', startRow: 0, endRow: 0, reason: 'Table header' },
      ],
    );
    const imported = await coordinator.import(s, mapping, operator, context());
    expect(imported.input.questions.map(q => q.id)).toEqual(['custom-1', 'custom-2']);
    expect(imported.input.questions[0]).toMatchObject({
      originalText: record[0],
      instructions: record[5],
      answerConstraints: {
        required: true,
        maxChars: 120,
        options: [
          { value: 'Yes', label: 'Yes' },
          { value: 'No', label: 'No' },
          { value: 'N/A', label: 'N/A' },
        ],
      },
    });
    expect(imported.input.questions[0]!.responseTargets?.map(t => t.role)).toEqual([
      'response',
      'explanation',
      'evidence',
    ]);
    await expect(
      coordinator.import(s, { ...mapping, regions: mapping.regions.slice(0, 1) }, operator, context()),
    ).rejects.toMatchObject({ code: 'UNACCOUNTED_CONTENT' });
    const doc = source(
      docxFixture([
        { paragraph: 'Section A: apply to production.' },
        { table: [columns, record] },
        { paragraph: 'Section B: apply to staging.' },
        { table: [columns, [...record.slice(0, 1), 'custom-2', ...record.slice(2)]] },
      ]),
      'arbitrary.docx',
    );
    const dm = tableMapping(
      doc,
      [
        { regionId: 'table:0', startRow: 1, endRow: 1, fields },
        { regionId: 'table:1', startRow: 1, endRow: 1, fields },
      ],
      [
        { regionId: 'paragraph:0', startRow: 0, endRow: 0, reason: 'Section supplied explicitly in region mapping' },
        { regionId: 'paragraph:1', startRow: 0, endRow: 0, reason: 'Section supplied explicitly in region mapping' },
        { regionId: 'table:0', startRow: 0, endRow: 0, reason: 'Header' },
        { regionId: 'table:1', startRow: 0, endRow: 0, reason: 'Header' },
      ],
    );
    const di = await coordinator.import(doc, dm, operator, context());
    expect(di.input.questions.map(q => q.id)).toEqual(['custom-1', 'custom-2']);
    expect(di.input.questions.map(q => q.sourceLocators[0])).toMatchObject([
      { table: 0, row: 1, cell: 0 },
      { table: 1, row: 1, cell: 0 },
    ]);
    const block = source(
      docxFixture([{ paragraph: 'ID: block-1\nQuestion: Are backups tested?\nResponse:' }]),
      'blocks.docx',
    );
    const bm = tableMapping(
      block,
      [
        {
          regionId: 'paragraph:0',
          startRow: 0,
          endRow: 0,
          fields: { question: 0 },
          answerType: 'boolean',
          answerConstraints: {
            options: [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ],
          },
        },
      ],
      [],
      'docx.blocks.v1',
    );
    expect((await coordinator.import(block, bm, operator, context())).input.questions[0]).toMatchObject({
      id: 'block-1',
      originalText: 'Are backups tested?',
      sourceLocators: [{ kind: 'docx.paragraph', paragraph: 0 }],
    });
    const separate = source(
      xlsxFixture([
        {
          name: 'Selections',
          rows: [
            ['ID', 'Prompt', 'Yes', 'No', 'N/A'],
            ['separate-1', 'Is MFA required?', '', '', ''],
          ],
        },
      ]),
    );
    const sm = tableMapping(
      separate,
      [
        {
          regionId: 'sheet:0',
          startRow: 1,
          endRow: 1,
          fields: { id: 0, question: 1, yes: 2, no: 3, not_applicable: 4 },
          answerType: 'boolean',
          answerConstraints: {
            options: [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
              { value: 'not_applicable', label: 'N/A' },
            ],
          },
        },
      ],
      [{ regionId: 'sheet:0', startRow: 0, endRow: 0, reason: 'Header' }],
    );
    expect(
      (await coordinator.import(separate, sm, operator, context())).input.questions[0]!.responseTargets?.map(
        t => t.role,
      ),
    ).toEqual(['yes', 'no', 'not_applicable']);
  }, 30_000);
  it('rejects_unsupported_ambiguous_and_oversized_inputs_without_silent_omissions', async () => {
    const coordinator = new IntakeCoordinator();
    const s = source(
      xlsxFixture([
        {
          name: 'Unmapped',
          rows: [
            ['Unusual ID', 'Unusual prompt'],
            ['Q-1', 'Is MFA required?'],
          ],
        },
      ]),
    );
    const inspection = await coordinator.inspect(s, context());
    expect(inspection.status).toBe('needs_mapping');
    expect(inspection.mappingCandidates).toHaveLength(0);
    await expect(
      coordinator.import(
        s,
        tableMapping(s, [{ regionId: 'sheet:0', startRow: 1, endRow: 1, fields: { id: 0, question: 1 } }]),
        operator,
        context(),
      ),
    ).rejects.toMatchObject({ code: 'UNACCOUNTED_CONTENT' });
    const malformed = source(new Uint8Array([80, 75, 3, 4]));
    expect((await coordinator.inspect(malformed, context())).diagnostics[0]?.code).toBe('CORRUPT_FILE');
    const sample = source(xlsxFixture([{ name: 'Review', rows: questionnaireRows() }]));
    await expect(coordinator.inspect(sample, context({ maxBytes: sample.sizeBytes - 1 }))).rejects.toMatchObject({
      code: 'LIMIT_EXCEEDED',
    });
    expect((await coordinator.inspect(sample, context({ maxEntries: 1 }))).diagnostics[0]?.code).toBe('LIMIT_EXCEEDED');
    expect((await coordinator.inspect(sample, context({ maxTextChars: 20 }))).diagnostics[0]?.code).toBe(
      'LIMIT_EXCEEDED',
    );
    const sampleMapping = (await coordinator.inspect(sample, context())).mappingCandidates[0]!;
    await expect(
      coordinator.import(sample, sampleMapping, operator, context({ maxQuestions: 2 })),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    await expect(
      coordinator.import(sample, sampleMapping, operator, context({ maxQuestionChars: 4 })),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    const inflated = dishonestExpandedSizes(addZipMember(sample.bytes, 'padding.txt', 'X'.repeat(200_000)));
    expect(
      (await new IntakeCoordinator().inspect(source(inflated), context({ maxExpandedBytes: 20_000 }))).diagnostics[0]
        ?.code,
    ).toBe('LIMIT_EXCEEDED');
    for (const [name, transform] of [
      ['xl/worksheets/sheet1.xml', (xml: string) => xml.replace('<sheetData>', '<drawing r:id="unsafe"/><sheetData>')],
      ['xl/worksheets/sheet1.xml', (xml: string) => '<!DOCTYPE worksheet [<!ENTITY attack "expanded">]>' + xml],
      ['xl/worksheets/sheet1.xml', () => '<worksheet><broken></worksheet>'],
    ] as const) {
      const bad = source(alterZip(sample.bytes, name, transform));
      expect((await coordinator.inspect(bad, context())).status).toBe('rejected');
    }
    expect(
      (await coordinator.inspect(source(addZipMember(sample.bytes, '../outside.xml', 'bad')), context())).diagnostics[0]
        ?.code,
    ).toBe('UNSUPPORTED_LAYOUT');
    expect(
      (await coordinator.inspect(source(addZipMember(sample.bytes, 'xl/vbaProject.bin', 'macro')), context()))
        .diagnostics[0]?.code,
    ).toBe('UNSUPPORTED_LAYOUT');
    const ordinaryType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
    const macroType = 'application/vnd.ms-excel.sheet.macroEnabled.main+xml';
    const binaryType = 'application/vnd.ms-excel.sheet.binary.macroEnabled.main';
    const withDeclaration = (declaration: string) =>
      alterZip(sample.bytes, '[Content_Types].xml', xml => xml.replace('</Types>', `${declaration}</Types>`));
    const withRelationship = (relationship: string) =>
      alterZip(sample.bytes, 'xl/_rels/workbook.xml.rels', xml =>
        xml.replace('</Relationships>', `${relationship}</Relationships>`),
      );
    const unsafePackages = [
      {
        name: 'macro workbook type',
        bytes: alterZip(sample.bytes, '[Content_Types].xml', xml => xml.replace(ordinaryType, macroType)),
        code: 'UNSUPPORTED_FORMAT',
      },
      {
        name: 'binary main part',
        bytes: alterZip(
          addZipMember(
            withDeclaration(`<Override PartName="/xl/workbook.bin" ContentType="${binaryType}"/>`),
            'xl/workbook.bin',
            'binary workbook',
          ),
          '_rels/.rels',
          xml => xml.replace('xl/workbook.xml', 'xl/workbook.bin'),
        ),
        code: 'UNSUPPORTED_FORMAT',
      },
      {
        name: 'default binds to a present binary part',
        bytes: addZipMember(
          withDeclaration(`<Default Extension="bin" ContentType="${binaryType}"/>`),
          'xl/payload.bin',
          'binary payload',
        ),
        code: 'UNSUPPORTED_FORMAT',
      },
      {
        name: 'VBA type under an ordinary part name',
        bytes: addZipMember(
          withDeclaration('<Override PartName="/xl/payload.xml" ContentType="application/vnd.ms-office.vbaProject"/>'),
          'xl/payload.xml',
          '<payload/>',
        ),
        code: 'UNSUPPORTED_FORMAT',
      },
      {
        name: 'VBA relationship under an ordinary target name',
        bytes: withRelationship(
          '<Relationship Id="macro" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="worksheets/sheet1.xml"/>',
        ),
        code: 'UNSUPPORTED_LAYOUT',
      },
      {
        name: 'embedded object relationship',
        bytes: withRelationship(
          '<Relationship Id="embedded" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject" Target="worksheets/sheet1.xml"/>',
        ),
        code: 'UNSUPPORTED_LAYOUT',
      },
      {
        name: 'entity-encoded external relationship',
        bytes: withRelationship(
          '<Relationship Id="remote" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid/" TargetMode="&#69;xternal"/>',
        ),
        code: 'UNSUPPORTED_LAYOUT',
      },
      {
        name: 'conflicting workbook overrides',
        bytes: withDeclaration(`<Override PartName="/xl/workbook.xml" ContentType="${macroType}"/>`),
        code: 'UNSUPPORTED_LAYOUT',
      },
      {
        name: 'ambiguous unused defaults',
        bytes: withDeclaration(
          `<Default Extension="bin" ContentType="${binaryType}"/><Default Extension="BIN" ContentType="application/octet-stream"/>`,
        ),
        code: 'UNSUPPORTED_LAYOUT',
      },
      {
        name: 'contradictory workbook identity',
        bytes: alterZip(sample.bytes, '[Content_Types].xml', xml => xml.replace(ordinaryType, 'application/xml')),
        code: 'FORMAT_MISMATCH',
      },
      {
        name: 'contradictory main relationship',
        bytes: alterZip(sample.bytes, '_rels/.rels', xml => xml.replace('xl/workbook.xml', 'xl/worksheets/sheet1.xml')),
        code: 'FORMAT_MISMATCH',
      },
      {
        name: 'ambiguous main relationships',
        bytes: alterZip(sample.bytes, '_rels/.rels', xml =>
          xml.replace(
            '</Relationships>',
            '<Relationship Id="second" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
          ),
        ),
        code: 'FORMAT_MISMATCH',
      },
      {
        name: 'content type entity declaration',
        bytes: alterZip(
          sample.bytes,
          '[Content_Types].xml',
          xml => '<!DOCTYPE Types [<!ENTITY type "expanded">]>' + xml,
        ),
        code: 'UNSUPPORTED_LAYOUT',
      },
    ];
    for (const unsafe of unsafePackages) {
      const inspected = await coordinator.inspect(source(unsafe.bytes), context());
      expect(inspected.status, unsafe.name).toBe('rejected');
      expect(inspected.diagnostics[0]?.code, unsafe.name).toBe(unsafe.code);
      expect(inspected.mappingCandidates, unsafe.name).toEqual([]);
    }
    const merged = source(
      xlsxFixture([
        { name: 'Merged', rows: questionnaireRows(), extraXml: '<mergeCells><mergeCell ref="B2:C2"/></mergeCells>' },
      ]),
    );
    const mi = await coordinator.inspect(merged, context());
    await expect(coordinator.import(merged, mi.mappingCandidates[0]!, operator, context())).rejects.toMatchObject({
      code: 'UNSUPPORTED_LAYOUT',
    });
    const duplicateRows = questionnaireRows();
    duplicateRows[2]![0] = duplicateRows[1]![0]!;
    const duplicates = source(xlsxFixture([{ name: 'Duplicates', rows: duplicateRows }]));
    const dup = (await coordinator.inspect(duplicates, context())).mappingCandidates[0]!;
    await expect(coordinator.import(duplicates, dup, operator, context())).rejects.toMatchObject({
      code: 'DUPLICATE_QUESTION_ID',
    });
    const unsupported = source(
      alterZip(docxFixture([{ table: questionnaireRows() }]), 'word/document.xml', xml =>
        xml.replace('<w:tc>', '<w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr>'),
      ),
      'merged.docx',
    );
    const ui = await coordinator.inspect(unsupported, context());
    await expect(coordinator.import(unsupported, ui.mappingCandidates[0]!, operator, context())).rejects.toMatchObject({
      code: 'UNSUPPORTED_LAYOUT',
    });
    const additional =
      '<w:customXml w:element="question" w:uri="urn:questions"><w:p><w:r><w:t>Additional required question: Are backups tested?</w:t></w:r></w:p></w:customXml>';
    const unsupportedContainers = [
      docxFixture([{ table: questionnaireRows() }], additional),
      alterZip(docxFixture([{ table: questionnaireRows() }]), 'word/document.xml', xml =>
        xml.replace('<w:tc>', `<w:tc>${additional}`),
      ),
      alterZip(docxFixture([{ table: questionnaireRows() }]), 'word/document.xml', xml =>
        xml.replace('<w:r>', `<w:r><w:sym w:font="Wingdings" w:char="F0FC"/>`),
      ),
      alterZip(docxFixture([{ table: questionnaireRows() }]), 'word/document.xml', xml =>
        xml.replace('<w:p>', `<w:p>${additional}`),
      ),
    ];
    for (const bytes of unsupportedContainers) {
      const doc = source(bytes, 'unsupported.docx');
      const inspected = await coordinator.inspect(doc, context());
      expect(inspected.status).toBe('rejected');
      expect(inspected.diagnostics[0]?.code).toBe('UNSUPPORTED_LAYOUT');
      const mapping = tableMapping(
        doc,
        [
          {
            regionId: 'table:0',
            startRow: 1,
            endRow: 24,
            fields: { id: 0, question: 1, type: 2, options: 3, section: 4, instructions: 5, response: 6 },
          },
        ],
        [{ regionId: 'table:0', startRow: 0, endRow: 0, reason: 'Header' }],
      );
      await expect(coordinator.import(doc, mapping, operator, context())).rejects.toMatchObject({
        code: 'UNSUPPORTED_LAYOUT',
      });
      const normalized = await officeAdapter('docx').normalize(doc, mapping, context());
      expect(normalized.status).toBe('rejected');
      expect(normalized.questions).toEqual([]);
    }
  }, 30_000);
  it('rejects_format_mismatch_and_cancelled_or_failed_parsing', async () => {
    const coordinator = new IntakeCoordinator();
    const bytes = docxFixture([{ table: questionnaireRows() }]);
    expect((await coordinator.inspect(source(bytes, 'pretends.xlsx'), context())).diagnostics[0]?.code).toBe(
      'FORMAT_MISMATCH',
    );
    await expect(
      coordinator.inspect({ ...source(bytes, 'real.docx'), mediaType: 'application/pdf' }, context()),
    ).rejects.toMatchObject({ code: 'FORMAT_MISMATCH' });
    await expect(coordinator.inspect(source(bytes, 'older.doc'), context())).rejects.toMatchObject({
      code: 'UNSUPPORTED_FORMAT',
    });
    // The same catalog serves isolated workers, with explicit capabilities per format.
    const unsupportedRequests = [
      { input: source(bytes, 'real.docx'), format: 'docx', mode: 'evidence' as const },
      { input: source(pdfFixture(['Policy text']), 'policy.pdf'), format: 'pdf', mode: 'questionnaire' as const },
      {
        input: source(new TextEncoder().encode('{"policy":"original text"}'), 'policy.json'),
        format: 'json',
        mode: 'questionnaire' as const,
      },
      { input: source(bytes, 'unknown.bin'), format: 'unknown', mode: 'evidence' as const },
    ];
    for (const request of unsupportedRequests)
      await expect(runParser(request.input, request.format, request.mode, context())).rejects.toMatchObject({
        code: 'UNSUPPORTED_FORMAT',
      });
    const extracted = await runParser<Array<{ text: string; locator: Record<string, string | number> }>>(
      source(new TextEncoder().encode('{"policy":"original text"}'), 'policy.json'),
      'json',
      'evidence',
      context(),
    );
    expect(extracted).toEqual([{ text: 'original text', locator: { kind: 'json.pointer', pointer: '/policy' } }]);
    const s = source(xlsxFixture([{ name: 'Review', rows: questionnaireRows() }]));
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(coordinator.inspect(s, context({}, cancelled.signal))).rejects.toMatchObject({ code: 'CANCELLED' });
    const running = new AbortController();
    const parsing = runParser(s, 'xlsx', 'questionnaire', context({}, running.signal));
    setTimeout(() => running.abort(), 0);
    await expect(parsing).rejects.toMatchObject({ code: 'CANCELLED' });
    await expect(runParser(s, 'xlsx', 'questionnaire', context({ timeoutMs: 1 }))).rejects.toMatchObject({
      code: 'LIMIT_EXCEEDED',
    });
    await expect(
      runParser(source(new TextEncoder().encode('{broken'), 'bad.json'), 'json', 'evidence', context()),
    ).rejects.toMatchObject({ code: 'PARSER_FAILED' });
    const encrypted = source(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]));
    expect((await coordinator.inspect(encrypted, context())).diagnostics[0]?.code).toBe('ENCRYPTED_FILE');
  }, 30_000);
  it('rejects_stale_mapping_and_preserves_untrusted_prefilled_answers', async () => {
    let bytes = xlsxFixture([{ name: 'Review', rows: questionnaireRows() }]);
    bytes = alterZip(bytes, 'xl/worksheets/sheet1.xml', xml =>
      xml.replace(/<c r="G2"[\s\S]*?<\/c>/, '<c r="G2"><f>IF(1=1,"cached","other")</f><v>cached</v></c>'),
    );
    const s = source(bytes);
    const coordinator = new IntakeCoordinator();
    const mapping = (await coordinator.inspect(s, context())).mappingCandidates[0]!;
    const imported = await coordinator.import(s, mapping, operator, context());
    expect(imported.input.questions[0]!.untrustedExistingResponse?.[0]).toMatchObject({
      text: 'cached',
      formulaLiteral: '=IF(1=1,"cached","other")',
      locator: { kind: 'xlsx.cell', cell: 'G2' },
    });
    expect(imported.input.questions[0]).not.toHaveProperty('approvedAnswer');
    const changed = source(
      alterZip(s.bytes, 'xl/worksheets/sheet1.xml', xml =>
        xml.replace('documented information security policy', 'documented revised policy'),
      ),
    );
    await expect(coordinator.import(changed, mapping, operator, context())).rejects.toMatchObject({
      code: 'SOURCE_CHANGED',
    });
    const semantic = source(
      alterZip(s.bytes, 'xl/worksheets/sheet1.xml', xml =>
        xml.replace(/<c r="B2"[\s\S]*?<\/c>/, '<c r="B2"><f>"Injected question"</f><v>Injected question</v></c>'),
      ),
    );
    const sm = (await coordinator.inspect(semantic, context())).mappingCandidates[0]!;
    await expect(coordinator.import(semantic, sm, operator, context())).rejects.toMatchObject({
      code: 'FORMULA_NOT_ALLOWED',
    });
  }, 30_000);
  it('registered_future_adapter_produces_canonical_workflow_input', async () => {
    const bytes = docxFixture([{ table: questionnaireRows() }]),
      custom = source(bytes, 'fixture.testdocx');
    const adapter = futureAdapter();
    const coordinator = new IntakeCoordinator([adapter]);
    const result = await autoImport(custom, coordinator);
    const standard = await autoImport(source(bytes, 'fixture.docx'));
    expect(result.input.questions.map(comparable)).toEqual(standard.input.questions.map(comparable));
    expect(result.input.inputProvenance).toMatchObject({
      adapterKey: 'test-docx-package',
      adapterVersion: '2.0.0',
      profile: 'test.docx.table.v1',
    });
    expect(result.input.questions[0]!.sourceLocators[0]).toMatchObject({
      kind: 'docx.table_cell',
      part: 'word/document.xml',
      table: 0,
      row: 1,
      cell: 1,
    });
    await expect(new IntakeCoordinator().inspect(custom, context())).rejects.toMatchObject({
      code: 'UNSUPPORTED_FORMAT',
    });
    await expect(
      coordinator.import({ ...custom, sha256: '0'.repeat(64) }, result.mapping, operator, context()),
    ).rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
  }, 30_000);
  it('rejects_nonconforming_adapter_results_before_agent_processing', async () => {
    const s = source(docxFixture([{ table: questionnaireRows() }]), 'fixture.testdocx');
    const mutations: Array<(n: NormalizationResult) => NormalizationResult> = [
      n => ({
        ...n,
        questions: n.questions.map((_, index) => ({
          ...n.questions[0]!,
          id: `forged-${index}`,
          originalQuestionId: undefined,
          order: index,
        })),
      }),
      n => ({ ...n, questions: [...n.questions].reverse().map((q, order) => ({ ...q, order })) }),
      n => ({
        ...n,
        questions: n.questions.map(q => ({ ...q, id: `forged-${q.order}`, originalQuestionId: undefined })),
      }),
      n => ({
        ...n,
        questions: n.questions.slice(0, 1),
        coverage: { ...n.coverage, discoveredCandidates: 2, emittedQuestions: 1 },
      }),
      n => ({
        ...n,
        questions: n.questions.map((q, i) =>
          i ? q : { ...q, originalText: 'Invented source statement', normalizedText: 'Invented source statement' },
        ),
      }),
      n => ({
        ...n,
        questions: n.questions.map((q, i) =>
          i
            ? q
            : {
                ...q,
                sourceLocators: [
                  {
                    kind: 'docx.table_cell',
                    part: 'word/document.xml',
                    table: 0,
                    row: 999,
                    cell: 1,
                    sourceId: s.sourceId,
                    sourceSha256: s.sha256,
                  },
                ],
              },
        ),
      }),
      n => ({
        ...n,
        questions: n.questions.map((q, i) =>
          i ? q : { ...q, sourceLocators: q.sourceLocators.map(l => ({ ...l, sourceId: 'foreign' })) },
        ),
      }),
      n => ({ ...n, questions: n.questions.map((q, i) => (i ? q : ({ ...q, approved: true } as CanonicalQuestion))) }),
      n => ({ ...n, coverage: { ...n.coverage, excludedRegions: [] } }),
    ];
    for (const mutation of mutations) {
      const coordinator = new IntakeCoordinator([futureAdapter(mutation)]);
      const inspected = await coordinator.inspect(s, context());
      await expect(coordinator.import(s, inspected.mappingCandidates[0]!, operator, context())).rejects.toBeDefined();
    }
    const cloned = new IntakeCoordinator([
      futureAdapter(n => ({
        ...n,
        questions: n.questions.map((_, index) => ({
          ...n.questions[0]!,
          id: `clone-${index}`,
          originalQuestionId: undefined,
          order: index,
        })),
      })),
    ]);
    const cloneInspection = await cloned.inspect(s, context());
    await expect(cloned.import(s, cloneInspection.mappingCandidates[0]!, operator, context())).rejects.toMatchObject({
      code: 'UNACCOUNTED_CONTENT',
    });
    for (const rows of [
      [0],
      [0, 0, ...Array.from({ length: 23 }, (_, i) => i + 2)],
      Array.from({ length: 25 }, (_, i) => i + 1),
    ]) {
      const forged = futureAdapter(),
        original = forged.inspect;
      forged.inspect = async (s, c) => {
        const inspected = await original(s, c);
        return { ...inspected, regions: inspected.regions.map(region => ({ ...region, candidateRows: rows })) };
      };
      await expect(new IntakeCoordinator([forged]).inspect(s, context())).rejects.toBeDefined();
    }
    const adapter = futureAdapter();
    const originalInspect = adapter.inspect;
    adapter.inspect = async (s, c) => ({ ...(await originalInspect(s, c)), adapterVersion: 'forged' });
    await expect(new IntakeCoordinator([adapter]).inspect(s, context())).rejects.toMatchObject({
      code: 'INVALID_MAPPING',
    });
    const authoritative = futureAdapter();
    const normalize = authoritative.normalize;
    authoritative.normalize = async (s, m, c) =>
      ({ ...(await normalize(s, m, c)), organizationId: 'attacker' }) as NormalizationResult;
    const ac = new IntakeCoordinator([authoritative]);
    const ai = await ac.inspect(s, context());
    await expect(ac.import(s, ai.mappingCandidates[0]!, operator, context())).rejects.toBeDefined();
    const malformed = futureAdapter();
    const inspect = malformed.inspect;
    malformed.inspect = async (s, c) => ({ ...(await inspect(s, c)), sourceSha256: 'f'.repeat(64) }) as InputInspection;
    await expect(new IntakeCoordinator([malformed]).inspect(s, context())).rejects.toMatchObject({
      code: 'INVALID_MAPPING',
    });
    const strict = futureAdapter();
    expect(
      strict.mappingValidator.safeParse({
        ...tableMapping(source(docxFixture([{ table: questionnaireRows() }]), 'real.docx'), [
          { regionId: 'table:0', startRow: 1, endRow: 24, fields: { question: 1 } },
        ]),
        profile: 'test.docx.table.v1',
        adapterKey: 'test-docx-package',
        adapterVersion: '2.0.0',
        arbitraryModule: './malicious',
      }).success,
    ).toBe(false);
  }, 30_000);
  it('keeps_question_identity_stable_on_replay_and_versions_adapter_provenance', async () => {
    const s = source(
      xlsxFixture([{ name: 'Unidentified', rows: [['Prompt'], ['Is MFA required?'], ['Is MFA required?']] }]),
    );
    const mapping = tableMapping(
      s,
      [{ regionId: 'sheet:0', startRow: 1, endRow: 2, fields: { question: 0 }, answerType: 'free_text' }],
      [{ regionId: 'sheet:0', startRow: 0, endRow: 0, reason: 'Header' }],
    );
    const coordinator = new IntakeCoordinator();
    const first = await coordinator.import(s, mapping, operator, context()),
      second = await coordinator.import(s, mapping, operator, context());
    expect(first.input).toEqual(second.input);
    expect(first.input.questions[0]!.id).not.toBe(first.input.questions[1]!.id);
    expect(first.input.inputProvenance.mappingDigest).toBe(sha256(canonicalJson(mapping)));
    const store = await openIntakeStore(`file:${resolve(root, 'intake.db')}`);
    const runId = "run'); DROP TABLE vrq_intakes; --";
    await store.persistIntake(runId, first.input, mapping, s);
    await expect(store.persistIntake(runId, second.input, mapping, s)).resolves.toMatchObject({ runId });
    await expect(
      store.persistIntake(runId, { ...first.input, title: 'Conflicting revision' }, mapping, s),
    ).rejects.toThrow('different intake');
    await expect(store.persistIntake('foreign', first.input, mapping, { ...s, sourceId: 'foreign' })).rejects.toThrow(
      'binding mismatch',
    );
    store.close();
    const reopened = await openIntakeStore(`file:${resolve(root, 'intake.db')}`);
    try {
      const stored = await reopened.readIntake(runId);
      expect(stored?.input).toEqual(first.input);
      expect(stored?.mapping).toEqual(mapping);
      expect(sha256(new Uint8Array(stored!.sourceBytes as ArrayBuffer))).toBe(s.sha256);
      expect(await reopened.readIntake('foreign')).toBeUndefined();
    } finally {
      reopened.close();
    }
    const changedMapping = { ...mapping, adapterVersion: '2.0.0' };
    await expect(coordinator.import(s, changedMapping, operator, context())).rejects.toMatchObject({
      code: 'INVALID_MAPPING',
    });
    const path = resolve(root, 'original.xlsx');
    await writeFile(path, s.bytes);
    await copyFile(path, resolve(root, 'unchanged.xlsx'));
    expect(await readFile(path)).toEqual(Buffer.from(s.bytes));
  }, 30_000);
});

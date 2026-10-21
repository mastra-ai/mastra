import { it, expect, beforeEach, afterEach } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { temporaryDirectory, cleanupDirectory, alterZip, addZipMember } from '../fixtures/support.ts';
import { documentFixture } from '../support/completion.ts';
import { draftingFixture } from '../support/drafting.ts';
import { screenRetainedPackage, writeDocument } from '../../src/mastra/completion/document.ts';
import { withExcelFormatting } from '../fixtures/excel-formatting.ts';

let root: string;
beforeEach(async () => {
  root = await temporaryDirectory();
});
afterEach(async () => {
  await cleanupDirectory(root);
});
it('preserves_excel_save_metadata_and_column_widths_while_screening_displayed_text', async () => {
  const evidence = (await draftingFixture(root)).snapshot.record;
  const f = await documentFixture('xlsx', withExcelFormatting);
  const plan = await f.plan();
  const output = writeDocument(f.bytes, plan, f.projection);
  await screenRetainedPackage(f.bytes, 'xlsx', evidence);
  await screenRetainedPackage(output, 'xlsx', evidence);
  const before = unzipSync(f.bytes),
    after = unzipSync(output);
  for (const part of Object.keys(before).filter(part => part !== 'xl/worksheets/sheet1.xml'))
    expect(after[part]).toEqual(before[part]);
  expect(strFromU8(after['xl/worksheets/sheet1.xml']!)).toContain('width="32" customWidth="1"');
  for (const [part, transform] of [
    ['xl/workbook.xml', (s: string) => s.replace('/workbooks/', 'sk-proj-ATTRIBUTECANARY01234567890123456789')],
    [
      'xl/theme/theme1.xml',
      (s: string) => s.replace('02050302040000000000', 'sk-proj-PANOSECANARY01234567890123456789'),
    ],
    ['xl/styles.xml', (s: string) => s.replace('0.79998168889431442', 'sk-proj-TINTCANARY01234567890123456789')],
    [
      'xl/sharedStrings.xml',
      (s: string) => s.replace('Describe workforce access controls.', 'sk-proj-SHAREDCANARY01234567890123456789'),
    ],
    ['xl/sharedStrings.xml', (s: string) => s.replace('Describe workforce access controls.', '123456789012')],
    ['xl/worksheets/sheet1.xml', (s: string) => s.replace('</worksheet>', '<!--123456789012--></worksheet>')],
    ['xl/styles.xml', (s: string) => s.replace('<font>', '<font custom="123456789012">')],
  ] as const)
    await expect(screenRetainedPackage(alterZip(f.bytes, part, transform), 'xlsx', evidence)).rejects.toThrow(
      'SECURITY_BLOCKED',
    );
  for (const [part, transform] of [
    ['xl/workbook.xml', (s: string) => s.replace('</mc:Choice>', '<xr:opaque>hidden</xr:opaque></mc:Choice>')],
    ['xl/styles.xml', (s: string) => s.replace('<font>', '<font xmlns:evil="urn:unknown" evil:uid="123456789012">')],
    ['xl/worksheets/sheet1.xml', (s: string) => s.replace('<v>0</v>', '<v>99999999</v>')],
    ['xl/worksheets/sheet1.xml', (s: string) => s.replace('<v>0</v>', '<v><hidden>0</hidden></v>')],
  ] as const)
    await expect(screenRetainedPackage(alterZip(f.bytes, part, transform), 'xlsx', evidence)).rejects.toThrow(
      'UNINSPECTABLE_PACKAGE_CONTENT',
    );
});

it('blocks_unsafe_original_content_and_preserves_explicit_gaps', async () => {
  const evidence = (await draftingFixture(root)).snapshot.record;
  for (const format of ['xlsx', 'docx'] as const) {
    const f = await documentFixture(format),
      plan = await f.plan();
    const p = {
      ...f.projection,
      quality: 'delivered_with_gaps' as const,
      supported: 0,
      evidence: [],
      answers: f.projection.answers.map(a => ({
        ...a,
        disposition: 'withheld' as const,
        value: 'withheld' as const,
        text: '',
        limitations: [],
        citationIds: [],
        safeReason: 'Evidence is withheld.',
        responseOption: null,
      })),
    };
    const output = writeDocument(f.bytes, plan, p);
    await screenRetainedPackage(output, format, evidence);
    expect(
      Object.values(unzipSync(output))
        .map(v => strFromU8(v))
        .join(''),
    ).toContain('withheld');
    const unsafe = addZipMember(
      f.bytes,
      'docProps/custom.xml',
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property name="Note"><vt:lpwstr>sk-proj-RETAINEDCANARY01234567890123456789</vt:lpwstr></property></Properties>',
    );
    await expect(screenRetainedPackage(unsafe, format, evidence)).rejects.toThrow('SECURITY_BLOCKED');
  }
  const f = await documentFixture('xlsx');
  for (const value of [
    '<!--sk-proj-COMMENTCANARY01234567890123456789-->',
    '<sheetPr codeName="sk&#45;proj&#45;ATTRIBUTECANARY01234567890123456789"/>',
    '<extLst><extension><![CDATA[sk-proj-CDATACANARY01234567890123456789]]></extension></extLst>',
  ])
    await expect(
      screenRetainedPackage(
        alterZip(f.bytes, 'xl/worksheets/sheet1.xml', s => s.replace('</worksheet>', value + '</worksheet>')),
        'xlsx',
        evidence,
      ),
    ).rejects.toThrow('SECURITY_BLOCKED');
});
it('rejects_uninspectable_package_content', async () => {
  const fixture = await draftingFixture(root),
    evidence = fixture.snapshot.record,
    f = await documentFixture('xlsx');
  for (const [part, value] of [
    ['xl/unknown.xml', '<hidden>unknown payload</hidden>'],
    ['xl/media/image1.png', 'uninspectable binary'],
    ['docProps/custom.xml', `<Properties><payload>${'A'.repeat(256)}</payload></Properties>`],
    ['docProps/custom.xml', '<Properties><binData>secret encoded payload</binData></Properties>'],
    [
      'docProps/custom.xml',
      `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property><vt:lpwstr>${Buffer.from('sk-proj-ENCODEDCANARY01234567890123456789').toString('base64')}</vt:lpwstr></property></Properties>`,
    ],
    [
      'xl/worksheets/sheet1.xml',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:x="urn:unknown"><x:opaque>hidden</x:opaque></worksheet>',
    ],
  ])
    await expect(screenRetainedPackage(addZipMember(f.bytes, part!, value!), 'xlsx', evidence)).rejects.toThrow(
      'UNINSPECTABLE_PACKAGE_CONTENT',
    );
});
it('writes_formula_like_answers_as_literal_strings', async () => {
  const evidence = (await draftingFixture(root)).snapshot.record,
    f = await documentFixture('xlsx'),
    plan = await f.plan();
  const value = '\t =HYPERLINK("https://example.test","execute") <script>alert(1)</script>';
  const projection = { ...f.projection, answers: f.projection.answers.map(a => ({ ...a, text: value })) };
  const output = writeDocument(f.bytes, plan, projection);
  await screenRetainedPackage(output, 'xlsx', evidence);
  const sheet = strFromU8(unzipSync(output)['xl/worksheets/sheet1.xml']!);
  expect(sheet).toContain('t="inlineStr"');
  expect(sheet).toContain('=HYPERLINK(&quot;');
  expect(sheet).toContain('&lt;script&gt;');
  expect(sheet).not.toContain('<f>');
  expect(sheet).not.toContain('<hyperlink');
});

it('screens_technical_identifiers_with_the_same_content_rules', async () => {
  const { checkLocalContent } = await import('../../src/mastra/processing/local-filter.ts');
  await expect(checkLocalContent('review-123456789012', 'technical-id')).rejects.toMatchObject({
    code: 'SECURITY_BLOCKED',
  });
  await expect(checkLocalContent('review-hijklmnopqrs', 'technical-id')).resolves.toBeUndefined();
  await expect(checkLocalContent('sk-proj-CONTENTCANARY01234567890123456789', 'technical-id')).rejects.toMatchObject({
    code: 'SECURITY_BLOCKED',
  });
});

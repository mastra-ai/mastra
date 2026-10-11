import { parse } from 'csv-parse/sync';
import type { Projection } from '../contracts/review.ts';
import { projectionSchema } from '../contracts/review.ts';
import { artifactCatalog, artifactNames } from '../contracts/artifact.ts';
import { defaultLimits } from '../contracts/limits.ts';
import { parser as xlsxParser } from '../parsers/xlsx.ts';
import { openOfficePackage } from '../parsers/office-package.ts';
import { xml, all, attr } from '../parsers/xml.ts';
import { markdown, safeCsv, exportRows } from './render.ts';
import { pdfSections } from './pdf.ts';
import { canonicalJson } from '../intake/source.ts';
function safeElements(nodes: import('../parsers/xml.ts').XmlNode[], allowed: Set<string>) {
  for (const node of nodes)
    for (const [key, value] of Object.entries(node)) {
      if (key === ':@' || key === '#text' || key === '?xml') continue;
      if (!allowed.has(key) || !Array.isArray(value)) throw new Error('XLSX_ACTIVE_CONTENT');
      safeElements(value as import('../parsers/xml.ts').XmlNode[], allowed);
    }
}
function equal(actual: unknown, expected: unknown) {
  if (canonicalJson(actual) !== canonicalJson(expected)) throw new Error('ARTIFACT_CONTENT_MISMATCH');
}
async function validateXlsx(bytes: Buffer, p: Projection) {
  const entries = openOfficePackage(bytes, 'xlsx', defaultLimits);
  const workbook = xml(entries['xl/workbook.xml']!, defaultLimits);
  safeElements(workbook, new Set(['workbook', 'sheets', 'sheet']));
  if (entries['xl/sharedStrings.xml'])
    safeElements(xml(entries['xl/sharedStrings.xml'], defaultLimits), new Set(['sst', 'si', 't']));
  const parsed = await xlsxParser.parseQuestionnaire!(bytes, defaultLimits);
  const expected = exportRows(p);
  if (parsed.regions.length !== 2) throw new Error('XLSX_CONTENT_MISMATCH');
  const allowed = new Set([
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
    'xl/sharedStrings.xml',
  ]);
  for (const [i, region] of parsed.regions.entries()) {
    allowed.add(region.part);
    const sheet = xml(entries[region.part]!, defaultLimits);
    safeElements(sheet, new Set(['worksheet', 'sheetData', 'row', 'c', 'is', 't', 'v']));
    if (all(sheet, 'c').some(c => !['inlineStr', 's'].includes(attr(c, 't')))) throw new Error('XLSX_ACTIVE_CONTENT');
    const rows = i === 0 ? expected.questionnaire : expected.evidence;
    if (
      region.name !== (i === 0 ? 'Questionnaire' : 'Evidence') ||
      region.hidden ||
      region.hiddenRows?.length ||
      region.merges?.length ||
      region.rows.length !== rows.length ||
      all(xml(entries[region.part]!, defaultLimits), 'hyperlink').length
    )
      throw new Error('XLSX_CONTENT_MISMATCH');
    equal(
      region.rowIndices,
      rows.map((_, n) => n),
    );
    for (const [n, row] of region.rows.entries()) {
      if (row.length > rows[n]!.length || row.some(c => c?.formula)) throw new Error('XLSX_ACTIVE_CONTENT');
      equal(
        rows[n]!.map((_, col) => row[col]?.text ?? ''),
        rows[n],
      );
    }
  }
  if (Object.keys(entries).some(name => !allowed.has(name))) throw new Error('XLSX_UNEXPECTED_PART');
}
export async function validateBundleContent(files: Map<string, Buffer>, p: Projection) {
  equal([...files.keys()].sort(), [...artifactNames].sort());
  const rows = exportRows(p);
  for (const artifact of artifactCatalog) {
    const bytes = files.get(artifact.name)!;
    if (!bytes.length || bytes.length > defaultLimits.maxBytes) throw new Error('ARTIFACT_SIZE_LIMIT');
    switch (artifact.format) {
      case 'csv':
        equal(
          parse(bytes, { skip_empty_lines: false }),
          (artifact.role === 'evidence' ? rows.evidence : rows.questionnaire).map(row => row.map(safeCsv)),
        );
        break;
      case 'json':
        equal(projectionSchema.parse(JSON.parse(bytes.toString('utf8'))), p);
        break;
      case 'xlsx':
        await validateXlsx(bytes, p);
        break;
      case 'markdown': {
        // Compare safe headings/paragraphs in order, allowing line endings and blank-line spacing.
        const blocks = (v: string) =>
          v
            .replace(/\r\n/g, '\n')
            .trim()
            .split(/\n[ \t]*\n+/)
            .map(b => b.trim());
        equal(blocks(bytes.toString('utf8')), blocks(markdown(p)));
        break;
      }
      case 'pdf':
        await validatePdf(bytes, p);
        break;
    }
  }
}
async function validatePdf(bytes: Buffer, p: Projection) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true,
    verbosity: 0,
  });
  try {
    const doc = await task.promise;
    if (
      doc.numPages > 1000 ||
      (await doc.getJSActions()) ||
      (await doc.getAttachments()) ||
      (await doc.getFieldObjects()) ||
      (await doc.getOpenAction())
    )
      throw new Error('PDF_ACTIVE_CONTENT');
    let text = '';
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      if ((await page.getJSActions()) || (await page.getAnnotations()).length) throw new Error('PDF_ACTIVE_CONTENT');
      const content = await page.getTextContent();
      for (const item of content.items) {
        if ('str' in item) {
          text += item.str;
          if (
            item.transform[4] < 47 ||
            item.transform[4] + item.width > 548 ||
            item.transform[5] < 40 ||
            item.transform[5] > 803
          )
            throw new Error('PDF_UNREADABLE_LAYOUT');
        }
      }
    }
    const normalize = (v: string) => v.normalize('NFC').replace(/\s/g, '');
    if (
      normalize(text) !==
      normalize(
        pdfSections(p)
          .map(s => s.text)
          .join(''),
      )
    )
      throw new Error('PDF_CONTENT_MISMATCH');
  } finally {
    await task.destroy();
  }
}

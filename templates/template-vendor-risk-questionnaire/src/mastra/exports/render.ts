import { zipSync, strToU8 } from 'fflate';
import type { Projection } from '../contracts/review.ts';

export const escapeXml = (v: string) =>
  v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
export const escapeMarkdown = (v: string) =>
  v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_{}\[\]()#+.!|~-])/g, '\\$1')
    .replace(/:/g, '&#58;')
    .replace(/\r?\n/g, '<br>');
// Leading whitespace and control characters do not prevent spreadsheet formula interpretation.
export const safeCsv = (v: string) => (/^[\s\u0000-\u001f]*[=+@-]/.test(v) ? `'${v}` : v);
export function exportRows(p: Projection) {
  return {
    questionnaire: [
      [
        'Question ID',
        'Order',
        'Question',
        'Disposition',
        'Value',
        'Response',
        'Response option',
        'Limitations',
        'Safe reason',
        'Citations',
      ],
      ...p.answers.map(a => [
        a.questionId,
        String(a.order),
        a.question,
        a.disposition,
        a.value,
        a.text,
        a.responseOption ?? '',
        a.limitations.join(' | '),
        a.safeReason,
        a.citationIds.join(' | '),
      ]),
    ],
    evidence: [
      ['Citation ID', 'Document ID', 'Public label', 'Version', 'SHA256', 'Locator', 'Supporting excerpt'],
      ...p.evidence.map(e => [e.id, e.documentId, e.label, e.version, e.sourceSha256, e.locator, e.supportingExcerpt]),
    ],
  };
}
export function csv(rows: string[][]) {
  return rows.map(r => r.map(v => `"${safeCsv(v).replace(/"/g, '""')}"`).join(',')).join('\r\n') + '\r\n';
}
function column(i: number) {
  let n = i + 1,
    s = '';
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function worksheet(rows: string[][]) {
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => `<c r="${column(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
}
export function xlsx(p: Projection) {
  const rows = exportRows(p),
    files: Record<string, Uint8Array> = {};
  const add = (path: string, text: string) => (files[path] = strToU8(text));
  add(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  );
  add(
    '_rels/.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  );
  add(
    'xl/workbook.xml',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Questionnaire" sheetId="1" r:id="rId1"/><sheet name="Evidence" sheetId="2" r:id="rId2"/></sheets></workbook>',
  );
  add(
    'xl/_rels/workbook.xml.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
  );
  add('xl/worksheets/sheet1.xml', worksheet(rows.questionnaire));
  add('xl/worksheets/sheet2.xml', worksheet(rows.evidence));
  return Buffer.from(zipSync(files));
}
export function markdown(p: Projection) {
  const esc = escapeMarkdown;
  return (
    `# Completed questionnaire\n\nQuality: ${p.quality}; supported: ${p.supported}/${p.total}\n\nApproval: ${esc(p.approvalId)}; revision: ${p.revision}\n\n` +
    p.answers
      .map(
        a =>
          `## ${esc(a.questionId)}\n\n${esc(a.question)}\n\nDisposition: ${a.disposition}; value: ${a.value}\n\nResponse option: ${esc(a.responseOption ?? '')}\n\n${esc(a.text)}\n\nReason: ${esc(a.safeReason)}\n\nLimitations: ${a.limitations.map(esc).join('; ')}\n\nCitations: ${a.citationIds.map(esc).join('; ')}\n`,
      )
      .join('\n') +
    '\n# Releasable evidence\n\n' +
    p.evidence
      .map(
        e =>
          `## ${esc(e.id)}\n\n${esc(e.label)}; version ${esc(e.version)}; document ${esc(e.documentId)}\n\nSHA256: ${e.sourceSha256}\n\n${esc(e.locator)}\n\n${esc(e.supportingExcerpt)}\n`,
      )
      .join('\n')
  );
}

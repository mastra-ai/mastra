import { zipSync, strToU8 } from 'fflate';

export function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const column = (index: number) => {
  let s = '';
  for (index++; index > 0; index = Math.floor((index - 1) / 26)) s = String.fromCharCode(65 + ((index - 1) % 26)) + s;
  return s;
};
export function xlsxFixture(
  sheets: Array<{ name: string; rows: string[][]; hidden?: boolean; extraXml?: string }>,
): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const put = (p: string, s: string) => (files[p] = strToU8(s));
  put(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheets
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join('') +
      '</Types>',
  );
  put(
    '_rels/.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  );
  put(
    'xl/workbook.xml',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets
        .map(
          (s, i) =>
            `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"${s.hidden ? ' state="hidden"' : ''}/>`,
        )
        .join('') +
      '</sheets></workbook>',
  );
  put(
    'xl/_rels/workbook.xml.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join('') +
      '</Relationships>',
  );
  for (const [i, s] of sheets.entries())
    put(
      `xl/worksheets/sheet${i + 1}.xml`,
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
        s.rows
          .map(
            (row, ri) =>
              `<row r="${ri + 1}">` +
              row
                .map(
                  (v, ci) =>
                    `<c r="${column(ci)}${ri + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`,
                )
                .join('') +
              '</row>',
          )
          .join('') +
        '</sheetData>' +
        (s.extraXml ?? '') +
        '</worksheet>',
    );
  return zipSync(files);
}
export function docxFixture(body: Array<{ table: string[][] } | { paragraph: string }>, extraXml = ''): Uint8Array {
  const p = (s: string) =>
    '<w:p><w:r><w:t xml:space="preserve">' +
    escapeXml(s).replace(/\n/g, '</w:t><w:br/><w:t xml:space="preserve">') +
    '</w:t></w:r></w:p>';
  const document =
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    body
      .map(b =>
        'table' in b
          ? '<w:tbl>' +
            b.table.map(row => '<w:tr>' + row.map(c => '<w:tc>' + p(c) + '</w:tc>').join('') + '</w:tr>').join('') +
            '</w:tbl>'
          : p(b.paragraph),
      )
      .join('') +
    extraXml +
    '<w:sectPr/></w:body></w:document>';
  return zipSync({
    '[Content_Types].xml': strToU8(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    'word/document.xml': strToU8(document),
  });
}
export function pdfFixture(
  lines: string[],
  options: { catalog?: string; page?: string; pageCount?: number } = {},
): Uint8Array {
  const stream =
    'BT /F1 10 Tf 50 780 Td ' +
    lines
      .map(
        (line, i) =>
          (i ? '0 -16 Td ' : '') + `(${line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')}) Tj`,
      )
      .join('\n') +
    ' ET';
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R ${options.catalog ?? ''} >>`,
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R ${options.page ?? ''} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  const pageCount = options.pageCount ?? 1;
  for (let i = 1; i < pageCount; i++) {
    const next = objects.length + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents ${next + 1} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    );
  }
  objects[1] = `<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, i) => `${i === 0 ? 3 : 6 + (i - 1) * 2} 0 R`).join(' ')}] /Count ${pageCount} >>`;
  let s = '%PDF-1.7\n';
  const offsets = [0];
  for (const [i, o] of objects.entries()) {
    offsets.push(Buffer.byteLength(s));
    s += `${i + 1} 0 obj\n${o}\nendobj\n`;
  }
  const xref = Buffer.byteLength(s);
  s +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map(o => `${String(o).padStart(10, '0')} 00000 n \n`)
      .join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(s);
}

import PDFDocument from 'pdfkit';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { Projection } from '../contracts/review.ts';

const require = createRequire(import.meta.url);
// PDFKit's documented font engine is a transitive dependency, not another template dependency.
const fontkit = createRequire(require.resolve('pdfkit'))('fontkit') as {
  create(bytes: Buffer): { hasGlyphForCodePoint(point: number): boolean };
};
const subsets = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'greek', 'greek-ext', 'devanagari', 'vietnamese'];
export function pdfSections(p: Projection) {
  const sections: Array<{ text: string; size: number; pageBreak?: boolean }> = [
    { text: 'Completed questionnaire', size: 20 },
    { text: `Quality: ${p.quality} | Supported: ${p.supported}/${p.total}`, size: 10 },
    { text: `Approval: ${p.approvalId} | Revision: ${p.revision}`, size: 10 },
  ];
  for (const a of p.answers) {
    sections.push(
      { text: a.questionId, size: 14 },
      { text: a.question, size: 11 },
      {
        text: `Disposition: ${a.disposition} | Value: ${a.value} | Response option: ${a.responseOption ?? ''}`,
        size: 10,
      },
    );
    if (a.text) sections.push({ text: a.text, size: 10 });
    sections.push({ text: `Reason: ${a.safeReason}`, size: 10 });
    if (a.limitations.length) sections.push({ text: `Limitations: ${a.limitations.join('; ')}`, size: 10 });
    sections.push({ text: `Citations: ${a.citationIds.join('; ')}`, size: 10 });
  }
  sections.push({ text: 'Releasable evidence', size: 20, pageBreak: true });
  for (const e of p.evidence)
    sections.push(
      { text: e.id, size: 14 },
      { text: `${e.label} | Document: ${e.documentId} | Version: ${e.version}`, size: 10 },
      { text: `SHA256: ${e.sourceSha256}`, size: 10 },
      { text: e.locator, size: 10 },
      { text: e.supportingExcerpt, size: 10 },
    );
  return sections;
}
export async function renderPdf(p: Projection): Promise<Buffer> {
  const fonts = await Promise.all(
    subsets.map(async name => {
      const bytes = await readFile(require.resolve(`@fontsource/noto-sans/files/noto-sans-${name}-400-normal.woff`));
      return { name, bytes, font: fontkit.create(bytes) };
    }),
  );
  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    info: { Title: 'Completed vendor questionnaire', Author: 'Local operator' },
    autoFirstPage: true,
    bufferPages: true,
  });
  for (const f of fonts) doc.registerFont(f.name, f.bytes);
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (b: Buffer) => chunks.push(b));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  function text(value: string, size = 10) {
    doc.fontSize(size);
    // Select an actual locally embedded glyph for every code point. Never replace unsupported text.
    const groups: Array<{ font: string; text: string }> = [];
    // Tabs are a layout separator; render their whitespace without a missing control glyph.
    for (const ch of value.replace(/\t/g, '    ')) {
      const point = ch.codePointAt(0)!;
      const selected = fonts.find(f => f.font.hasGlyphForCodePoint(point));
      if (!selected && !['\n', '\r', '\t'].includes(ch))
        throw new Error(`UNSUPPORTED_PDF_GLYPH_U${point.toString(16).toUpperCase()}`);
      const name = selected?.name ?? 'latin',
        last = groups.at(-1);
      if (last?.font === name) last.text += ch;
      else groups.push({ font: name, text: ch });
    }
    if (!groups.length) groups.push({ font: 'latin', text: ' ' });
    for (const [i, g] of groups.entries())
      doc.font(g.font).text(g.text, { width: 499, continued: i < groups.length - 1, lineGap: 3 });
    doc.moveDown(0.6);
  }
  try {
    for (const section of pdfSections(p)) {
      if (section.pageBreak || (section.size >= 14 && doc.y > doc.page.height - 150)) doc.addPage();
      text(section.text, section.size);
    }
    doc.end();
    return await result;
  } catch (error) {
    doc.destroy();
    throw error;
  }
}

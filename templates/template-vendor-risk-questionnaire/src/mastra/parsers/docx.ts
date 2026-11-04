import type { InputLimits } from '../contracts/limits.ts';
import { ParseFault } from './contract.ts';
import type { Region, ParsedInput, FormatParser } from './contract.ts';
import { openOfficePackage, needed } from './office-package.ts';
import { xml, all, children, content } from './xml.ts';
import type { XmlNode } from './xml.ts';

// Accept only structural containers whose visible content is accounted by the DOCX profile.
function validateDocxContent(nodes: XmlNode[], parent: string): void {
  const allowed: Record<string, readonly string[]> = {
    'w:body': ['w:p', 'w:tbl', 'w:sectPr'],
    'w:tbl': ['w:tblPr', 'w:tblGrid', 'w:tr'],
    'w:tr': ['w:trPr', 'w:tc'],
    'w:tc': ['w:tcPr', 'w:p', 'w:tbl'],
    'w:p': ['w:pPr', 'w:r', 'w:hyperlink', 'w:bookmarkStart', 'w:bookmarkEnd', 'w:proofErr'],
    'w:hyperlink': ['w:r', 'w:bookmarkStart', 'w:bookmarkEnd', 'w:proofErr'],
    'w:r': ['w:rPr', 'w:t', 'w:tab', 'w:br', 'w:cr', 'w:noBreakHyphen', 'w:softHyphen'],
    'w:t': ['#text'],
  };
  const metadata = new Set(['w:sectPr', 'w:tblPr', 'w:tblGrid', 'w:trPr', 'w:tcPr', 'w:pPr', 'w:rPr']);
  const textNodes = ['w:t', 'w:tab', 'w:br', 'w:cr', 'w:noBreakHyphen', 'w:softHyphen'];
  for (const n of nodes)
    for (const [key, value] of Object.entries(n)) {
      if (key === ':@') continue;
      if (key === '#text' && parent !== 'w:t') {
        if (String(value).trim()) throw new ParseFault('UNSUPPORTED_LAYOUT');
        continue;
      }
      if (!allowed[parent]?.includes(key)) throw new ParseFault('UNSUPPORTED_LAYOUT');
      if (metadata.has(key)) {
        if (textNodes.some(tag => all(children(n, key), tag).length)) throw new ParseFault('UNSUPPORTED_LAYOUT');
        continue;
      }
      if (allowed[key]) validateDocxContent(children(n, key), key);
      else if (content(children(n, key)).trim()) throw new ParseFault('UNSUPPORTED_LAYOUT');
    }
}
function parseQuestionnaire(bytes: Uint8Array, limits: InputLimits): ParsedInput {
  const e = openOfficePackage(bytes, 'docx', limits);
  const regions: Region[] = [];
  const part = 'word/document.xml';
  const nodes = xml(needed(e, part), limits);
  const body = all(nodes, 'w:body')[0];
  if (!body) throw new ParseFault('CORRUPT_FILE');
  if (
    ['w:txbxContent', 'w:sdt', 'w:ins', 'w:del', 'w:object', 'w:altChunk', 'w:fldSimple', 'w:instrText'].some(
      k => all(nodes, k).length,
    )
  )
    throw new ParseFault('UNSUPPORTED_LAYOUT');
  validateDocxContent(children(body, 'w:body'), 'w:body');
  let table = 0,
    paragraph = 0;
  for (const n of children(body, 'w:body')) {
    if ('w:p' in n) {
      regions.push({
        id: `paragraph:${paragraph}`,
        kind: 'paragraph',
        name: 'Body paragraph',
        part,
        index: paragraph,
        rows: [[{ text: content(children(n, 'w:p')) }]],
        rowIndices: [0],
      });
      paragraph++;
    }
    if ('w:tbl' in n) {
      const ts = children(n, 'w:tbl');
      const unsupported =
        all(ts, 'w:tbl').length > 0 || all(ts, 'w:gridSpan').length > 0 || all(ts, 'w:vMerge').length > 0;
      const rows = all(ts, 'w:tr').map(r =>
        all(children(r, 'w:tr'), 'w:tc').map(c => ({
          text: children(c, 'w:tc')
            .filter(n => 'w:p' in n)
            .map(n => content(children(n, 'w:p')))
            .join('\n'),
        })),
      );
      regions.push({
        id: `table:${table}`,
        kind: 'table',
        name: 'Body table',
        part,
        index: table,
        rows,
        rowIndices: rows.map((_, i) => i),
        unsupported,
      });
      table++;
    }
  }
  for (const [name, b] of Object.entries(e))
    if (/^word\/(header|footer)\d*\.xml$/.test(name)) {
      const header = xml(b, limits);
      const container = name.includes('/header') ? 'w:hdr' : 'w:ftr';
      const node = all(header, container)[0];
      if (!node) throw new ParseFault('CORRUPT_FILE');
      validateDocxContent(children(node, container), 'w:body');
      regions.push({
        id: `part:${regions.length}`,
        kind: 'paragraph',
        name: 'Header or footer',
        part: name,
        index: 0,
        rows: [[{ text: content(header) }]],
        rowIndices: [0],
        unsupported: true,
      });
    }
  if (
    regions.reduce(
      (n, r) => n + r.rows.reduce((s, row) => s + row.reduce((a, c) => a + (c?.text.length ?? 0), 0), 0),
      0,
    ) > limits.maxTextChars
  )
    throw new ParseFault('LIMIT_EXCEEDED');
  return { format: 'docx', regions };
}
export const parser: FormatParser = { format: 'docx', parseQuestionnaire };

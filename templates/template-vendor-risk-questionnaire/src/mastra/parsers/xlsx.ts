import type { InputLimits } from '../contracts/limits.ts';
import { ParseFault } from './contract.ts';
import type { Cell, Region, ParsedInput, ExtractedBlock, FormatParser } from './contract.ts';
import { openOfficePackage, needed } from './office-package.ts';
import { xml, all, children, content, attr } from './xml.ts';
import { columnIndex } from './coordinates.ts';

function parseQuestionnaire(bytes: Uint8Array, limits: InputLimits): ParsedInput {
  const e = openOfficePackage(bytes, 'xlsx', limits);
  const regions: Region[] = [];
  const strings = e['xl/sharedStrings.xml']
    ? all(xml(e['xl/sharedStrings.xml'], limits), 'si').map(n => content(children(n, 'si')))
    : [];
  const rels = all(xml(needed(e, 'xl/_rels/workbook.xml.rels'), limits), 'Relationship');
  const sheets = all(xml(needed(e, 'xl/workbook.xml'), limits), 'sheet');
  for (const [index, s] of sheets.entries()) {
    const rel = rels.find(r => attr(r, 'Id') === attr(s, 'r:id'));
    if (!rel) throw new ParseFault('CORRUPT_FILE');
    const target = attr(rel, 'Target');
    if (target.includes('..') || target.includes('\\')) throw new ParseFault('UNSUPPORTED_LAYOUT');
    const part = target.startsWith('/xl/') ? target.slice(1) : `xl/${target}`;
    const nodes = xml(needed(e, part), limits);
    if (['drawing', 'legacyDrawing', 'oleObjects', 'controls'].some(k => all(nodes, k).length))
      throw new ParseFault('UNSUPPORTED_LAYOUT');
    const rows: Cell[][] = [],
      rowIndices: number[] = [],
      hiddenRows: number[] = [];
    for (const row of all(nodes, 'row')) {
      const ri = Number(attr(row, 'r')) - 1;
      if (!Number.isInteger(ri) || ri < 0 || rowIndices.includes(ri)) throw new ParseFault('UNSUPPORTED_LAYOUT');
      const cells: Cell[] = [];
      if (attr(row, 'hidden') === '1') hiddenRows.push(ri);
      for (const c of all(children(row, 'row'), 'c')) {
        const coordinate = attr(c, 'r');
        if (!/^[A-Z]{1,3}[1-9][0-9]*$/.test(coordinate) || Number(coordinate.replace(/[A-Z]/g, '')) - 1 !== ri)
          throw new ParseFault('CORRUPT_FILE');
        const v = content(all(children(c, 'c'), 'v'));
        let text =
          attr(c, 't') === 's'
            ? strings[Number(v)]
            : attr(c, 't') === 'inlineStr'
              ? content(all(children(c, 'c'), 'is'))
              : v;
        if (text === undefined) throw new ParseFault('CORRUPT_FILE');
        const ci = columnIndex(coordinate);
        if (cells[ci]) throw new ParseFault('CORRUPT_FILE');
        cells[ci] = {
          text,
          coordinate,
          formula: all(children(c, 'c'), 'f').length > 0,
          formulaLiteral: all(children(c, 'c'), 'f').length ? '=' + content(all(children(c, 'c'), 'f')) : undefined,
        };
      }
      rows.push(cells);
      rowIndices.push(ri);
    }
    regions.push({
      id: `sheet:${index}`,
      kind: 'sheet',
      name: attr(s, 'name'),
      part,
      index,
      rows,
      rowIndices,
      hidden: attr(s, 'state') === 'hidden' || attr(s, 'state') === 'veryHidden',
      hiddenRows,
      merges: all(nodes, 'mergeCell').map(n => attr(n, 'ref')),
    });
  }
  if (
    regions.reduce(
      (n, r) => n + r.rows.reduce((s, row) => s + row.reduce((a, c) => a + (c?.text.length ?? 0), 0), 0),
      0,
    ) > limits.maxTextChars
  )
    throw new ParseFault('LIMIT_EXCEEDED');
  return { format: 'xlsx', regions };
}
function extractEvidence(bytes: Uint8Array, limits: InputLimits): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  const p = parseQuestionnaire(bytes, limits);
  for (const r of p.regions)
    for (const row of r.rows)
      for (const c of row)
        if (c?.text) {
          if (c.formula) throw new ParseFault('FORMULA_NOT_ALLOWED');
          blocks.push({ text: c.text, locator: { kind: 'xlsx.cell', sheet: r.name, cell: c.coordinate! } });
        }
  return blocks;
}
export const parser: FormatParser = { format: 'xlsx', parseQuestionnaire, extractEvidence };

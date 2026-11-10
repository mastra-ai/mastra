import { parse } from 'csv-parse/sync';
import type { InputLimits } from '../contracts/limits.ts';
import type { ExtractedBlock, FormatParser } from './contract.ts';
import { decodeText } from './text.ts';

function extractEvidence(bytes: Uint8Array, limits: InputLimits): ExtractedBlock[] {
  const s = decodeText(bytes, limits);
  const blocks: ExtractedBlock[] = [];
  const rows = parse(s, {
    columns: false,
    max_record_size: limits.maxTextChars,
    skip_empty_lines: false,
    relax_column_count: false,
  }) as string[][];
  for (const [row, values] of rows.entries())
    for (const [column, value] of values.entries())
      if (value) blocks.push({ text: value, locator: { kind: 'csv.cell', row: row + 1, column: column + 1 } });
  return blocks;
}
export const parser: FormatParser = { format: 'csv', extractEvidence };

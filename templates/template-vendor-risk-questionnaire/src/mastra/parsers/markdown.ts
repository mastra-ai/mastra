import type { InputLimits } from '../contracts/limits.ts';
import type { ExtractedBlock, FormatParser } from './contract.ts';
import { decodeText } from './text.ts';

function extractEvidence(bytes: Uint8Array, limits: InputLimits): ExtractedBlock[] {
  const s = decodeText(bytes, limits);
  const blocks: ExtractedBlock[] = [];
  let heading = '';
  for (const [i, line] of s.split(/\r?\n/).entries()) {
    if (/^#{1,6} /.test(line)) heading = line.replace(/^#+ /, '');
    if (line.trim())
      blocks.push({ text: line, locator: { kind: 'markdown.lines', heading, startLine: i + 1, endLine: i + 1 } });
  }
  return blocks;
}
export const parser: FormatParser = { format: 'markdown', extractEvidence };

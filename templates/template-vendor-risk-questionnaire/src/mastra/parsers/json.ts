import type { InputLimits } from '../contracts/limits.ts';
import { ParseFault } from './contract.ts';
import type { ExtractedBlock, FormatParser } from './contract.ts';
import { decodeText } from './text.ts';

function extractEvidence(bytes: Uint8Array, limits: InputLimits): ExtractedBlock[] {
  const s = decodeText(bytes, limits);
  const blocks: ExtractedBlock[] = [];
  const visit = (v: unknown, pointer: string, depth: number) => {
    if (depth > 100) throw new ParseFault('LIMIT_EXCEEDED');
    if (v !== null && typeof v === 'object') {
      for (const [k, value] of Object.entries(v))
        visit(value, `${pointer}/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`, depth + 1);
    } else
      blocks.push({
        text: typeof v === 'string' ? v : JSON.stringify(v),
        locator: { kind: 'json.pointer', pointer },
      });
  };
  visit(JSON.parse(s), '', 0);
  return blocks;
}
export const parser: FormatParser = { format: 'json', extractEvidence };

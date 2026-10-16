import type { InputLimits } from '../contracts/limits.ts';
import { ParseFault } from './contract.ts';
import type { FormatParser, ParserFormat, ParserMode, ParsedInput, ExtractedBlock } from './contract.ts';

interface ParserRegistration {
  format: ParserFormat;
  modes: readonly ParserMode[];
  load: () => Promise<{ parser: FormatParser }>;
}
// Literal loaders keep format dependencies out of unrelated parser tasks.
export const availableParsers: readonly ParserRegistration[] = Object.freeze([
  { format: 'xlsx', modes: ['questionnaire', 'evidence'], load: () => import('./xlsx.ts') },
  { format: 'docx', modes: ['questionnaire'], load: () => import('./docx.ts') },
  { format: 'pdf', modes: ['evidence'], load: () => import('./pdf.ts') },
  { format: 'csv', modes: ['evidence'], load: () => import('./csv.ts') },
  { format: 'json', modes: ['evidence'], load: () => import('./json.ts') },
  { format: 'markdown', modes: ['evidence'], load: () => import('./markdown.ts') },
]);
export async function parseInput(
  bytes: Uint8Array,
  format: string,
  mode: ParserMode,
  limits: InputLimits,
): Promise<ParsedInput | ExtractedBlock[]> {
  const registration = availableParsers.find(p => p.format === format && p.modes.includes(mode));
  if (!registration) throw new ParseFault('UNSUPPORTED_FORMAT');
  if (bytes.length > limits.maxBytes) throw new ParseFault('LIMIT_EXCEEDED');
  const { parser } = await registration.load();
  if (mode === 'questionnaire') {
    if (!parser.parseQuestionnaire) throw new ParseFault('UNSUPPORTED_FORMAT');
    return parser.parseQuestionnaire(bytes, limits);
  }
  if (!parser.extractEvidence) throw new ParseFault('UNSUPPORTED_FORMAT');
  const blocks = await parser.extractEvidence(bytes, limits);
  if (!blocks.length) throw new ParseFault('EMPTY_QUESTION');
  if (blocks.reduce((n, b) => n + b.text.length, 0) > limits.maxTextChars) throw new ParseFault('LIMIT_EXCEEDED');
  return blocks;
}

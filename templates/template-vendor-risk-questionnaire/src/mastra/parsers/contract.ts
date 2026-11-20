import type { InputLimits } from '../contracts/limits.ts';

export class ParseFault extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
export interface Cell {
  text: string;
  formula?: boolean;
  formulaLiteral?: string;
  coordinate?: string;
}
export interface Region {
  id: string;
  kind: 'sheet' | 'table' | 'paragraph';
  name: string;
  part: string;
  index: number;
  rows: Cell[][];
  rowIndices: number[];
  hidden?: boolean;
  hiddenRows?: number[];
  merges?: string[];
  unsupported?: boolean;
}
export interface ParsedInput {
  format: string;
  regions: Region[];
}
export interface ExtractedBlock {
  text: string;
  locator: Record<string, string | number>;
}
export type ParserMode = 'questionnaire' | 'evidence';
export type ParserFormat = 'xlsx' | 'docx' | 'pdf' | 'csv' | 'json' | 'markdown';
export interface FormatParser {
  format: ParserFormat;
  parseQuestionnaire?: (bytes: Uint8Array, limits: InputLimits) => ParsedInput | Promise<ParsedInput>;
  extractEvidence?: (bytes: Uint8Array, limits: InputLimits) => ExtractedBlock[] | Promise<ExtractedBlock[]>;
}

import type { TiktokenEncoding, TiktokenModel } from 'js-tiktoken';
import type {
  TitleExtractorsArgs,
  SummaryExtractArgs,
  QuestionAnswerExtractArgs,
  KeywordExtractArgs,
} from './extractors';

export enum Language {
  CPP = 'cpp',
  GO = 'go',
  JAVA = 'java',
  KOTLIN = 'kotlin',
  JS = 'js',
  TS = 'ts',
  PHP = 'php',
  PROTO = 'proto',
  PYTHON = 'python',
  RST = 'rst',
  RUBY = 'ruby',
  RUST = 'rust',
  SCALA = 'scala',
  SWIFT = 'swift',
  MARKDOWN = 'markdown',
  LATEX = 'latex',
  HTML = 'html',
  SOL = 'sol',
  CSHARP = 'csharp',
  COBOL = 'cobol',
  C = 'c',
  LUA = 'lua',
  PERL = 'perl',
  HASKELL = 'haskell',
  ELIXIR = 'elixir',
  POWERSHELL = 'powershell',
}

export type ExtractParams = {
  title?: TitleExtractorsArgs | boolean;
  summary?: SummaryExtractArgs | boolean;
  questions?: QuestionAnswerExtractArgs | boolean;
  keywords?: KeywordExtractArgs | boolean;
};

export type ChunkOptions = {
  headers?: [string, string][];
  returnEachLine?: boolean;
  sections?: [string, string][];
  separator?: string;
  separators?: string[];
  isSeparatorRegex?: boolean;
  size?: number;
  maxSize?: number;
  minSize?: number;
  overlap?: number;
  lengthFunction?: (text: string) => number;
  keepSeparator?: boolean | 'start' | 'end';
  addStartIndex?: boolean;
  stripWhitespace?: boolean;
  language?: Language;
  ensureAscii?: boolean;
  convertLists?: boolean;
  encodingName?: TiktokenEncoding;
  modelName?: TiktokenModel;
  allowedSpecial?: Set<string> | 'all';
  disallowedSpecial?: Set<string> | 'all';
  stripHeaders?: boolean;
};

export type ChunkStrategy = 'recursive' | 'character' | 'token' | 'markdown' | 'html' | 'json' | 'latex';

export interface ChunkParams extends ChunkOptions {
  strategy?: ChunkStrategy;
  extract?: ExtractParams;
}

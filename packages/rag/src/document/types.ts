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

export type BaseChunkOptions = {
  /**
   * @deprecated Use `maxSize` instead. Will be removed in next major version.
   */
  size?: number;
  maxSize?: number;
  overlap?: number;
  lengthFunction?: (text: string) => number;
  keepSeparator?: boolean | 'start' | 'end';
  addStartIndex?: boolean;
  stripWhitespace?: boolean;
};

export type CharacterChunkOptions = BaseChunkOptions & {
  separator?: string;
  isSeparatorRegex?: boolean;
};

export type RecursiveChunkOptions = BaseChunkOptions & {
  separators?: string[];
  isSeparatorRegex?: boolean;
  language?: Language;
};

export type TokenChunkOptions = BaseChunkOptions & {
  encodingName?: TiktokenEncoding;
  modelName?: TiktokenModel;
  allowedSpecial?: Set<string> | 'all';
  disallowedSpecial?: Set<string> | 'all';
};

export type MarkdownChunkOptions = BaseChunkOptions & {
  headers?: [string, string][];
  returnEachLine?: boolean;
  stripHeaders?: boolean;
};

export type SemanticMarkdownChunkOptions = BaseChunkOptions & {
  joinThreshold?: number;
  encodingName?: TiktokenEncoding;
  modelName?: TiktokenModel;
  allowedSpecial?: Set<string> | 'all';
  disallowedSpecial?: Set<string> | 'all';
};

export type HTMLChunkOptions = BaseChunkOptions &
  (
    | { headers: [string, string][]; sections?: never; returnEachLine?: boolean }
    | { sections: [string, string][]; headers?: never }
  ) & { returnEachLine?: boolean };

export type JsonChunkOptions = BaseChunkOptions & {
  minSize?: number;
  ensureAscii?: boolean;
  convertLists?: boolean;
};

export type LatexChunkOptions = BaseChunkOptions & {};

export type SentenceChunkOptions = BaseChunkOptions & {
  maxSize: number; // Override to make required for sentence strategy
  minSize?: number;
  targetSize?: number;
  sentenceEnders?: string[];
  fallbackToWords?: boolean;
  fallbackToCharacters?: boolean;
};

export type StrategyOptions = {
  recursive: RecursiveChunkOptions;
  character: CharacterChunkOptions;
  token: TokenChunkOptions;
  markdown: MarkdownChunkOptions;
  html: HTMLChunkOptions;
  json: JsonChunkOptions;
  latex: LatexChunkOptions;
  sentence: SentenceChunkOptions;
  'semantic-markdown': SemanticMarkdownChunkOptions;
};

export type ChunkStrategy =
  | 'recursive'
  | 'character'
  | 'token'
  | 'markdown'
  | 'html'
  | 'json'
  | 'latex'
  | 'sentence'
  | 'semantic-markdown';

export type ChunkParams =
  | ({ strategy?: 'character' } & CharacterChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'recursive' } & RecursiveChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'token' } & TokenChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'markdown' } & MarkdownChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'html' } & HTMLChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'json' } & JsonChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'latex' } & LatexChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'sentence' } & SentenceChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'semantic-markdown' } & SemanticMarkdownChunkOptions & { extract?: ExtractParams });

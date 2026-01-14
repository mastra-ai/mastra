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

// General options that apply to all chunking strategies
export type GeneralChunkOptions = {
  maxSize?: number;
  overlap?: number;
  lengthFunction?: (text: string) => number;
  separatorPosition?: 'start' | 'end';
  addStartIndex?: boolean;
  stripWhitespace?: boolean;
};

// Strategy-specific options (without general options)
export type CharacterStrategyOptions = {
  separator?: string;
  isSeparatorRegex?: boolean;
};

export type RecursiveStrategyOptions = {
  separators?: string[];
  isSeparatorRegex?: boolean;
  language?: Language;
};

export type TokenStrategyOptions = {
  encodingName?: TiktokenEncoding;
  modelName?: TiktokenModel;
  allowedSpecial?: Set<string> | 'all';
  disallowedSpecial?: Set<string> | 'all';
};

export type MarkdownStrategyOptions = {
  headers?: [string, string][];
  returnEachLine?: boolean;
  stripHeaders?: boolean;
};

export type SemanticMarkdownStrategyOptions = {
  joinThreshold?: number;
  encodingName?: TiktokenEncoding;
  modelName?: TiktokenModel;
  allowedSpecial?: Set<string> | 'all';
  disallowedSpecial?: Set<string> | 'all';
};

export type HTMLStrategyOptions =
  | { headers: [string, string][]; sections?: never; returnEachLine?: boolean }
  | { sections: [string, string][]; headers?: never; returnEachLine?: boolean };

export type JsonStrategyOptions = {
  minSize?: number;
  ensureAscii?: boolean;
  convertLists?: boolean;
};

export type LatexStrategyOptions = Record<string, never>;

export type SentenceStrategyOptions = {
  maxSize: number; // Required for sentence strategy
  minSize?: number;
  targetSize?: number;
  sentenceEnders?: string[];
  fallbackToWords?: boolean;
  fallbackToCharacters?: boolean;
};

// Legacy types (kept for backwards compatibility with internal code)
export type BaseChunkOptions = GeneralChunkOptions;
export type CharacterChunkOptions = GeneralChunkOptions & CharacterStrategyOptions;
export type RecursiveChunkOptions = GeneralChunkOptions & RecursiveStrategyOptions;
export type TokenChunkOptions = GeneralChunkOptions & TokenStrategyOptions;
export type MarkdownChunkOptions = GeneralChunkOptions & MarkdownStrategyOptions;
export type SemanticMarkdownChunkOptions = GeneralChunkOptions & SemanticMarkdownStrategyOptions;
export type HTMLChunkOptions = GeneralChunkOptions & HTMLStrategyOptions;
export type JsonChunkOptions = GeneralChunkOptions & JsonStrategyOptions;
export type LatexChunkOptions = GeneralChunkOptions & LatexStrategyOptions;
export type SentenceChunkOptions = GeneralChunkOptions & SentenceStrategyOptions;

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
  | ({ strategy?: 'character'; characterOptions?: CharacterStrategyOptions } & GeneralChunkOptions & {
        extract?: ExtractParams;
      })
  | ({ strategy: 'recursive'; recursiveOptions?: RecursiveStrategyOptions } & GeneralChunkOptions & {
        extract?: ExtractParams;
      })
  | ({ strategy: 'token'; tokenOptions?: TokenStrategyOptions } & GeneralChunkOptions & {
        extract?: ExtractParams;
      })
  | ({ strategy: 'markdown'; markdownOptions?: MarkdownStrategyOptions } & GeneralChunkOptions & {
        extract?: ExtractParams;
      })
  | ({ strategy: 'html'; htmlOptions?: HTMLStrategyOptions } & GeneralChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'json'; jsonOptions?: JsonStrategyOptions } & GeneralChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'latex'; latexOptions?: LatexStrategyOptions } & GeneralChunkOptions & {
        extract?: ExtractParams;
      })
  | ({ strategy: 'sentence'; sentenceOptions?: SentenceStrategyOptions } & Omit<GeneralChunkOptions, 'maxSize'> & {
        extract?: ExtractParams;
      })
  | ({
      strategy: 'semantic-markdown';
      semanticMarkdownOptions?: SemanticMarkdownStrategyOptions;
    } & GeneralChunkOptions & { extract?: ExtractParams });

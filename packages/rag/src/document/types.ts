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

/**
 * Legacy chunking options for backward compatibility and ergonomic defaults.
 *
 * This type is still supported, especially when the chunking strategy is inferred from document type.
 * For new code, prefer using the dedicated strategy-specific options fields on {@link ChunkParams}.
 */
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
  /**
   * @deprecated Use `separatorPosition` instead. This option will be removed after May 20th, 2025.
   * If provided, a runtime warning should be emitted.
   */
  keepSeparator?: boolean | 'start' | 'end';

  /**
   * Controls where the separator appears in the chunk. Replaces `keepSeparator`.
   * - 'start': separator appears at the start of the chunk
   * - 'end': separator appears at the end of the chunk
   * If not provided, the separator is omitted.
   */
  separatorPosition?: 'start' | 'end';
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

// Shared base chunk options
export interface BaseChunkOptions {
  /**
   * The size of each chunk.
   */
  size?: number;
  /**
   * The overlap between chunks.
   */
  overlap?: number;
  /**
   * Function to calculate the length of a chunk.
   */
  lengthFunction?: (text: string) => number;
  /**
   * @deprecated Use `separatorPosition` instead. This option will be removed after May 20th, 2025.
   * If provided, a runtime warning should be emitted.
   */
  keepSeparator?: boolean | 'start' | 'end';
  /**
   * Controls where the separator appears in the chunk. Replaces `keepSeparator`.
   * - 'start': separator appears at the start of the chunk
   * - 'end': separator appears at the end of the chunk
   * If not provided, the separator is omitted.
   */
  separatorPosition?: 'start' | 'end';
  /**
   * Whether to add the start index of each chunk to the metadata.
   */
  addStartIndex?: boolean;
  /**
   * Whether to strip whitespace from the start and end of each chunk.
   */
  stripWhitespace?: boolean;
}

// Dedicated option types for each strategy
export interface CharacterChunkOptions extends BaseChunkOptions {
  /**
   * The separator to use when splitting the text.
   */
  separator?: string;
  /**
   * Whether the separator is a regular expression.
   */
  isSeparatorRegex?: boolean;
}

export interface TokenChunkOptions extends BaseChunkOptions {
  /**
   * The name of the encoding to use for tokenization.
   */
  encodingName?: TiktokenEncoding;
  /**
   * The name of the model to use for tokenization.
   */
  modelName?: TiktokenModel;
  /**
   * The set of allowed special tokens.
   */
  allowedSpecial?: Set<string> | 'all';
  /**
   * The set of disallowed special tokens.
   */
  disallowedSpecial?: Set<string> | 'all';
}

export interface MarkdownChunkOptions extends BaseChunkOptions {
  /**
   * The headers to use when splitting the text.
   */
  headers?: [string, string][];
  /**
   * Whether to return each line as a separate chunk.
   */
  returnEachLine?: boolean;
  /**
   * Whether to strip headers from the text.
   */
  stripHeaders?: boolean;
}

export interface HtmlChunkOptions {
  /**
   * The headers to use when splitting the text.
   */
  headers?: [string, string][];
  /**
   * Whether to return each line as a separate chunk.
   */
  returnEachLine?: boolean;
  /**
   * The sections to use when splitting the text.
   */
  sections?: [string, string][];
}

export interface RecursiveChunkOptions extends BaseChunkOptions {
  /**
   * The separators to use when splitting the text.
   */
  separators?: string[];
  /**
   * Whether the separators are regular expressions.
   */
  isSeparatorRegex?: boolean;
  /**
   * The language to use when splitting the text.
   */
  language?: Language;
}

export interface JsonChunkOptions {
  /**
   * The maximum size of each chunk.
   */
  maxSize?: number;
  /**
   * The minimum size of each chunk.
   */
  minSize?: number;
  /**
   * Whether to ensure ASCII characters only.
   */
  ensureAscii?: boolean;
  /**
   * Whether to convert lists to arrays.
   */
  convertLists?: boolean;
}

export interface LatexChunkOptions extends BaseChunkOptions {}

export interface StrategyOptions extends ChunkOptions {
  characterOptions?: CharacterChunkOptions;
  tokenOptions?: TokenChunkOptions;
  markdownOptions?: MarkdownChunkOptions;
  htmlOptions?: HtmlChunkOptions;
  recursiveOptions?: RecursiveChunkOptions;
  jsonOptions?: JsonChunkOptions;
  latexOptions?: LatexChunkOptions;
}

export type ChunkParams =
  | { strategy: 'character'; characterOptions: CharacterChunkOptions; extract?: ExtractParams }
  | { strategy: 'token'; tokenOptions: TokenChunkOptions; extract?: ExtractParams }
  | { strategy: 'markdown'; markdownOptions: MarkdownChunkOptions; extract?: ExtractParams }
  | { strategy: 'html'; htmlOptions: HtmlChunkOptions; extract?: ExtractParams }
  | { strategy: 'recursive'; recursiveOptions: RecursiveChunkOptions; extract?: ExtractParams }
  | { strategy: 'json'; jsonOptions: JsonChunkOptions; extract?: ExtractParams }
  | { strategy: 'latex'; latexOptions: LatexChunkOptions; extract?: ExtractParams }
  // Deprecated: flat options for backward compatibility
  | ({ strategy?: ChunkStrategy; extract?: ExtractParams } & ChunkOptions);

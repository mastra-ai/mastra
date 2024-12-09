import { Tiktoken, encoding_for_model, get_encoding, TiktokenModel, TiktokenEncoding } from '@dqbd/tiktoken';

// Base document types
export interface Document {
  pageContent: string;
  metadata: Record<string, any>;
}

export interface BaseDocumentTransformer {
  transformDocuments(documents: Document[]): Document[];
}

// Enums
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

// Tokenizer interface
interface Tokenizer {
  chunkOverlap: number;
  tokensPerChunk: number;
  decode: (tokens: number[]) => string;
  encode: (text: string) => number[];
}

export abstract class TextSplitter implements BaseDocumentTransformer {
  protected chunkSize: number;
  protected chunkOverlap: number;
  protected lengthFunction: (text: string) => number;
  protected keepSeparator: boolean | 'start' | 'end';
  protected addStartIndex: boolean;
  protected stripWhitespace: boolean;

  constructor(
    chunkSize: number = 4000,
    chunkOverlap: number = 200,
    lengthFunction: (text: string) => number = text => text.length,
    keepSeparator: boolean | 'start' | 'end' = false,
    addStartIndex: boolean = false,
    stripWhitespace: boolean = true,
  ) {
    if (chunkOverlap > chunkSize) {
      throw new Error(
        `Got a larger chunk overlap (${chunkOverlap}) than chunk size ` + `(${chunkSize}), should be smaller.`,
      );
    }
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
    this.lengthFunction = lengthFunction;
    this.keepSeparator = keepSeparator;
    this.addStartIndex = addStartIndex;
    this.stripWhitespace = stripWhitespace;
  }

  // Add setter method for addStartIndex
  setAddStartIndex(value: boolean): void {
    this.addStartIndex = value;
  }

  abstract splitText(text: string): string[];

  createDocuments(texts: string[], metadatas?: Record<string, any>[]): Document[] {
    const _metadatas = metadatas || Array(texts.length).fill({});
    const documents: Document[] = [];

    texts.forEach((text, i) => {
      let index = 0;
      let previousChunkLen = 0;

      this.splitText(text).forEach(chunk => {
        const metadata = { ..._metadatas[i] };
        if (this.addStartIndex) {
          const offset = index + previousChunkLen - this.chunkOverlap;
          index = text.indexOf(chunk, Math.max(0, offset));
          metadata.startIndex = index;
          previousChunkLen = chunk.length;
        }
        documents.push({
          pageContent: chunk,
          metadata,
        });
      });
    });

    return documents;
  }

  splitDocuments(documents: Document[]): Document[] {
    const texts: string[] = [];
    const metadatas: Record<string, any>[] = [];

    for (const doc of documents) {
      texts.push(doc.pageContent);
      metadatas.push(doc.metadata);
    }

    return this.createDocuments(texts, metadatas);
  }

  transformDocuments(documents: Document[]): Document[] {
    const texts: string[] = [];
    const metadatas: Record<string, any>[] = [];

    documents.forEach(doc => {
      texts.push(doc.pageContent);
      metadatas.push(doc.metadata);
    });

    return this.createDocuments(texts, metadatas);
  }

  protected joinDocs(docs: string[], separator: string): string | null {
    let text = docs.join(separator);
    if (this.stripWhitespace) {
      text = text.trim();
    }
    return text === '' ? null : text;
  }

  protected mergeSplits(splits: string[], separator: string): string[] {
    const separatorLen = this.lengthFunction(separator);
    const docs: string[] = [];
    let currentDoc: string[] = [];
    let total = 0;

    splits.forEach(d => {
      const len = this.lengthFunction(d);
      if (total + len + (currentDoc.length > 0 ? separatorLen : 0) > this.chunkSize) {
        if (total > this.chunkSize) {
          console.warn(`Created a chunk of size ${total}, ` + `which is longer than the specified ${this.chunkSize}`);
        }
        if (currentDoc.length > 0) {
          const doc = this.joinDocs(currentDoc, separator);
          if (doc !== null) {
            docs.push(doc);
          }
          while (
            total > this.chunkOverlap ||
            (total + len + (currentDoc.length > 0 ? separatorLen : 0) > this.chunkSize && total > 0)
          ) {
            total -= this.lengthFunction(currentDoc?.[0]!) + (currentDoc.length > 1 ? separatorLen : 0);
            currentDoc = currentDoc.slice(1);
          }
        }
      }
      currentDoc.push(d);
      total += len + (currentDoc.length > 1 ? separatorLen : 0);
    });

    const doc = this.joinDocs(currentDoc, separator);
    if (doc !== null) {
      docs.push(doc);
    }
    return docs;
  }

  static fromTikToken(
    encodingName: TiktokenEncoding = 'cl100k_base',
    modelName?: TiktokenModel,
    options: {
      chunkSize?: number;
      chunkOverlap?: number;
      allowedSpecial?: Set<string> | 'all';
      disallowedSpecial?: Set<string> | 'all';
    } = {},
  ): TokenTextSplitter {
    let tokenizer: Tiktoken;

    try {
      if (modelName) {
        tokenizer = encoding_for_model(modelName);
      } else {
        tokenizer = get_encoding(encodingName);
      }
    } catch (error) {
      throw new Error('Could not load tiktoken encoding. ' + 'Please install it with `npm install @dqbd/tiktoken`.');
    }

    const tikTokenEncoder = (text: string): number => {
      const allowed =
        options.allowedSpecial === 'all' ? 'all' : options.allowedSpecial ? Array.from(options.allowedSpecial) : [];

      const disallowed =
        options.disallowedSpecial === 'all'
          ? 'all'
          : options.disallowedSpecial
            ? Array.from(options.disallowedSpecial)
            : [];

      return tokenizer.encode(text, allowed, disallowed).length;
    };

    return new TokenTextSplitter(encodingName, modelName, options.allowedSpecial, options.disallowedSpecial, {
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
      lengthFunction: tikTokenEncoder,
    });
  }
}

export class TokenTextSplitter extends TextSplitter {
  private tokenizer: Tiktoken;
  private allowedSpecial: Set<string> | 'all';
  private disallowedSpecial: Set<string> | 'all';
  private textDecoder: TextDecoder;

  constructor(
    encodingName: TiktokenEncoding = 'cl100k_base',
    modelName?: TiktokenModel,
    allowedSpecial: Set<string> | 'all' = new Set(),
    disallowedSpecial: Set<string> | 'all' = 'all',
    options: {
      chunkSize?: number;
      chunkOverlap?: number;
      lengthFunction?: (text: string) => number;
      keepSeparator?: boolean | 'start' | 'end';
      addStartIndex?: boolean;
      stripWhitespace?: boolean;
    } = {},
  ) {
    super(
      options.chunkSize,
      options.chunkOverlap,
      options.lengthFunction,
      options.keepSeparator,
      options.addStartIndex,
      options.stripWhitespace,
    );

    try {
      this.tokenizer = modelName ? encoding_for_model(modelName) : get_encoding(encodingName);
      this.textDecoder = new TextDecoder();
    } catch (error) {
      throw new Error('Could not load tiktoken encoding. ' + 'Please install it with `npm install @dqbd/tiktoken`.');
    }

    this.allowedSpecial = allowedSpecial;
    this.disallowedSpecial = disallowedSpecial;
  }

  splitText(text: string): string[] {
    const encode = (text: string): number[] => {
      const allowed = this.allowedSpecial === 'all' ? 'all' : Array.from(this.allowedSpecial);

      const disallowed = this.disallowedSpecial === 'all' ? 'all' : Array.from(this.disallowedSpecial);

      // If stripWhitespace is enabled, trim the text before encoding
      const processedText = this.stripWhitespace ? text.trim() : text;
      return Array.from(this.tokenizer.encode(processedText, allowed, disallowed));
    };

    const decode = (tokens: number[]): string => {
      const uint32Tokens = new Uint32Array(tokens);
      const bytes = this.tokenizer.decode(uint32Tokens);
      const text = this.textDecoder.decode(bytes);
      // Apply whitespace stripping to decoded text if enabled
      return this.stripWhitespace ? text.trim() : text;
    };

    const tokenizer: Tokenizer = {
      chunkOverlap: this.chunkOverlap,
      tokensPerChunk: this.chunkSize,
      decode,
      encode,
    };

    return splitTextOnTokens(text, tokenizer);
  }

  dispose(): void {
    if (this.tokenizer) {
      this.tokenizer.free();
    }
  }
}

export class CharacterTextSplitter extends TextSplitter {
  protected separator: string;
  protected isSeparatorRegex: boolean;

  constructor(
    separator: string = '\n\n',
    isSeparatorRegex: boolean = false,
    options: {
      chunkSize?: number;
      chunkOverlap?: number;
      lengthFunction?: (text: string) => number;
      keepSeparator?: boolean | 'start' | 'end';
      addStartIndex?: boolean;
      stripWhitespace?: boolean;
    } = {},
  ) {
    super(
      options.chunkSize,
      options.chunkOverlap,
      options.lengthFunction,
      options.keepSeparator,
      options.addStartIndex,
      options.stripWhitespace,
    );
    this.separator = separator;
    this.isSeparatorRegex = isSeparatorRegex;
  }

  splitText(text: string): string[] {
    // First, split the text into initial chunks
    const separator = this.isSeparatorRegex ? this.separator : this.separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const initialSplits = splitTextWithRegex(text, separator, this.keepSeparator);

    // If length of any split is greater than chunk size, perform additional splitting
    const chunks: string[] = [];
    for (const split of initialSplits) {
      if (this.lengthFunction(split) <= this.chunkSize) {
        chunks.push(split);
      } else {
        // If a single split is too large, split it further
        const subChunks = this._split_chunk(split);
        chunks.push(...subChunks);
      }
    }

    return chunks;
  }

  private _split_chunk(text: string): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    // Split by characters if no other separator is suitable
    const chars = text.split('');

    for (const char of chars) {
      if (this.lengthFunction(currentChunk + char) <= this.chunkSize) {
        currentChunk += char;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = char;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}

export class RecursiveCharacterTextSplitter extends TextSplitter {
  protected separators: string[];
  protected isSeparatorRegex: boolean;

  constructor(
    separators?: string[],
    isSeparatorRegex: boolean = false,
    options: {
      chunkSize?: number;
      chunkOverlap?: number;
      lengthFunction?: (text: string) => number;
      keepSeparator?: boolean | 'start' | 'end';
      addStartIndex?: boolean;
      stripWhitespace?: boolean;
    } = {},
  ) {
    super(
      options.chunkSize,
      options.chunkOverlap,
      options.lengthFunction,
      options.keepSeparator,
      options.addStartIndex,
      options.stripWhitespace,
    );
    this.separators = separators || ['\n\n', '\n', ' ', ''];
    this.isSeparatorRegex = isSeparatorRegex;
  }

  private _splitText(text: string, separators: string[]): string[] {
    const finalChunks: string[] = [];

    // Get appropriate separator to use
    let separator = separators?.[separators.length - 1]!;
    let newSeparators: string[] = [];

    for (let i = 0; i < separators.length; i++) {
      const s = separators[i]!;
      const _separator = this.isSeparatorRegex ? s : s?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      if (s === '') {
        separator = s;
        break;
      }

      if (new RegExp(_separator).test(text)) {
        separator = s;
        newSeparators = separators.slice(i + 1);
        break;
      }
    }

    const _separator = this.isSeparatorRegex ? separator : separator?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const splits = splitTextWithRegex(text, _separator, this.keepSeparator);

    // Now go merging things, recursively splitting longer texts
    const goodSplits: string[] = [];
    const mergeSeparator = this.keepSeparator ? '' : separator;

    for (const s of splits) {
      if (this.lengthFunction(s) < this.chunkSize) {
        goodSplits.push(s);
      } else {
        if (goodSplits.length > 0) {
          const mergedText = this.mergeSplits(goodSplits, mergeSeparator);
          finalChunks.push(...mergedText);
          goodSplits.length = 0;
        }
        if (newSeparators.length === 0) {
          finalChunks.push(s);
        } else {
          const otherInfo = this._splitText(s, newSeparators);
          finalChunks.push(...otherInfo);
        }
      }
    }

    if (goodSplits.length > 0) {
      const mergedText = this.mergeSplits(goodSplits, mergeSeparator);
      finalChunks.push(...mergedText);
    }

    return finalChunks;
  }

  splitText(text: string): string[] {
    return this._splitText(text, this.separators);
  }

  static fromLanguage(
    language: Language,
    options: {
      chunkSize?: number;
      chunkOverlap?: number;
      lengthFunction?: (text: string) => number;
      keepSeparator?: boolean | 'start' | 'end';
      addStartIndex?: boolean;
      stripWhitespace?: boolean;
    } = {},
  ): RecursiveCharacterTextSplitter {
    const separators = RecursiveCharacterTextSplitter.getSeparatorsForLanguage(language);
    return new RecursiveCharacterTextSplitter(separators, true, options);
  }

  static getSeparatorsForLanguage(language: Language): string[] {
    switch (language) {
      case Language.MARKDOWN:
        return [
          // First, try to split along Markdown headings (starting with level 2)
          '\n#{1,6} ',
          // End of code block
          '```\n',
          // Horizontal lines
          '\n\\*\\*\\*+\n',
          '\n---+\n',
          '\n___+\n',
          // Note that this splitter doesn't handle horizontal lines defined
          // by *three or more* of ***, ---, or ___, but this is not handled
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.CPP:
      case Language.C:
        return [
          '\nclass ',
          '\nvoid ',
          '\nint ',
          '\nfloat ',
          '\ndouble ',
          '\nif ',
          '\nfor ',
          '\nwhile ',
          '\nswitch ',
          '\ncase ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.TS:
        return [
          '\nenum ',
          '\ninterface ',
          '\nnamespace ',
          '\ntype ',
          '\nclass ',
          '\nfunction ',
          '\nconst ',
          '\nlet ',
          '\nvar ',
          '\nif ',
          '\nfor ',
          '\nwhile ',
          '\nswitch ',
          '\ncase ',
          '\ndefault ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      // ... (add other language cases following the same pattern)
      default:
        throw new Error(`Language ${language} is not supported! Please choose from ${Object.values(Language)}`);
    }
  }
}

function splitTextWithRegex(text: string, separator: string, keepSeparator: boolean | 'start' | 'end'): string[] {
  if (!separator) {
    return text.split('');
  }

  if (!keepSeparator) {
    return text.split(new RegExp(separator)).filter(s => s !== '');
  }

  // Handle empty text
  if (!text) {
    return [];
  }

  // Split with capturing group to keep separators
  const splits = text.split(new RegExp(`(${separator})`));
  const result: string[] = [];

  if (keepSeparator === 'end') {
    // Process all complete pairs
    for (let i = 0; i < splits.length - 1; i += 2) {
      if (i + 1 < splits.length) {
        // Current text + separator
        const chunk = splits[i] + (splits[i + 1] || '');
        if (chunk) result.push(chunk);
      }
    }
    // Handle the last element if it exists and isn't a separator
    if (splits.length % 2 === 1 && splits[splits.length - 1]) {
      result.push(splits?.[splits.length - 1]!);
    }
  } else {
    // 'start' or true
    // First chunk without separator
    if (splits[0]) result.push(splits[0]);

    // Process remaining chunks with their preceding separators
    for (let i = 1; i < splits.length - 1; i += 2) {
      const separator = splits[i];
      const text = splits[i + 1];
      if (separator && text) {
        result.push(separator + text);
      }
    }
  }

  return result.filter(s => s !== '');
}

export function splitTextOnTokens(text: string, tokenizer: Tokenizer): string[] {
  const splits: string[] = [];
  const inputIds = tokenizer.encode(text);
  let startIdx = 0;
  let curIdx = Math.min(startIdx + tokenizer.tokensPerChunk, inputIds.length);
  let chunkIds = inputIds.slice(startIdx, curIdx);

  while (startIdx < inputIds.length) {
    splits.push(tokenizer.decode(chunkIds));
    if (curIdx === inputIds.length) {
      break;
    }
    startIdx += tokenizer.tokensPerChunk - tokenizer.chunkOverlap;
    curIdx = Math.min(startIdx + tokenizer.tokensPerChunk, inputIds.length);
    chunkIds = inputIds.slice(startIdx, curIdx);
  }

  return splits;
}

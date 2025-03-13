import { Language } from '../types';
import type { ChunkOptions } from '../types';

import { TextTransformer } from './text';

function splitTextWithRegex(text: string, separator: string, keepSeparator: boolean | 'start' | 'end'): string[] {
  if (!separator) {
    return text.split('');
  }

  if (!keepSeparator) {
    return text.split(new RegExp(separator)).filter(s => s !== '');
  }

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
    if (splits[0]) result.push(splits[0]);

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

export class CharacterTransformer extends TextTransformer {
  protected separator: string;
  protected isSeparatorRegex: boolean;

  constructor({
    separator = '\n\n',
    isSeparatorRegex = false,
    options = {},
  }: {
    separator?: string;
    isSeparatorRegex?: boolean;
    options?: {
      size?: number;
      overlap?: number;
      lengthFunction?: (text: string) => number;
      keepSeparator?: boolean | 'start' | 'end';
      addStartIndex?: boolean;
      stripWhitespace?: boolean;
    };
  }) {
    super(options);
    this.separator = separator;
    this.isSeparatorRegex = isSeparatorRegex;
  }

  splitText({ text }: { text: string }): string[] {
    // First, split the text into initial chunks
    const separator = this.isSeparatorRegex ? this.separator : this.separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const initialSplits = splitTextWithRegex(text, separator, this.keepSeparator);

    // If length of any split is greater than chunk size, perform additional splitting
    const chunks: string[] = [];
    for (const split of initialSplits) {
      if (this.lengthFunction(split) <= this.size) {
        chunks.push(split);
      } else {
        // If a single split is too large, split it further with overlap
        const subChunks = this.__splitChunk(split);
        chunks.push(...subChunks);
      }
    }

    return chunks;
  }

  private __splitChunk(text: string): string[] {
    const chunks: string[] = [];
    let currentPosition = 0;

    while (currentPosition < text.length) {
      let chunkEnd = currentPosition;

      // Build chunk up to max size
      while (chunkEnd < text.length && this.lengthFunction(text.slice(currentPosition, chunkEnd + 1)) <= this.size) {
        chunkEnd++;
      }

      const currentChunk = text.slice(currentPosition, chunkEnd);
      const chunkLength = this.lengthFunction(currentChunk);
      chunks.push(currentChunk);

      // If we're at the end, break to avoid tiny chunks
      if (chunkEnd >= text.length) break;

      // Move position forward by chunk size minus overlap
      currentPosition += Math.max(1, chunkLength - this.overlap);
    }

    return chunks;
  }
}

export class RecursiveCharacterTransformer extends TextTransformer {
  protected separators: string[];
  protected isSeparatorRegex: boolean;

  constructor({
    separators,
    isSeparatorRegex = false,
    options = {},
  }: {
    separators?: string[];
    isSeparatorRegex?: boolean;
    options?: ChunkOptions;
  }) {
    super(options);
    this.separators = separators || ['\n\n', '\n', ' ', ''];
    this.isSeparatorRegex = isSeparatorRegex;
  }

  private _splitText(text: string, separators: string[]): string[] {
    const finalChunks: string[] = [];

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

    const goodSplits: string[] = [];
    const mergeSeparator = this.keepSeparator ? '' : separator;

    for (const s of splits) {
      if (this.lengthFunction(s) < this.size) {
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

  splitText({ text }: { text: string }): string[] {
    return this._splitText(text, this.separators);
  }

  static fromLanguage(
    language: Language,
    options: {
      size?: number;
      chunkOverlap?: number;
      lengthFunction?: (text: string) => number;
      keepSeparator?: boolean | 'start' | 'end';
      addStartIndex?: boolean;
      stripWhitespace?: boolean;
    } = {},
  ): RecursiveCharacterTransformer {
    const separators = RecursiveCharacterTransformer.getSeparatorsForLanguage(language);
    return new RecursiveCharacterTransformer({ separators, isSeparatorRegex: true, options });
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

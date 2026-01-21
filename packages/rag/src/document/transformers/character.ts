import { Language } from '../types';
import type { BaseChunkOptions, CharacterChunkOptions, RecursiveChunkOptions } from '../types';

import { TextTransformer } from './text';

function splitTextWithRegex(text: string, separator: string, separatorPosition?: 'start' | 'end'): string[] {
  if (!separator) {
    return text.split('');
  }

  if (!separatorPosition) {
    return text.split(new RegExp(separator)).filter(s => s !== '');
  }

  if (!text) {
    return [];
  }

  // Split with capturing group to keep separators
  const splits = text.split(new RegExp(`(${separator})`));
  const result: string[] = [];

  if (separatorPosition === 'end') {
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

  constructor({ separator = '\n\n', isSeparatorRegex = false, ...baseOptions }: CharacterChunkOptions = {}) {
    super(baseOptions);
    this.separator = separator;
    this.isSeparatorRegex = isSeparatorRegex;
  }

  splitText({ text }: { text: string }): string[] {
    // First, split the text into initial chunks
    const separator = this.isSeparatorRegex ? this.separator : this.separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const initialSplits = splitTextWithRegex(text, separator, this.separatorPosition);

    // If length of any split is greater than chunk size, perform additional splitting
    const chunks: string[] = [];
    for (const split of initialSplits) {
      if (this.lengthFunction(split) <= this.maxSize) {
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
      while (chunkEnd < text.length && this.lengthFunction(text.slice(currentPosition, chunkEnd + 1)) <= this.maxSize) {
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

  constructor({ separators, isSeparatorRegex = false, language, ...baseOptions }: RecursiveChunkOptions = {}) {
    super(baseOptions);
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

    const splits = splitTextWithRegex(text, _separator, this.separatorPosition);

    const goodSplits: string[] = [];
    const mergeSeparator = this.separatorPosition ? '' : separator;

    for (const s of splits) {
      if (this.lengthFunction(s) < this.maxSize) {
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

  static fromLanguage(language: Language, options: BaseChunkOptions = {}): RecursiveCharacterTransformer {
    const separators = RecursiveCharacterTransformer.getSeparatorsForLanguage(language);
    return new RecursiveCharacterTransformer({
      ...options,
      separators,
      isSeparatorRegex: true,
      language,
    });
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
      case Language.LATEX:
        return [
          '\\\\part\\*?\\{',
          '\\\\chapter\\*?\\{',
          '\\\\section\\*?\\{',
          '\\\\subsection\\*?\\{',
          '\\\\subsubsection\\*?\\{',
          '\\\\begin\\{.*?\\}',
          '\\\\end\\{.*?\\}',
          '\\\\[a-zA-Z]+\\{.*?\\}',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.PHP:
        return [
          '\\nnamespace ',
          '\\nuse ',
          '\\nclass ',
          '\\ninterface ',
          '\\ntrait ',
          '\\nfunction ',
          '\\npublic ',
          '\\nprivate ',
          '\\nprotected ',
          '\\nif ',
          '\\nforeach ',
          '\\nfor ',
          '\\nwhile ',
          '\\nswitch ',
          '\\ncase ',
          '\\n\\n',
          '\\n',
          ' ',
          '',
        ];
      case Language.GO:
        return [
          '\npackage ',
          '\nimport ',
          '\nfunc ',
          '\ntype ',
          '\nstruct ',
          '\ninterface ',
          '\nconst ',
          '\nvar ',
          '\nif ',
          '\nfor ',
          '\nswitch ',
          '\ncase ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.JAVA:
      case Language.SCALA:
        return [
          '\npackage ',
          '\nimport ',
          '\nclass ',
          '\ninterface ',
          '\nenum ',
          '\npublic ',
          '\nprotected ',
          '\nprivate ',
          '\nstatic ',
          '\nvoid ',
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
      case Language.KOTLIN:
        return [
          '\npackage ',
          '\nimport ',
          '\nclass ',
          '\ninterface ',
          '\nfun ',
          '\nval ',
          '\nvar ',
          '\nobject ',
          '\ncompanion ',
          '\nif ',
          '\nfor ',
          '\nwhile ',
          '\nwhen ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.JS:
        return [
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
      case Language.PYTHON:
        return [
          '\nclass ',
          '\ndef ',
          '\n\tdef ',
          '\n\t\tdef ',
          '\nasync def ',
          '\nif ',
          '\nfor ',
          '\nwhile ',
          '\ntry ',
          '\nexcept ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.RUBY:
        return [
          '\nmodule ',
          '\nclass ',
          '\ndef ',
          '\nif ',
          '\nunless ',
          '\nwhile ',
          '\nfor ',
          '\nbegin ',
          '\nrescue ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.RUST:
        return [
          '\nmod ',
          '\nuse ',
          '\nfn ',
          '\nstruct ',
          '\nenum ',
          '\nimpl ',
          '\ntrait ',
          '\nconst ',
          '\nlet ',
          '\nif ',
          '\nfor ',
          '\nwhile ',
          '\nmatch ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.SWIFT:
        return [
          '\nimport ',
          '\nclass ',
          '\nstruct ',
          '\nenum ',
          '\nprotocol ',
          '\nfunc ',
          '\nvar ',
          '\nlet ',
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
      case Language.HTML:
        return [
          '<body',
          '<div',
          '<p',
          '<br',
          '<li',
          '<h1',
          '<h2',
          '<h3',
          '<h4',
          '<h5',
          '<h6',
          '<span',
          '<table',
          '<tr',
          '<td',
          '<th',
          '<ul',
          '<ol',
          '<header',
          '<footer',
          '<nav',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.SOL:
        return [
          '\npragma ',
          '\nimport ',
          '\ncontract ',
          '\ninterface ',
          '\nlibrary ',
          '\nfunction ',
          '\nevent ',
          '\nmodifier ',
          '\nerror ',
          '\nstruct ',
          '\nenum ',
          '\nif ',
          '\nfor ',
          '\nwhile ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.CSHARP:
        return [
          '\nnamespace ',
          '\nusing ',
          '\nclass ',
          '\ninterface ',
          '\nstruct ',
          '\nenum ',
          '\npublic ',
          '\nprivate ',
          '\nprotected ',
          '\ninternal ',
          '\nvoid ',
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
      case Language.COBOL:
        return [
          '\nIDENTIFICATION DIVISION',
          '\nENVIRONMENT DIVISION',
          '\nDATA DIVISION',
          '\nPROCEDURE DIVISION',
          '\nWORKING-STORAGE SECTION',
          '\nPERFORM ',
          '\nIF ',
          '\nEVALUATE ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.LUA:
        return [
          '\nfunction ',
          '\nlocal function ',
          '\nif ',
          '\nfor ',
          '\nwhile ',
          '\nrepeat ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.PERL:
        return [
          '\nsub ',
          '\npackage ',
          '\nuse ',
          '\nmy ',
          '\nour ',
          '\nif ',
          '\nunless ',
          '\nwhile ',
          '\nfor ',
          '\nforeach ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.HASKELL:
        return [
          '\nmodule ',
          '\nimport ',
          '\ndata ',
          '\ntype ',
          '\nnewtype ',
          '\nclass ',
          '\ninstance ',
          '\nwhere ',
          '\nlet ',
          '\nif ',
          '\ncase ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.ELIXIR:
        return [
          '\ndefmodule ',
          '\ndefprotocol ',
          '\ndefimpl ',
          '\ndef ',
          '\ndefp ',
          '\ndefmacro ',
          '\nif ',
          '\ncase ',
          '\ncond ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.POWERSHELL:
        return [
          '\nfunction ',
          '\nfilter ',
          '\nparam ',
          '\nif ',
          '\nforeach ',
          '\nfor ',
          '\nwhile ',
          '\nswitch ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.PROTO:
        return [
          '\nsyntax ',
          '\npackage ',
          '\nimport ',
          '\nmessage ',
          '\nservice ',
          '\nenum ',
          '\nrpc ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      case Language.RST:
        return [
          '\n=+\n',
          '\n-+\n',
          '\n\\*+\n',
          '\n\\.\\. ',
          '\n\n',
          '\n',
          ' ',
          '',
        ];
      default:
        throw new Error(`Language ${language} is not supported! Please choose from ${Object.values(Language)}`);
    }
  }
}

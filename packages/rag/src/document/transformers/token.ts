import type { TiktokenModel, TiktokenEncoding, Tiktoken } from 'js-tiktoken';
import { encodingForModel, getEncoding } from 'js-tiktoken';

import { TextTransformer } from './text';

interface Tokenizer {
  overlap: number;
  tokensPerChunk: number;
  decode: (tokens: number[]) => string;
  encode: (text: string) => number[];
}

export function splitTextOnTokens({ text, tokenizer }: { text: string; tokenizer: Tokenizer }): string[] {
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
    startIdx += tokenizer.tokensPerChunk - tokenizer.overlap;
    curIdx = Math.min(startIdx + tokenizer.tokensPerChunk, inputIds.length);
    chunkIds = inputIds.slice(startIdx, curIdx);
  }

  return splits;
}

export class TokenTransformer extends TextTransformer {
  private tokenizer: Tiktoken;
  private allowedSpecial: Set<string> | 'all';
  private disallowedSpecial: Set<string> | 'all';

  constructor({
    encodingName = 'cl100k_base',
    modelName,
    allowedSpecial = new Set(),
    disallowedSpecial = 'all',
    options = {},
  }: {
    encodingName: TiktokenEncoding;
    modelName?: TiktokenModel;
    allowedSpecial?: Set<string> | 'all';
    disallowedSpecial?: Set<string> | 'all';
    options: {
      size?: number;
      overlap?: number;
      lengthFunction?: (text: string) => number;
      keepSeparator?: boolean | 'start' | 'end';
      addStartIndex?: boolean;
      stripWhitespace?: boolean;
    };
  }) {
    super(options);

    try {
      this.tokenizer = modelName ? encodingForModel(modelName) : getEncoding(encodingName);
    } catch (error) {
      throw new Error('Could not load tiktoken encoding. ' + 'Please install it with `npm install js-tiktoken`.');
    }

    this.allowedSpecial = allowedSpecial;
    this.disallowedSpecial = disallowedSpecial;
  }

  splitText({ text }: { text: string }): string[] {
    const encode = (text: string): number[] => {
      const allowed = this.allowedSpecial === 'all' ? 'all' : Array.from(this.allowedSpecial);

      const disallowed = this.disallowedSpecial === 'all' ? 'all' : Array.from(this.disallowedSpecial);

      // If stripWhitespace is enabled, trim the text before encoding
      const processedText = this.stripWhitespace ? text.trim() : text;
      return Array.from(this.tokenizer.encode(processedText, allowed, disallowed));
    };

    const decode = (tokens: number[]): string => {
      const text = this.tokenizer.decode(tokens);
      return this.stripWhitespace ? text.trim() : text;
    };

    const tokenizer: Tokenizer = {
      overlap: this.overlap,
      tokensPerChunk: this.size,
      decode,
      encode,
    };

    return splitTextOnTokens({ text, tokenizer });
  }

  static fromTikToken({
    encodingName = 'cl100k_base',
    modelName,
    options = {},
  }: {
    encodingName?: TiktokenEncoding;
    modelName?: TiktokenModel;
    options?: {
      size?: number;
      overlap?: number;
      allowedSpecial?: Set<string> | 'all';
      disallowedSpecial?: Set<string> | 'all';
    };
  }): TokenTransformer {
    let tokenizer: Tiktoken;

    try {
      if (modelName) {
        tokenizer = encodingForModel(modelName);
      } else {
        tokenizer = getEncoding(encodingName);
      }
    } catch (error) {
      throw new Error('Could not load tiktoken encoding. ' + 'Please install it with `npm install js-tiktoken`.');
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

    return new TokenTransformer({
      encodingName,
      modelName,
      allowedSpecial: options.allowedSpecial,
      disallowedSpecial: options.disallowedSpecial,
      options: {
        size: options.size,
        overlap: options.overlap,
        lengthFunction: tikTokenEncoder,
      },
    });
  }
}

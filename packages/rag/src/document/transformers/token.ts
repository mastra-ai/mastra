import type { TiktokenModel, TiktokenEncoding, Tiktoken } from 'js-tiktoken';
import { encodingForModel, getEncoding } from 'js-tiktoken';
import type { TokenChunkOptions } from '../types';

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
  private allowedArray: string[] | 'all';
  private disallowedArray: string[] | 'all';

  constructor({
    encodingName = 'cl100k_base',
    modelName,
    tokenizer: existingTokenizer,
    allowedSpecial = new Set(),
    disallowedSpecial = 'all',
    options = {},
  }: {
    encodingName?: TiktokenEncoding;
    modelName?: TiktokenModel;
    tokenizer?: Tiktoken;
    allowedSpecial?: Set<string> | 'all';
    disallowedSpecial?: Set<string> | 'all';
    options: TokenChunkOptions;
  }) {
    super(options);

    if (existingTokenizer) {
      this.tokenizer = existingTokenizer;
    } else {
      try {
        this.tokenizer = modelName ? encodingForModel(modelName) : getEncoding(encodingName);
      } catch {
        throw new Error('Could not load tiktoken encoding. ' + 'Please install it with `npm install js-tiktoken`.');
      }
    }

    this.allowedArray = allowedSpecial === 'all' ? 'all' : Array.from(allowedSpecial);
    this.disallowedArray = disallowedSpecial === 'all' ? 'all' : Array.from(disallowedSpecial);
  }

  splitText({ text }: { text: string }): string[] {
    const encode = (text: string): number[] => {
      const processedText = this.stripWhitespace ? text.trim() : text;
      return Array.from(this.tokenizer.encode(processedText, this.allowedArray, this.disallowedArray));
    };

    const decode = (tokens: number[]): string => {
      const text = this.tokenizer.decode(tokens);
      return this.stripWhitespace ? text.trim() : text;
    };

    const tokenizer: Tokenizer = {
      overlap: this.overlap,
      tokensPerChunk: this.maxSize,
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
    options?: TokenChunkOptions;
  }): TokenTransformer {
    let tokenizer: Tiktoken;

    try {
      if (modelName) {
        tokenizer = encodingForModel(modelName);
      } else {
        tokenizer = getEncoding(encodingName);
      }
    } catch {
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
      tokenizer,
      allowedSpecial: options.allowedSpecial,
      disallowedSpecial: options.disallowedSpecial,
      options: {
        maxSize: options.maxSize,
        overlap: options.overlap,
        lengthFunction: tikTokenEncoder,
      },
    });
  }
}

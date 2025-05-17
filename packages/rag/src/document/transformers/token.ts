import type { Tiktoken } from 'js-tiktoken';
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
  private allowedSpecial: Set<string> | 'all';
  private disallowedSpecial: Set<string> | 'all';

  constructor({
    encodingName = 'cl100k_base',
    modelName,
    allowedSpecial = new Set(),
    disallowedSpecial = 'all',
    ...rest
  }: TokenChunkOptions = {}) {
    super(rest);

    try {
      this.tokenizer = modelName ? encodingForModel(modelName) : getEncoding(encodingName);
    } catch {
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

  static fromTikToken(options?: TokenChunkOptions): TokenTransformer {
    const { encodingName = 'cl100k_base', modelName, allowedSpecial, disallowedSpecial } = options || {};
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
      const allowed = allowedSpecial === 'all' ? 'all' : allowedSpecial ? Array.from(allowedSpecial) : [];

      const disallowed = disallowedSpecial === 'all' ? 'all' : disallowedSpecial ? Array.from(disallowedSpecial) : [];

      return tokenizer.encode(text, allowed, disallowed).length;
    };

    return new TokenTransformer({
      ...options,
      lengthFunction: tikTokenEncoder,
    });
  }
}

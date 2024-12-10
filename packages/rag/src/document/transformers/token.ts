import { Tiktoken, encoding_for_model, get_encoding, TiktokenModel, TiktokenEncoding } from '@dqbd/tiktoken';

import { TextTransformer } from './text';

interface Tokenizer {
  chunkOverlap: number;
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
    startIdx += tokenizer.tokensPerChunk - tokenizer.chunkOverlap;
    curIdx = Math.min(startIdx + tokenizer.tokensPerChunk, inputIds.length);
    chunkIds = inputIds.slice(startIdx, curIdx);
  }

  return splits;
}

export class TokenTransformer extends TextTransformer {
  private tokenizer: Tiktoken;
  private allowedSpecial: Set<string> | 'all';
  private disallowedSpecial: Set<string> | 'all';
  private textDecoder: TextDecoder;

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
      chunkSize?: number;
      chunkOverlap?: number;
      lengthFunction?: (text: string) => number;
      keepSeparator?: boolean | 'start' | 'end';
      addStartIndex?: boolean;
      stripWhitespace?: boolean;
    };
  }) {
    super(options);

    try {
      this.tokenizer = modelName ? encoding_for_model(modelName) : get_encoding(encodingName);
      this.textDecoder = new TextDecoder();
    } catch (error) {
      throw new Error('Could not load tiktoken encoding. ' + 'Please install it with `npm install @dqbd/tiktoken`.');
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

    return splitTextOnTokens({ text, tokenizer });
  }

  dispose(): void {
    if (this.tokenizer) {
      this.tokenizer.free();
    }
  }

  static fromTikToken({
    encodingName = 'cl100k_base',
    modelName,
    options = {},
  }: {
    encodingName?: TiktokenEncoding;
    modelName?: TiktokenModel;
    options?: {
      chunkSize?: number;
      chunkOverlap?: number;
      allowedSpecial?: Set<string> | 'all';
      disallowedSpecial?: Set<string> | 'all';
    };
  }): TokenTransformer {
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

    return new TokenTransformer({
      encodingName,
      modelName,
      allowedSpecial: options.allowedSpecial,
      disallowedSpecial: options.disallowedSpecial,
      options: {
        chunkSize: options.chunkSize,
        chunkOverlap: options.chunkOverlap,
        lengthFunction: tikTokenEncoder,
      },
    });
  }
}

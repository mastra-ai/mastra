import type { TiktokenModel, TiktokenEncoding } from 'js-tiktoken';
import type { TokenChunkOptions } from '../types.js';
import { TextTransformer } from './text.js';
interface Tokenizer {
    overlap: number;
    tokensPerChunk: number;
    decode: (tokens: number[]) => string;
    encode: (text: string) => number[];
}
export declare function splitTextOnTokens({ text, tokenizer }: {
    text: string;
    tokenizer: Tokenizer;
}): string[];
export declare class TokenTransformer extends TextTransformer {
    private tokenizer;
    private allowedSpecial;
    private disallowedSpecial;
    constructor({ encodingName, modelName, allowedSpecial, disallowedSpecial, options, }: {
        encodingName?: TiktokenEncoding;
        modelName?: TiktokenModel;
        allowedSpecial?: Set<string> | 'all';
        disallowedSpecial?: Set<string> | 'all';
        options: TokenChunkOptions;
    });
    splitText({ text }: {
        text: string;
    }): string[];
    static fromTikToken({ encodingName, modelName, options, }: {
        encodingName?: TiktokenEncoding;
        modelName?: TiktokenModel;
        options?: TokenChunkOptions;
    }): TokenTransformer;
}
export {};
//# sourceMappingURL=token.d.ts.map
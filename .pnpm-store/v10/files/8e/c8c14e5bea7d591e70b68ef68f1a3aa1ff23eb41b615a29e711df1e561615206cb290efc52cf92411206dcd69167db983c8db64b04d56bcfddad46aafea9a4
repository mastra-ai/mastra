import type { TiktokenModel, TiktokenEncoding } from 'js-tiktoken';
import { Document } from '../schema/index.js';
import type { SemanticMarkdownChunkOptions } from '../types.js';
import { TextTransformer } from './text.js';
export declare class SemanticMarkdownTransformer extends TextTransformer {
    private tokenizer;
    private joinThreshold;
    private allowedSpecial;
    private disallowedSpecial;
    constructor({ joinThreshold, encodingName, modelName, allowedSpecial, disallowedSpecial, ...baseOptions }?: SemanticMarkdownChunkOptions);
    private countTokens;
    private splitMarkdownByHeaders;
    private mergeSemanticSections;
    splitText({ text }: {
        text: string;
    }): string[];
    createDocuments(texts: string[], metadatas?: Record<string, any>[]): Document[];
    transformDocuments(documents: Document[]): Document[];
    static fromTikToken({ encodingName, modelName, options, }: {
        encodingName?: TiktokenEncoding;
        modelName?: TiktokenModel;
        options?: SemanticMarkdownChunkOptions;
    }): SemanticMarkdownTransformer;
}
//# sourceMappingURL=semantic-markdown.d.ts.map
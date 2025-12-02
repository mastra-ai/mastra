import { Document } from '../schema/index.js';
import type { BaseChunkOptions } from '../types.js';
import { RecursiveCharacterTransformer } from './character.js';
export declare class MarkdownTransformer extends RecursiveCharacterTransformer {
    constructor(options?: BaseChunkOptions);
}
export declare class MarkdownHeaderTransformer {
    private headersToSplitOn;
    private returnEachLine;
    private stripHeaders;
    constructor(headersToSplitOn: [string, string][], returnEachLine?: boolean, stripHeaders?: boolean);
    private aggregateLinesToChunks;
    splitText({ text }: {
        text: string;
    }): Document[];
    createDocuments(texts: string[], metadatas?: Record<string, any>[]): Document[];
    transformDocuments(documents: Document[]): Document[];
}
//# sourceMappingURL=markdown.d.ts.map
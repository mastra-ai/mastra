import { Document } from '../schema/index.js';
import type { BaseChunkOptions } from '../types.js';
import type { Transformer } from './transformer.js';
export declare abstract class TextTransformer implements Transformer {
    protected maxSize: number;
    protected overlap: number;
    protected lengthFunction: (text: string) => number;
    protected keepSeparator: boolean | 'start' | 'end';
    protected addStartIndex: boolean;
    protected stripWhitespace: boolean;
    constructor({ maxSize, overlap, lengthFunction, keepSeparator, addStartIndex, stripWhitespace, }: BaseChunkOptions);
    setAddStartIndex(value: boolean): void;
    abstract splitText({ text }: {
        text: string;
    }): string[];
    createDocuments(texts: string[], metadatas?: Record<string, any>[]): Document[];
    splitDocuments(documents: Document[]): Document[];
    transformDocuments(documents: Document[]): Document[];
    protected joinDocs(docs: string[], separator: string): string | null;
    protected mergeSplits(splits: string[], separator: string): string[];
}
//# sourceMappingURL=text.d.ts.map
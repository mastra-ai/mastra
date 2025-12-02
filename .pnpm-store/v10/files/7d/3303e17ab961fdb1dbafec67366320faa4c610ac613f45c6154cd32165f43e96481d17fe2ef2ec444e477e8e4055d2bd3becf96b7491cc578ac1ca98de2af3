import { Document } from '../schema/index.js';
import type { HTMLChunkOptions } from '../types.js';
export declare class HTMLHeaderTransformer {
    private headersToSplitOn;
    private returnEachElement;
    constructor(options: HTMLChunkOptions & {
        headers: [string, string][];
    });
    splitText({ text }: {
        text: string;
    }): Document[];
    private getXPath;
    private getTextContent;
    private aggregateElementsToChunks;
    createDocuments(texts: string[], metadatas?: Record<string, any>[]): Document[];
    transformDocuments(documents: Document[]): Document[];
}
export declare class HTMLSectionTransformer {
    private headersToSplitOn;
    private textSplitter;
    constructor(options: HTMLChunkOptions & {
        sections: [string, string][];
    });
    splitText(text: string): Document[];
    private getXPath;
    private splitHtmlByHeaders;
    splitDocuments(documents: Document[]): Promise<Document[]>;
    createDocuments(texts: string[], metadatas?: Record<string, any>[]): Document[];
    transformDocuments(documents: Document[]): Document[];
}
//# sourceMappingURL=html.d.ts.map
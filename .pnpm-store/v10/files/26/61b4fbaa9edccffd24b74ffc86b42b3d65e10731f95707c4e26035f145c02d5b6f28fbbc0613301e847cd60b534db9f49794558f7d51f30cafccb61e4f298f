import { Document as Chunk } from './schema/index.js';
import type { ChunkParams, ExtractParams, HTMLChunkOptions, RecursiveChunkOptions, CharacterChunkOptions, TokenChunkOptions, MarkdownChunkOptions, SemanticMarkdownChunkOptions, JsonChunkOptions, LatexChunkOptions, SentenceChunkOptions } from './types.js';
export declare class MDocument {
    private chunks;
    private type;
    constructor({ docs, type }: {
        docs: {
            text: string;
            metadata?: Record<string, any>;
        }[];
        type: string;
    });
    extractMetadata({ title, summary, questions, keywords }: ExtractParams): Promise<MDocument>;
    static fromText(text: string, metadata?: Record<string, any>): MDocument;
    static fromHTML(html: string, metadata?: Record<string, any>): MDocument;
    static fromMarkdown(markdown: string, metadata?: Record<string, any>): MDocument;
    static fromJSON(jsonString: string, metadata?: Record<string, any>): MDocument;
    private defaultStrategy;
    private _strategyMap?;
    private get strategyMap();
    private chunkBy;
    chunkRecursive(options?: RecursiveChunkOptions): Promise<void>;
    chunkCharacter(options?: CharacterChunkOptions): Promise<void>;
    chunkHTML(options?: HTMLChunkOptions): Promise<void>;
    chunkJSON(options?: JsonChunkOptions): Promise<void>;
    chunkLatex(options?: LatexChunkOptions): Promise<void>;
    chunkToken(options?: TokenChunkOptions): Promise<void>;
    chunkMarkdown(options?: MarkdownChunkOptions): Promise<void>;
    chunkSentence(options?: SentenceChunkOptions): Promise<void>;
    chunkSemanticMarkdown(options?: SemanticMarkdownChunkOptions): Promise<void>;
    chunk(params?: ChunkParams): Promise<Chunk[]>;
    getDocs(): Chunk[];
    getText(): string[];
    getMetadata(): Record<string, any>[];
}
//# sourceMappingURL=document.d.ts.map
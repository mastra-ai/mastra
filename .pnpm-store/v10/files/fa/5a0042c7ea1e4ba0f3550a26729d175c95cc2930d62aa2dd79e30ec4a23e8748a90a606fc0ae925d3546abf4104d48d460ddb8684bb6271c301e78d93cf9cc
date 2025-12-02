import type { SentenceChunkOptions } from '../types.js';
import { TextTransformer } from './text.js';
export declare class SentenceTransformer extends TextTransformer {
    protected minSize: number;
    protected maxSize: number;
    protected targetSize: number;
    protected sentenceEnders: string[];
    protected fallbackToWords: boolean;
    protected fallbackToCharacters: boolean;
    protected keepSeparator: boolean | 'start' | 'end';
    constructor(options: SentenceChunkOptions);
    private detectSentenceBoundaries;
    private isRealSentenceBoundary;
    private isCommonAbbreviation;
    /**
     * Group sentences into chunks with integrated overlap processing
     */
    private groupSentencesIntoChunks;
    /**
     * Handle oversized sentences with fallback strategies
     */
    private handleOversizedSentence;
    private splitSentenceIntoWords;
    private splitSentenceIntoCharacters;
    private calculateSentenceOverlap;
    private calculateChunkSize;
    splitText({ text }: {
        text: string;
    }): string[];
}
//# sourceMappingURL=sentence.d.ts.map
import { Language } from '../types.js';
import type { BaseChunkOptions, CharacterChunkOptions, RecursiveChunkOptions } from '../types.js';
import { TextTransformer } from './text.js';
export declare class CharacterTransformer extends TextTransformer {
    protected separator: string;
    protected isSeparatorRegex: boolean;
    constructor({ separator, isSeparatorRegex, ...baseOptions }?: CharacterChunkOptions);
    splitText({ text }: {
        text: string;
    }): string[];
    private __splitChunk;
}
export declare class RecursiveCharacterTransformer extends TextTransformer {
    protected separators: string[];
    protected isSeparatorRegex: boolean;
    constructor({ separators, isSeparatorRegex, language, ...baseOptions }?: RecursiveChunkOptions);
    private _splitText;
    splitText({ text }: {
        text: string;
    }): string[];
    static fromLanguage(language: Language, options?: BaseChunkOptions): RecursiveCharacterTransformer;
    static getSeparatorsForLanguage(language: Language): string[];
}
//# sourceMappingURL=character.d.ts.map
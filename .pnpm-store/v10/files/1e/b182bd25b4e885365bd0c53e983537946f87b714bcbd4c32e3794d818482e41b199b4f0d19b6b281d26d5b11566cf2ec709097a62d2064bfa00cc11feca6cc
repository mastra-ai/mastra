import { IPrimaryLanguage, ITranslations } from "../Exports.js";
export interface ITranslationHypothesis {
    Duration: number;
    Offset: number;
    PrimaryLanguage?: IPrimaryLanguage;
    Text: string;
    Translation: ITranslations;
}
export declare class TranslationHypothesis implements ITranslationHypothesis {
    private privTranslationHypothesis;
    private constructor();
    static fromJSON(json: string, baseOffset: number): TranslationHypothesis;
    static fromTranslationResponse(translationHypothesis: {
        SpeechHypothesis: ITranslationHypothesis;
    }, baseOffset: number): TranslationHypothesis;
    get Duration(): number;
    get Offset(): number;
    get Text(): string;
    get Translation(): ITranslations;
    get Language(): string;
    asJson(): string;
    private mapTranslationStatus;
}

import { IPrimaryLanguage, ITranslations, RecognitionStatus } from "../Exports.js";
export interface ITranslationPhrase {
    RecognitionStatus: RecognitionStatus;
    Offset: number;
    Duration: number;
    Translation?: ITranslations;
    Text?: string;
    DisplayText?: string;
    PrimaryLanguage?: IPrimaryLanguage;
}
export declare class TranslationPhrase implements ITranslationPhrase {
    private privTranslationPhrase;
    private constructor();
    static fromJSON(json: string, baseOffset: number): TranslationPhrase;
    static fromTranslationResponse(translationResponse: {
        SpeechPhrase: ITranslationPhrase;
    }, baseOffset: number): TranslationPhrase;
    get RecognitionStatus(): RecognitionStatus;
    get Offset(): number;
    get Duration(): number;
    get Text(): string | undefined;
    get Language(): string | undefined;
    get Confidence(): string | undefined;
    get Translation(): ITranslations | undefined;
    asJson(): string;
    private mapRecognitionStatus;
    private mapTranslationStatus;
}

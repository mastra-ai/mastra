import { RecognitionStatus } from "../Exports.js";
export interface ISimpleSpeechPhrase {
    RecognitionStatus: RecognitionStatus;
    DisplayText: string;
    Offset?: number;
    Duration?: number;
    PrimaryLanguage?: IPrimaryLanguage;
    SpeakerId?: string;
    [key: string]: any;
}
export interface IPrimaryLanguage {
    Language: string;
    Confidence: string;
}
export declare class SimpleSpeechPhrase implements ISimpleSpeechPhrase {
    private privSimpleSpeechPhrase;
    private constructor();
    static fromJSON(json: string, baseOffset: number): SimpleSpeechPhrase;
    private updateOffset;
    asJson(): string;
    get RecognitionStatus(): RecognitionStatus;
    get DisplayText(): string;
    get Offset(): number;
    get Duration(): number;
    get Language(): string;
    get LanguageDetectionConfidence(): string;
    get SpeakerId(): string;
    private mapRecognitionStatus;
}

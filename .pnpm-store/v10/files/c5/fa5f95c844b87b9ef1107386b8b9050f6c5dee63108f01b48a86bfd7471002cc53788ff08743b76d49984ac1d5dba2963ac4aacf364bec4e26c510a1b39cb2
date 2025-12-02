import { IPrimaryLanguage } from "./SimpleSpeechPhrase.js";
export interface ISpeechHypothesis {
    Text: string;
    Offset: number;
    Duration: number;
    PrimaryLanguage?: IPrimaryLanguage;
    SpeakerId?: string;
    [key: string]: any;
}
export declare class SpeechHypothesis implements ISpeechHypothesis {
    private privSpeechHypothesis;
    private constructor();
    static fromJSON(json: string, baseOffset: number): SpeechHypothesis;
    private updateOffset;
    asJson(): string;
    get Text(): string;
    get Offset(): number;
    get Duration(): number;
    get Language(): string;
    get LanguageDetectionConfidence(): string;
    get SpeakerId(): string;
}

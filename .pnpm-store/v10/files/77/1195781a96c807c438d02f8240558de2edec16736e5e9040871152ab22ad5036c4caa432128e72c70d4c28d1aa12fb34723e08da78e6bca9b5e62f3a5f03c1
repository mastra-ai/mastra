import { IPrimaryLanguage, RecognitionStatus } from "../Exports.js";
export interface IDetailedSpeechPhrase {
    RecognitionStatus: RecognitionStatus;
    NBest: IPhrase[];
    Duration?: number;
    Offset?: number;
    PrimaryLanguage?: IPrimaryLanguage;
    DisplayText?: string;
    SpeakerId?: string;
    [key: string]: any;
}
export interface IPhrase {
    Confidence?: number;
    Lexical: string;
    ITN: string;
    MaskedITN: string;
    Display?: string;
    DisplayText?: string;
    Words?: IWord[];
    DisplayWords?: IWord[];
}
export interface IWord {
    Word: string;
    Offset: number;
    Duration: number;
}
export declare class DetailedSpeechPhrase implements IDetailedSpeechPhrase {
    private privDetailedSpeechPhrase;
    private constructor();
    static fromJSON(json: string, baseOffset: number): DetailedSpeechPhrase;
    private updateOffsets;
    asJson(): string;
    get RecognitionStatus(): RecognitionStatus;
    get NBest(): IPhrase[];
    get Duration(): number;
    get Offset(): number;
    get Language(): string;
    get LanguageDetectionConfidence(): string;
    get Text(): string;
    get SpeakerId(): string;
    private mapRecognitionStatus;
}

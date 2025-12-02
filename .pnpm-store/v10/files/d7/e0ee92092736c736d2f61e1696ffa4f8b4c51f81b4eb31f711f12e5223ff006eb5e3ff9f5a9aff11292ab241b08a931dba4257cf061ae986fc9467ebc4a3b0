export interface ISpeechKeyword {
    Status: string;
    Text: string;
    Offset: number;
    Duration: number;
    [key: string]: any;
}
export declare class SpeechKeyword implements ISpeechKeyword {
    private privSpeechKeyword;
    private constructor();
    static fromJSON(json: string, baseOffset: number): SpeechKeyword;
    get Status(): string;
    get Text(): string;
    get Offset(): number;
    get Duration(): number;
    asJson(): string;
}
